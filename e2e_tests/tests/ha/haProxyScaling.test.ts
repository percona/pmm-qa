import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { defaultHaProxyReplicas } from '@helpers/haProxy.helper';
import { KubernetesPodResource, KubernetesResourceList } from '@interfaces/kubernetes';

const hostnameTopologyKey = 'kubernetes.io/hostname';
const postgresPodSelectors = {
  pgBouncer: 'postgres-operator.crunchydata.com/role=pgbouncer',
  postgres: 'postgres-operator.crunchydata.com/data=postgres',
};
const cordonedNodes: string[] = [];

// ScheduleAnyway only scores the spread, so past one pod per node the scheduler
// also weighs node load and an even skew is not guaranteed.
const expectOnePodPerNodeFirst = (podsPerNode: Record<string, number>, replicas: number): void => {
  const counts = Object.values(podsPerNode);

  if (replicas >= counts.length) {
    expect(
      counts.filter((pods) => pods === 0),
      `Every node must host an HAProxy pod before any shares one: ${JSON.stringify(podsPerNode)}`,
    ).toHaveLength(0);
  } else {
    expect(
      Math.max(...counts),
      `No node may host two HAProxy pods while another has none: ${JSON.stringify(podsPerNode)}`,
    ).toBe(1);
  }
};

pmmTest.describe('HAProxy scaling on an HA cluster', () => {
  pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper, haProxyHelper }) => {
    pmmTest.setTimeout(Timeouts.THIRTY_MINUTES);
    await grafanaHelper.authorize();
    await haProxyHelper.ensureReplicas();
    await haClusterHelper.ensureServing(api.haApi);
  });

  pmmTest.afterEach(async ({ api, haClusterHelper, haProxyHelper }) => {
    await haProxyHelper.ensureReplicas(defaultHaProxyReplicas, cordonedNodes.splice(0));
    await haClusterHelper.waitForApiServing(api.haApi);
  });

  pmmTest(
    'PMM-T2319 - Verify HAProxy scales beyond the worker-node count with all replicas Running @pmm-ha',
    async ({ api, haClusterHelper, haProxyHelper }) => {
      const nodes = haProxyHelper.schedulableNodes();
      const replicas = nodes.length + 2;

      await pmmTest.step(`Scale HAProxy to ${replicas} replicas on ${nodes.length} nodes`, async () => {
        haProxyHelper.scale(replicas);
        await haProxyHelper.waitForReadyPods(replicas);
      });

      await pmmTest.step('Verify the replicas are spread one-per-node first, then co-located', async () => {
        expectOnePodPerNodeFirst(haProxyHelper.podsPerNode(), replicas);
      });

      await pmmTest.step('Verify PMM is served through the scaled HAProxy', async () => {
        await haClusterHelper.waitForApiServing(api.haApi);

        for (let request = 0; request < replicas * 2; request++) {
          expect(await api.haApi.getStatus()).toEqual('Enabled');
        }
      });
    },
  );

  pmmTest(
    'PMM-T2320 - Verify HAProxy uses a soft topology spread while PostgreSQL and pgBouncer keep required anti-affinity @pmm-ha',
    async ({ haProxyHelper, k8sHelper }) => {
      const podSpec = haProxyHelper.deployment().spec.template.spec;

      await pmmTest.step(
        'Verify the HAProxy pods spread by a ScheduleAnyway topology constraint',
        async () => {
          expect(podSpec.topologySpreadConstraints).toEqual([
            {
              labelSelector: { matchLabels: { 'app.kubernetes.io/name': 'haproxy' } },
              maxSkew: 1,
              topologyKey: hostnameTopologyKey,
              whenUnsatisfiable: 'ScheduleAnyway',
            },
          ]);
        },
      );

      await pmmTest.step('Verify HAProxy no longer has a required pod anti-affinity', async () => {
        expect(
          podSpec.affinity?.podAntiAffinity?.requiredDuringSchedulingIgnoredDuringExecution,
        ).toBeUndefined();
      });

      for (const [component, selector] of Object.entries(postgresPodSelectors)) {
        await pmmTest.step(`Verify ${component} pods keep a required per-node anti-affinity`, async () => {
          const pods = k8sHelper.getJson<KubernetesResourceList<KubernetesPodResource>>(
            `pods --selector=${selector}`,
          ).items;

          expect(pods.length, `No ${component} pods match "${selector}"`).toBeGreaterThan(0);

          for (const pod of pods) {
            expect(
              pod.spec?.affinity?.podAntiAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.map(
                (term) => term.topologyKey,
              ),
              `${pod.metadata.name} must require one pod per node`,
            ).toContain(hostnameTopologyKey);
          }
        });
      }
    },
  );

  pmmTest(
    'PMM-T2321 - Verify HAProxy PodDisruptionBudget allows one voluntary disruption at every replica count @pmm-ha',
    async ({ haProxyHelper }) => {
      await pmmTest.step('Verify the budget is maxUnavailable 1', async () => {
        const { spec } = haProxyHelper.disruptionBudget();

        expect(spec.maxUnavailable).toEqual(1);
        expect(spec.minAvailable).toBeUndefined();
      });

      for (const replicas of [defaultHaProxyReplicas, haProxyHelper.schedulableNodes().length + 2, 1]) {
        await pmmTest.step(`Verify ${replicas} HAProxy replicas allow exactly one disruption`, async () => {
          haProxyHelper.scale(replicas);
          await haProxyHelper.waitForReadyPods(replicas);
          // The disruption controller recomputes status after the pods turn Ready.
          await expect(() => {
            const { status } = haProxyHelper.disruptionBudget();

            expect({ allowed: status?.disruptionsAllowed, expected: status?.expectedPods }).toEqual({
              allowed: 1,
              expected: replicas,
            });
          }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
        });
      }
    },
  );

  pmmTest(
    'PMM-T2322 - Verify draining a node with co-located HAProxy replicas keeps PMM reachable @pmm-ha',
    async ({ api, haClusterHelper, haProxyHelper, k8sHelper }) => {
      const replicas = haProxyHelper.schedulableNodes().length + 2;
      let drainedNode = '';

      await pmmTest.step(`Scale HAProxy to ${replicas} replicas so two share a node`, async () => {
        haProxyHelper.scale(replicas);
        await haProxyHelper.waitForReadyPods(replicas);

        const podsPerNode = haProxyHelper.podsPerNode();

        drainedNode = Object.keys(podsPerNode).find((nodeName) => podsPerNode[nodeName] >= 2) ?? '';
        expect(drainedNode, `No node hosts two HAProxy pods: ${JSON.stringify(podsPerNode)}`).not.toEqual('');
      });

      await pmmTest.step(`Drain the HAProxy pods off "${drainedNode}"`, async () => {
        cordonedNodes.push(drainedNode);

        const drain = k8sHelper.drainNode(drainedNode, haProxyHelper.releasePodSelector()).assertSuccess();

        // Both evictions are requested at once; the budget has to refuse the second.
        expect(
          `${drain.stdout}\n${drain.stderr}`,
          'The PodDisruptionBudget must serialize the evictions of co-located replicas',
        ).toContain("would violate the pod's disruption budget");
      });

      await pmmTest.step('Verify every replica is back on the remaining nodes', async () => {
        await haProxyHelper.waitForReadyPods(replicas);
        expect(
          haProxyHelper.podsPerNode()[drainedNode] ?? 0,
          `No HAProxy pod may remain on "${drainedNode}"`,
        ).toBe(0);
      });

      await pmmTest.step('Verify PMM is still served through HAProxy', async () => {
        await haClusterHelper.waitForApiServing(api.haApi);
        expect(await api.haApi.getStatus()).toEqual('Enabled');
      });
    },
  );

  pmmTest(
    'PMM-T2323 - Verify HAProxy scales back down from above the worker-node count @pmm-ha',
    async ({ api, haClusterHelper, haProxyHelper }) => {
      const nodes = haProxyHelper.schedulableNodes();

      for (const replicas of [
        nodes.length + 2,
        defaultHaProxyReplicas,
        nodes.length * 2 + 1,
        defaultHaProxyReplicas,
      ]) {
        await pmmTest.step(`Scale HAProxy to ${replicas} replicas and verify the spread`, async () => {
          haProxyHelper.scale(replicas);
          await haProxyHelper.waitForReadyPods(replicas);

          expectOnePodPerNodeFirst(haProxyHelper.podsPerNode(), replicas);
        });
      }

      await pmmTest.step('Verify PMM is served through HAProxy', async () => {
        await haClusterHelper.waitForApiServing(api.haApi);
        expect(await api.haApi.getStatus()).toEqual('Enabled');
      });
    },
  );
});

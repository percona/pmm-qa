import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import HaApi from '@api/ha.api';
import { Timeouts } from '@helpers/timeouts';
import { defaultReplicas } from '@helpers/haCluster.helper';

const terminalPhases = ['Succeeded', 'Failed'];

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2261 - Verify Prometheus rules and raft metrics for HA @pmm-ha',
  async ({ api, haClusterHelper, k8sHelper }) => {
    const initialLeader = await pmmTest.step(
      `Verify every pod backing the ${defaultReplicas}-replica cluster is ready`,
      async () => {
        // Polled: a pod deleted by an earlier test lingers Running-but-not-ready while it terminates.
        await expect(async () => {
          expect(
            k8sHelper
              .getPods()
              .filter((pod) => !terminalPhases.includes(pod.phase) && !pod.ready)
              .map((pod) => `${pod.name} (${pod.phase})`),
            `Every non-terminated pod in namespace "${k8sHelper.namespace}" must be ready`,
          ).toEqual([]);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });

        return haClusterHelper.leaderFromPods();
      },
    );

    await pmmTest.step(
      `Verify "${HaApi.leaderStatusMetric}" names "${initialLeader}" as leader`,
      async () => {
        expect(
          await api.haApi.waitForLeaderInMetrics(undefined, Timeouts.TWO_MINUTES),
          'The leader in metrics must be the pod answering the leader health check',
        ).toEqual(initialLeader);
      },
    );

    const newLeader = await pmmTest.step(`Switch the leader away from "${initialLeader}"`, async () => {
      k8sHelper.deletePod(initialLeader).assertSuccess();

      return await api.haApi.waitForLeaderInMetrics(initialLeader, Timeouts.FIVE_MINUTES);
    });

    await pmmTest.step(`Verify "${newLeader}" is the only leader the metric reports`, async () => {
      await api.haApi.waitForLeaderStatusSum(1, Timeouts.TWO_MINUTES);

      expect(
        await api.haApi.getLeaderFromMetrics(),
        `"${newLeader}" must be the single node reporting ${HaApi.leaderStatusMetric} == 1`,
      ).toEqual(newLeader);
    });

    await pmmTest.step(`Verify "${HaApi.raftTermMetric}" recorded the leader change`, async () => {
      await expect(async () => {
        const changes = await api.haApi.getRaftTermChanges();

        expect(changes, `Every HA node must export ${HaApi.raftTermMetric}`).toHaveLength(defaultReplicas);
        expect(
          Math.max(...changes),
          `The failover must advance the Raft term, so changes(${HaApi.raftTermMetric}[15m]) must exceed 0`,
        ).toBeGreaterThan(0);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });

    await pmmTest.step(
      `Verify "${HaApi.upMetric}" reports every node and ${defaultReplicas} voters once the cluster settles`,
      async () => {
        await expect(async () => {
          expect(
            await api.haApi.getNodesFromUpMetric(),
            `Every HA node must export ${HaApi.upMetric}`,
          ).toEqual(haClusterHelper.podNames());

          expect(
            await api.haApi.getVoterCount(),
            `Fewer than ${defaultReplicas} voters puts a ${defaultReplicas}-node cluster at risk of losing quorum`,
          ).toEqual(defaultReplicas);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      },
    );
  },
);

import pmmTest from '@fixtures/pmmTest';
import { APIRequestContext, expect } from '@playwright/test';
import HelmHelper from '@helpers/helm.helper';
import HaClusterHelper, { defaultReplicas } from '@helpers/haCluster.helper';
import K8sHelper from '@helpers/k8s.helper';
import type HaApi from '@api/ha.api';
import { HaNodeRole } from '@interfaces/ha';
import { Timeouts } from '@helpers/timeouts';
import apiEndpoints from '@helpers/apiEndpoints';

const pmmHaChart = 'pmm-ha';
const haproxyService = 'pmm-ha-haproxy';
const verifyLoadBalancerServes = async (k8sHelper: K8sHelper, request: APIRequestContext): Promise<void> =>
  await pmmTest.step('Verify PMM serves through the HAProxy LoadBalancer', async () => {
    const exposure = k8sHelper.getServiceExposure(haproxyService);

    expect(exposure.type, 'Scaling with --reuse-values must keep the Service a LoadBalancer').toEqual(
      'LoadBalancer',
    );
    expect(exposure.address, 'The LoadBalancer must keep its external address').toBeTruthy();

    await expect(async () => {
      const response = await request.get(`https://${exposure.address}${apiEndpoints.server.readyz}`);

      expect(response.status(), `readyz through ${exposure.address}`).toEqual(200);
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
  });
const helmScale = async (
  helmHelper: HelmHelper,
  haClusterHelper: HaClusterHelper,
  replicas: number,
): Promise<void> =>
  await pmmTest.step(`Scale to ${replicas} replicas with helm upgrade --reuse-values`, async () => {
    const release = helmHelper.getRelease(pmmHaChart);

    helmHelper.upgrade(release.name, HelmHelper.chartFromEnv(), { replicas }).assertSuccess();

    expect(
      Number(helmHelper.getRelease(pmmHaChart).revision),
      'The upgrade must record a revision',
    ).toBeGreaterThan(Number(release.revision));
    await haClusterHelper.waitForReadyPods(replicas, Timeouts.TEN_MINUTES);
  });
const verifyCluster = async (
  haApi: HaApi,
  haClusterHelper: HaClusterHelper,
  replicas: number,
): Promise<void> =>
  await pmmTest.step(`Verify ${replicas} alive HA nodes with one leader`, async () => {
    const podNames = haClusterHelper.podNames();

    expect(podNames).toHaveLength(replicas);

    // Departing and joining members reach /v1/ha/nodes after the pods are Ready.
    await expect(async () => {
      const nodes = await haApi.getNodes();

      expect({
        leaders: nodes.filter((node) => node.role === HaNodeRole.leader).length,
        names: nodes.map((node) => node.node_name).sort(),
        statuses: nodes.map((node) => node.status),
      }).toEqual({ leaders: 1, names: podNames, statuses: Array(replicas).fill('alive') });
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });

    await haClusterHelper.verifySingleLeader(haApi, podNames);
  });

pmmTest.describe.configure({ mode: 'serial' });

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper, helmHelper }) => {
  helmHelper.assertAvailable();
  HelmHelper.chartFromEnv();
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi, defaultReplicas);
});

pmmTest.afterEach(async ({ api, haClusterHelper, helmHelper, k8sHelper }) => {
  const replicas = k8sHelper.getStatefulSetReplicas(haClusterHelper.statefulSetName());

  if (replicas !== defaultReplicas) {
    if (replicas > defaultReplicas) {
      await haClusterHelper.ensureLeaderAmong(haClusterHelper.podNames().slice(0, defaultReplicas));
    }

    helmHelper
      .upgrade(helmHelper.getRelease(pmmHaChart).name, HelmHelper.chartFromEnv(), {
        replicas: defaultReplicas,
      })
      .assertSuccess();
  }

  await haClusterHelper.ensureServing(api.haApi, defaultReplicas);
});

pmmTest(
  'PMM-T2304 - Verify PMM HA scales 3 to 5 to 3 replicas with Helm and stays reachable through the LoadBalancer @pmm-helm-scale',
  async ({ api, haClusterHelper, helmHelper, k8sHelper, request }) => {
    pmmTest.setTimeout(Timeouts.SIXTY_MINUTES);

    expect(k8sHelper.getStatefulSetReplicas(haClusterHelper.statefulSetName())).toEqual(defaultReplicas);
    await verifyLoadBalancerServes(k8sHelper, request);

    await helmScale(helmHelper, haClusterHelper, 5);
    await verifyCluster(api.haApi, haClusterHelper, 5);
    await verifyLoadBalancerServes(k8sHelper, request);

    await haClusterHelper.ensureLeaderAmong(haClusterHelper.podNames().slice(0, defaultReplicas));
    await helmScale(helmHelper, haClusterHelper, defaultReplicas);
    await verifyCluster(api.haApi, haClusterHelper, defaultReplicas);
    await verifyLoadBalancerServes(k8sHelper, request);
  },
);

pmmTest(
  'PMM-T2305 - Verify PMM HA scales down to one replica and back to three with Helm @pmm-helm-scale',
  async ({ api, haClusterHelper, helmHelper, k8sHelper, request }) => {
    pmmTest.setTimeout(Timeouts.SIXTY_MINUTES);

    const podNames = haClusterHelper.podNames();
    const [firstPod] = podNames;

    expect(podNames).toHaveLength(defaultReplicas);

    await haClusterHelper.ensureLeaderAmong([firstPod]);
    await helmScale(helmHelper, haClusterHelper, 1);
    await haClusterHelper.waitForApiServing(api.haApi, Timeouts.FIVE_MINUTES);
    await verifyCluster(api.haApi, haClusterHelper, 1);
    await verifyLoadBalancerServes(k8sHelper, request);

    await helmScale(helmHelper, haClusterHelper, defaultReplicas);
    await haClusterHelper.waitForApiServing(api.haApi, Timeouts.FIVE_MINUTES);
    await verifyCluster(api.haApi, haClusterHelper, defaultReplicas);
    await verifyLoadBalancerServes(k8sHelper, request);
  },
);

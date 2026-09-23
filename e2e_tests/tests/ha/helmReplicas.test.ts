import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import HelmHelper from '@helpers/helm.helper';
import HaClusterHelper from '@helpers/haCluster.helper';
import K8sHelper from '@helpers/k8s.helper';

const pmmHaChart = 'pmm-ha';
const haproxyName = 'pmm-ha-haproxy';

interface ReleaseState {
  revision: string;
  serviceType: string;
  statefulSetReplicas: number;
}

const releaseState = (
  helmHelper: HelmHelper,
  haClusterHelper: HaClusterHelper,
  k8sHelper: K8sHelper,
): ReleaseState => ({
  revision: helmHelper.getRelease(pmmHaChart).revision,
  serviceType: k8sHelper.getServiceExposure(haproxyName).type,
  statefulSetReplicas: k8sHelper.getStatefulSetReplicas(haClusterHelper.statefulSetName()),
});

const rendered = (releaseJson: string, kind: string, name: string) => {
  const resource = HelmHelper.renderedResources(releaseJson).find(
    (candidate) => candidate.kind === kind && candidate.name === name,
  );

  if (!resource) throw new Error(`The rendered manifest has no ${kind} "${name}"`);

  return resource;
};

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper, helmHelper }) => {
  helmHelper.assertAvailable();
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2300 - Verify Helm rejects an even number of PMM Server replicas @pmm-helm-replicas',
  async ({ api, haClusterHelper, helmHelper, k8sHelper }) => {
    const chart = HelmHelper.chartFromEnv();
    const release = helmHelper.getRelease(pmmHaChart).name;
    const before = releaseState(helmHelper, haClusterHelper, k8sHelper);

    for (const replicas of [2, 4, 6, 10]) {
      await pmmTest.step(`Dry-run an upgrade to ${replicas} replicas`, async () => {
        const result = helmHelper.upgrade(release, chart, { replicas }, { dryRun: true });

        expect(result.code, `helm must refuse ${replicas} replicas`).not.toEqual(0);
        expect(result.stderr).toContain(`replicas must be odd, got ${replicas}`);
      });
    }

    await pmmTest.step('Run a real upgrade to 4 replicas', async () => {
      const result = helmHelper.upgrade(release, chart, { replicas: 4 });

      expect(result.code, 'helm must refuse 4 replicas without a dry run too').not.toEqual(0);
      expect(result.stderr).toContain('replicas must be odd, got 4');
    });

    await pmmTest.step('Verify the running release was not touched', async () => {
      expect(releaseState(helmHelper, haClusterHelper, k8sHelper)).toEqual(before);
      await haClusterHelper.waitForApiServing(api.haApi);
    });
  },
);

pmmTest(
  'PMM-T2301 - Verify Helm rejects PMM Server replicas outside the supported range @pmm-helm-replicas',
  async ({ haClusterHelper, helmHelper, k8sHelper }) => {
    const chart = HelmHelper.chartFromEnv();
    const release = helmHelper.getRelease(pmmHaChart).name;
    const before = releaseState(helmHelper, haClusterHelper, k8sHelper);
    const rejections: { message: string; values: Record<string, number> }[] = [
      { message: 'replicas must be a whole number between 1 and 9999, got 0', values: { replicas: 0 } },
      { message: 'replicas must be a whole number between 1 and 9999, got -1', values: { replicas: -1 } },
      { message: 'replicas (11) exceeds maxReplicas (10)', values: { replicas: 11 } },
      { message: 'replicas (7) exceeds maxReplicas (5)', values: { maxReplicas: 5, replicas: 7 } },
      { message: 'maxReplicas must be a whole number between 1 and 100, got 0', values: { maxReplicas: 0 } },
      {
        message: 'maxReplicas must be a whole number between 1 and 100, got 101',
        values: { maxReplicas: 101 },
      },
    ];

    for (const { message, values } of rejections) {
      await pmmTest.step(`Dry-run an upgrade with ${JSON.stringify(values)}`, async () => {
        const result = helmHelper.upgrade(release, chart, values, { dryRun: true });

        expect(result.code, `helm must refuse ${JSON.stringify(values)}`).not.toEqual(0);
        expect(result.stderr).toContain(message);
      });
    }

    expect(releaseState(helmHelper, haClusterHelper, k8sHelper)).toEqual(before);
  },
);

pmmTest(
  'PMM-T2302 - Verify Helm accepts an odd number of PMM Server replicas @pmm-helm-replicas',
  async ({ haClusterHelper, helmHelper }) => {
    const chart = HelmHelper.chartFromEnv();
    const release = helmHelper.getRelease(pmmHaChart).name;
    const statefulSet = haClusterHelper.statefulSetName();

    for (const replicas of [1, 3, 5, 9]) {
      await pmmTest.step(`Dry-run an upgrade to ${replicas} replicas`, async () => {
        const result = helmHelper.upgrade(release, chart, { replicas }, { dryRun: true }).assertSuccess();

        expect(rendered(result.stdout, 'StatefulSet', statefulSet).replicas).toEqual(replicas);
      });
    }
  },
);

pmmTest(
  'PMM-T2303 - Verify HAProxy replicas are not limited by the PMM Server replica guard @pmm-helm-replicas',
  async ({ haClusterHelper, helmHelper, k8sHelper }) => {
    const chart = HelmHelper.chartFromEnv();
    const release = helmHelper.getRelease(pmmHaChart).name;
    const statefulSet = haClusterHelper.statefulSetName();
    const pmmReplicas = k8sHelper.getStatefulSetReplicas(statefulSet);

    for (const haproxyReplicas of [1, 6, 11]) {
      await pmmTest.step(`Dry-run an upgrade to ${haproxyReplicas} HAProxy replicas`, async () => {
        const result = helmHelper
          .upgrade(release, chart, { 'haproxy.replicaCount': haproxyReplicas }, { dryRun: true })
          .assertSuccess();

        expect(rendered(result.stdout, 'Deployment', haproxyName).replicas).toEqual(haproxyReplicas);
        expect(
          rendered(result.stdout, 'StatefulSet', statefulSet).replicas,
          'Scaling HAProxy must not change the PMM Server replicas',
        ).toEqual(pmmReplicas);
      });
    }

    await pmmTest.step('Dry-run 10 PMM Server replicas with 11 HAProxy replicas', async () => {
      const result = helmHelper.upgrade(
        release,
        chart,
        { 'haproxy.replicaCount': 11, replicas: 10 },
        { dryRun: true },
      );

      expect(result.code, 'helm must refuse the even PMM Server count').not.toEqual(0);
      expect(result.stderr).toContain('replicas must be odd, got 10');
    });
  },
);

import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

// A discovery 403 drops the targets rather than marking them down, so each node's presence is the check.
const perNodeJobs = [
  { job: 'kubelet', nodeLabel: 'instance' },
  { job: 'cadvisor', nodeLabel: 'instance' },
  { job: 'node-exporter|openshift-node-exporter', nodeLabel: 'node_name' },
];

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2371 - Verify vmagent scrapes the kubelet, cAdvisor, node exporter and API server of the PMM HA cluster @pmm-ha',
  async ({ api, k8sHelper }) => {
    const nodes = k8sHelper
      .execSilent('get nodes --output=jsonpath={.items[*].metadata.name}')
      .assertSuccess()
      .stdout.trim()
      .split(/\s+/)
      .filter(Boolean)
      .sort();

    expect(nodes.length, 'kubectl must list at least one node').toBeGreaterThan(0);

    for (const { job, nodeLabel } of perNodeJobs) {
      await pmmTest.step(`Verify "${job}" is up on all ${nodes.length} nodes`, async () => {
        await expect(async () => {
          const samples = await api.prometheusApi.instantQuery(`up{job=~"${job}"} == 1`);

          expect(samples.map((sample) => sample.metric[nodeLabel]).sort()).toEqual(nodes);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
      });
    }

    await pmmTest.step('Verify "kube-apiserver" is up', async () => {
      await expect(async () => {
        expect(await api.prometheusApi.instantQueryValue('min(up{job="kube-apiserver"})')).toEqual(1);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
    });
  },
);

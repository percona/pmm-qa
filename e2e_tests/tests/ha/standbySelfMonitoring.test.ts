import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { AgentStatus } from '@interfaces/inventory';
import { Timeouts } from '@helpers/timeouts';

const nodeMetric = 'node_cpu_seconds_total';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2107 - Verify every standby PMM HA node monitors itself @pmm-ha',
  async ({ api, haClusterHelper }) => {
    const podNames = haClusterHelper.podNames();
    const leader = haClusterHelper.leaderFromPods(podNames);
    const standbys = podNames.filter((podName) => podName !== leader);

    expect(standbys, 'The case is about standby nodes, so HA must run more than one').not.toHaveLength(0);

    // Freshness, not presence: a standby that stopped scraping when it lost
    // leadership still serves everything it collected while it was leader.
    const standbyCheckedAt = await api.prometheusApi.waitForServerTime();

    for (const podName of standbys) {
      await pmmTest.step(`Verify standby "${podName}" monitors itself`, async () => {
        const node = (await api.inventoryApi.getAllNodes()).find((node) => node.node_name === podName);

        expect(node, `"${podName}" must be registered as its own node`).toBeDefined();

        const agentOfType = (agentType: string) =>
          node?.agents?.find((agent) => agent.agent_type === agentType);

        expect(
          agentOfType('pmm-agent')?.is_connected,
          `"${podName}" must run its own pmm-agent, connected to the cluster`,
        ).toBe(true);

        const exporter = agentOfType('node_exporter');

        expect(exporter?.status, `"${podName}" must run its own node_exporter`).toEqual(AgentStatus.running);

        await expect(async () => {
          const samples = await api.prometheusApi.instantQuery(
            `max by (agent_id) (timestamp(${nodeMetric}{node_name="${podName}"}))`,
          );

          expect(samples, `"${podName}" must still report ${nodeMetric}`).not.toHaveLength(0);
          expect(
            samples.map((sample) => sample.metric.agent_id),
            `"${podName}"'s ${nodeMetric} must come from its own node_exporter only`,
          ).toEqual([exporter?.agent_id]);
          expect(
            Number(samples[0].value[1]),
            `"${podName}" must report ${nodeMetric} collected after the standbys were checked`,
          ).toBeGreaterThan(standbyCheckedAt);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      });
    }
  },
);

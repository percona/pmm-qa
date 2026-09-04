import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { HaNodeRole } from '@interfaces/ha';
import { Timeouts } from '@helpers/timeouts';
import { defaultReplicas } from '@helpers/haCluster.helper';
import PrometheusApi from '@api/prometheus.api';
import { AlertRule } from '@interfaces/alerting';

const suffix = Date.now();
const alertRule = {
  folder: `PMM-T2135-${suffix}`,
  group: `PMM-T2135-${suffix}`,
  name: `PMM-T2135 node high CPU load ${suffix}`,
  pendingPeriod: '60s',
  templateName: 'pmm_node_high_cpu_load',
  threshold: 1,
};
const monitoredNodesQuery = 'count by (node_name) (node_cpu_seconds_total)';
const alertingNodeNames = (rule?: AlertRule): string[] =>
  (rule?.alerts ?? [])
    .filter((alert) => alert.state === 'Alerting')
    .map((alert) => alert.labels.node_name)
    .sort();
const monitoredNodeNames = async (prometheusApi: PrometheusApi): Promise<string[]> =>
  (await prometheusApi.instantQuery(monitoredNodesQuery)).map((sample) => sample.metric.node_name).sort();

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2135 - Verify Alert rules and fired alerts are retained after switchover @pmm-ha',
  async ({ api, haClusterHelper }) => {
    let folderUid = '';

    try {
      await pmmTest.step(
        `Create an alert rule from "${alertRule.templateName}" with threshold ${alertRule.threshold}`,
        async () => {
          folderUid = await api.grafanaApi.createFolder(alertRule.folder);

          await api.alertingApi.createRuleFromTemplate({ ...alertRule, folderUid });

          expect(await api.alertingApi.getRule(alertRule.name)).toBeDefined();
        },
      );

      const monitoredNodes = await pmmTest.step(
        'Verify the alert fires for every monitored node',
        async () => {
          let nodes: string[] = [];

          await expect(async () => {
            // Re-read on every attempt rather than pinning a count up front: nodes come
            // and go on a shared cluster, and one that appears while the rule is still
            // in its pending period fires a minute later than the rest.
            const monitored = await monitoredNodeNames(api.prometheusApi);
            const rule = await api.alertingApi.getRule(alertRule.name);

            expect(monitored).not.toHaveLength(0);
            expect(rule?.state).toEqual('firing');
            expect(alertingNodeNames(rule)).toEqual(expect.arrayContaining(monitored));

            nodes = monitored;
          }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });

          return nodes;
        },
      );

      await pmmTest.step('Restart the leader pod and check the new leader pod', async () => {
        const newLeader = await haClusterHelper.failoverLeader(api.haApi);

        await expect(async () => {
          const nodes = await api.haApi.getNodes();

          expect(
            nodes.filter((node) => node.role === HaNodeRole.leader).map((node) => node.node_name),
          ).toEqual([newLeader]);
          expect(nodes.filter((node) => node.status === 'alive')).toHaveLength(defaultReplicas);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      });

      await pmmTest.step('Verify the alert rule and its fired alerts are retained', async () => {
        await expect(async () => {
          const rule = await api.alertingApi.getRule(alertRule.name);

          expect(rule?.state).toEqual('firing');
          // The same nodes, not the same number: a node that starts being monitored
          // during the failover adds an alert, which is not a retention failure.
          expect(
            alertingNodeNames(rule),
            `The alerts fired before the switchover must still be firing: ${monitoredNodes}`,
          ).toEqual(expect.arrayContaining(monitoredNodes));
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      });
    } finally {
      if (folderUid) await api.grafanaApi.deleteFolder(folderUid);
    }
  },
);

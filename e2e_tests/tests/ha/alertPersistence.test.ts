import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { HaNodeRole } from '@interfaces/ha';
import { Timeouts } from '@helpers/timeouts';
import { defaultReplicas } from '@helpers/haCluster.helper';

const suffix = Date.now();
const alertRule = {
  folder: `PMM-T2135-${suffix}`,
  group: `PMM-T2135-${suffix}`,
  name: `PMM-T2135 node high CPU load ${suffix}`,
  pendingPeriod: '60s',
  templateName: 'pmm_node_high_cpu_load',
  threshold: 1,
};
const monitoredNodeCount = 'count(count by (node_name) (node_cpu_seconds_total))';

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
          const nodes = (await api.prometheusApi.instantQueryValue(monitoredNodeCount)) ?? 0;

          expect(nodes).toBeGreaterThan(0);

          await expect(async () => {
            const rule = await api.alertingApi.getRule(alertRule.name);

            expect(rule?.state).toEqual('firing');
            expect(rule?.alerts?.filter((alert) => alert.state === 'Alerting')).toHaveLength(nodes);
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
          expect(rule?.alerts?.filter((alert) => alert.state === 'Alerting')).toHaveLength(monitoredNodes);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      });
    } finally {
      if (folderUid) await api.grafanaApi.deleteFolder(folderUid);
    }
  },
);

import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { HaNodeRole } from '@interfaces/ha';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2131 Verify every PMM HA node reports the same cluster status @pmm-ha',
  async ({ api, haClusterHelper }) => {
    await pmmTest.step('Verify HA mode is enabled', async () => {
      expect(await api.haApi.getStatus()).toEqual('Enabled');
    });

    const podNames = haClusterHelper.podNames();

    expect(podNames.length, 'HA runs more than one PMM Server pod').toBeGreaterThan(1);

    await pmmTest.step('Verify every pod lists the whole cluster alive under one leader', async () => {
      // Asked of each pod in turn inside one poll: a pod that joined or left
      // recently is in the others' memberlist only after the next gossip round.
      await expect(async () => {
        const leader = haClusterHelper.leaderFromPods(podNames);

        for (const podName of podNames) {
          const { expected_nodes, nodes } = haClusterHelper.nodesFromPod(podName);

          expect(
            nodes.map((node) => node.node_name).sort(),
            `"${podName}" must list every PMM Server pod`,
          ).toEqual(podNames);

          expect(
            nodes.map((node) => node.status),
            `"${podName}" must see every node alive`,
          ).toEqual(Array(podNames.length).fill('alive'));

          expect(
            nodes.filter((node) => node.role === HaNodeRole.leader).map((node) => node.node_name),
            `"${podName}" must name "${leader}" as the only leader`,
          ).toEqual([leader]);

          // Static, from PMM_HA_PEERS - it is the size the chart was installed
          // with, not a count of who is currently up.
          expect(expected_nodes, `"${podName}" must expect ${podNames.length} nodes`).toEqual(
            podNames.length,
          );
        }
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
    });
  },
);

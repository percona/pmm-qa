import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import GrafanaDatabaseHelper, {
  grafanaExited,
  supervisordLog,
  supervisordStarted,
} from '@helpers/grafanaDatabase.helper';
import { defaultReplicas } from '@helpers/haCluster.helper';
import K8sHelper from '@helpers/k8s.helper';
import { Timeouts } from '@helpers/timeouts';

const dashboardTitle = `pmm-15919-ha ${Date.now()}`;
const panelTitle = 'PMM-15919 HA panel';
const pmmManagedLog = '/srv/logs/pmm-managed.log';
// pmm-managed's first line on every start.
const pmmManagedStarted = 'msg="Log level:';
let dashboardUrl = '';
let uid = '';
// /srv is a PVC, so a log check reads only what the current start wrote.
const countSinceStart = (
  k8sHelper: K8sHelper,
  podName: string,
  file: string,
  start: string,
  pattern: string,
) =>
  Number(
    k8sHelper
      .execInPod(podName, GrafanaDatabaseHelper.countLines(file, pattern, start), { silent: true })
      .assertSuccess()
      .stdout.trim(),
  );
const countSupervisordStarts = (k8sHelper: K8sHelper, podName: string) =>
  Number(
    k8sHelper
      .execInPod(podName, GrafanaDatabaseHelper.countLines(supervisordLog, supervisordStarted), {
        silent: true,
      })
      .assertSuccess()
      .stdout.trim(),
  );

const verifyNoGrafanaExit = (k8sHelper: K8sHelper, podName: string) => {
  expect(
    countSupervisordStarts(k8sHelper, podName),
    `${podName} must have logged a supervisord start`,
  ).toBeGreaterThan(0);
  expect(
    countSinceStart(k8sHelper, podName, supervisordLog, supervisordStarted, grafanaExited),
    `Grafana exits on ${podName} since supervisord started`,
  ).toEqual(0);
};

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest.afterEach(async ({ api }) => {
  if (uid) await api.grafanaApi.deleteDashboard(uid);

  dashboardUrl = '';
  uid = '';
});

pmmTest(
  'PMM-T2922 - Verify PMM HA on the new image starts Grafana once on every replica and keeps it through a leader failover @pmm-ha',
  async ({ api, dashboard, haClusterHelper, k8sHelper, page, searchDashboardsPage }) => {
    const podNames = haClusterHelper.podNames();

    expect(podNames, 'PMM HA replicas').toHaveLength(defaultReplicas);

    await pmmTest.step('Verify every replica skipped the embedded PostgreSQL setup', async () => {
      for (const podName of podNames) {
        const output = k8sHelper.execSilent(`logs ${podName} --container=pmm-ha`).assertSuccess().stdout;

        expect(output, `${podName} container output`).toContain(
          'Skipping embedded PostgreSQL setup in HA mode.',
        );
        expect(output, `${podName} container output`).not.toContain('Ensuring grafana role');
      }
    });

    await pmmTest.step(
      "Verify no replica logged a Grafana exit or failed to locate Grafana's database",
      async () => {
        for (const podName of podNames) {
          verifyNoGrafanaExit(k8sHelper, podName);
          expect(
            countSinceStart(
              k8sHelper,
              podName,
              pmmManagedLog,
              pmmManagedStarted,
              "Cannot locate Grafana's database",
            ),
            `pmm-managed on ${podName}`,
          ).toEqual(0);
        }
      },
    );

    await pmmTest.step(`Save dashboard "${dashboardTitle}" and find it under Dashboards`, async () => {
      const created = await api.grafanaApi.createDashboard(dashboardTitle, panelTitle);

      uid = created.uid;
      dashboardUrl = created.url;
      await page.goto(searchDashboardsPage.url);
      await expect(searchDashboardsPage.builders.dashboardRow(dashboardTitle)).toBeVisible({
        timeout: Timeouts.ONE_MINUTE,
      });
    });

    const [leader, startsBefore] = await pmmTest.step(
      'Read the leader and its supervisord starts',
      async () => {
        const current = haClusterHelper.leaderFromPods();

        return [current, countSupervisordStarts(k8sHelper, current)] as const;
      },
    );

    await pmmTest.step(`Delete the leader "${leader}" and verify a new leader serves the UI`, async () => {
      await haClusterHelper.failoverLeader(api.haApi);
      await expect(async () => {
        await page.goto(searchDashboardsPage.url);
        await expect(searchDashboardsPage.builders.dashboardRow(dashboardTitle)).toBeVisible({
          timeout: Timeouts.THIRTY_SECONDS,
        });
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
    });

    await pmmTest.step(`Verify the recreated "${leader}" started Grafana without an exit`, async () => {
      await haClusterHelper.waitForReadyPods(defaultReplicas);
      expect(countSupervisordStarts(k8sHelper, leader), `${leader} must have started again`).toEqual(
        startsBefore + 1,
      );
      verifyNoGrafanaExit(k8sHelper, leader);
    });

    await pmmTest.step(`Open dashboard "${dashboardTitle}"`, async () => {
      await expect(async () => {
        await page.goto(dashboardUrl);
        await expect(dashboard.elements.panelName).toHaveText(panelTitle, {
          timeout: Timeouts.THIRTY_SECONDS,
        });
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
    });
  },
);

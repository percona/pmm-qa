import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import customDashboard from '@testdata/customDashboard.json';

pmmTest.describe('PMM upgrade tests for dashboards', () => {
  const dashboardName = 'upgrade-dashboard';
  const panelName = customDashboard.panels[0].title;

  pmmTest.beforeEach(async ({ grafanaHelper, page }) => {
    await grafanaHelper.authorize();

    const { id } = await (await page.request.get('graph/api/user')).json();

    await page.addInitScript((key) => localStorage.setItem(key, 'false'), `pmm-ui.first-login.user-${id}`);
  });

  pmmTest(
    'PMM-T391 - Verify user is able to create and set custom home dashboard @pre-upgrade',
    async ({ dashboard, grafanaHelper, page }) => {
      const folder = await grafanaHelper.getFolderDetailsByName('Insight');
      const response = await grafanaHelper.createCustomDashboard(dashboardName, folder.id, [
        'pmm-qa',
        'tag-upgrade',
      ]);
      const { uid } = await response.json();

      await grafanaHelper.starDashboard(uid);
      await grafanaHelper.setHomeDashboard(uid);

      await page.goto('pmm-ui/graph/');
      await dashboard.verifyMetricsPresent([{ name: panelName, type: 'stat' }]);
      expect(page.url()).toContain(dashboardName);
      expect(page.url()).toContain(uid);
      await page.goto((await grafanaHelper.getDashboard(uid)).meta.url);
    },
  );

  pmmTest(
    'PMM-T391 - Verify custom home dashboard is present after upgrade @post-upgrade',
    async ({ dashboard, page }) => {
      await page.goto('pmm-ui/graph/');
      await dashboard.verifyMetricsPresent([{ name: panelName, type: 'stat' }]);
      expect(page.url()).toContain(dashboardName);
    },
  );

  pmmTest('Verify grafana logs after upgrade @post-upgrade', async ({ cliHelper }) => {
    // Only errors meaning the upgrade broke dashboards, datasources or storage: the
    // restart's transient request-lifecycle errors are noise, not upgrade defects.
    const meaningfulErrorSignatures = [
      'Error while loading library panels',
      'logger=provisioning',
      'logger=migrator',
      'logger=resource-migrator',
      'logger=unifiedstorage-migrator',
      'logger=storage.unified.migrat',
    ];
    // Grafana can start before pmm-managed creates the alert rule directory; it logs this and
    // reads the rules on the restart pmm-managed then does, see PMM-14956.
    const expectedErrors = [
      `can't read alerting provisioning files from directory" path=/usr/share/grafana/conf/provisioning/alerting error="open /usr/share/grafana/conf/provisioning/alerting: no such file or directory"`,
    ];
    // /srv outlives the image swap, so grafana.log still holds the old server's lines, down to
    // the provisioning walk `docker stop` cancels. Keep what the running container logged, plus
    // any line without a timestamp, so a log-format change cannot silence this check.
    const upgradedAt = Date.parse(
      cliHelper
        .execSilent(`docker inspect --format '{{.State.StartedAt}}' pmm-server`)
        .assertSuccess()
        .stdout.trim(),
    );

    expect(upgradedAt, 'Start time of the upgraded pmm-server container should be readable').not.toBeNaN();

    const errorLogs = cliHelper.execSilent(
      'docker exec pmm-server cat /srv/logs/grafana.log | grep level=error',
    );
    const meaningfulErrors = errorLogs
      .getStdOutLines()
      .filter((line) => {
        const timestamp = /(?:^|\s)t=(\S+)/.exec(line);
        const loggedAt = timestamp === null ? NaN : Date.parse(timestamp[1]);

        return Number.isNaN(loggedAt) || loggedAt >= upgradedAt;
      })
      .filter((line) => meaningfulErrorSignatures.some((signature) => line.includes(signature)))
      .filter((line) => !expectedErrors.some((expected) => line.includes(expected)));

    expect(
      meaningfulErrors,
      `Meaningful grafana errors found after upgrade:\n${meaningfulErrors.join('\n')}`,
    ).toHaveLength(0);
  });

  pmmTest(
    'Verify duplicate dashboard do not break upgrade @pre-upgrade',
    async ({ grafanaHelper, testState }) => {
      const insightFolder = await grafanaHelper.getFolderDetailsByName('Insight');
      const experimentalFolder = await grafanaHelper.getFolderDetailsByName('Experimental');
      const firstCustomDashboard = await grafanaHelper.createCustomDashboard(
        'test-dashboard',
        insightFolder.id,
      );
      const secondCustomDashboard = await grafanaHelper.createCustomDashboard(
        'test-dashboard',
        experimentalFolder.id,
      );
      const firstDashboardUid = (await firstCustomDashboard.json()).uid;
      const secondDashboardUid = (await secondCustomDashboard.json()).uid;

      testState.save({
        FIRST_DASHBOARD_UID: firstDashboardUid,
        SECOND_DASHBOARD_UID: secondDashboardUid,
      });

      expect(firstDashboardUid.length).toBeGreaterThan(0);
      expect(secondDashboardUid.length).toBeGreaterThan(0);
    },
  );

  pmmTest(
    'Verify duplicate dashboard do not break after upgrade @post-upgrade',
    async ({ dashboard, grafanaHelper, page, testState }) => {
      const firstDashboardUid = testState.get('FIRST_DASHBOARD_UID');
      const secondDashboardUid = testState.get('SECOND_DASHBOARD_UID');
      const firstDashboard = await grafanaHelper.getDashboard(firstDashboardUid);
      const secondDashboard = await grafanaHelper.getDashboard(secondDashboardUid);
      const firstUrl = firstDashboard.meta.url;
      const secondUrl = secondDashboard.meta.url;

      await page.goto(firstUrl);
      await dashboard.verifyMetricsPresent([{ name: panelName, type: 'stat' }]);
      expect(page.url()).toContain(firstUrl);
      await page.goto(secondUrl);
      await dashboard.verifyMetricsPresent([{ name: panelName, type: 'stat' }]);
      expect(page.url()).toContain(secondUrl);
    },
  );

  pmmTest(
    'PMM-T319 - Open the MySQL Instances Overview dashboard after upgrade @post-upgrade',
    async ({ api, dashboard, page, urlHelper }) => {
      const { service_name } = await api.inventoryApi.getServiceDetailsByPartialName('ps_pmm');

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceOverview.url, {
          from: 'now-1h',
          serviceName: service_name,
        }),
      );
      await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlInstanceOverview.metrics);
      await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlInstanceOverview.noDataMetrics);
      await dashboard.verifyPanelValues(dashboard.mysql.mysqlInstanceOverview.metricsWithData);
    },
  );
});

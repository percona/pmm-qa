import pmmTest from '@fixtures/pmmTest';
import { GetService } from '@interfaces/inventory';
import { expect } from '@playwright/test';

pmmTest.describe('PMM settings tests for upgrade', () => {
  const dashboardName = 'upgrade-dashboard';
  const panelName = 'Monitored DB';

  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T391 - Verify user is able to create and set custom home dashboard @pre-upgrade',
    async ({ dashboard, grafanaHelper, page }) => {
      const folder = await grafanaHelper.getFolderDetailsByName('Insight');

      await grafanaHelper.createFolder('upgrade-folder');

      const customDashboard = await grafanaHelper.createCustomDashboard(
        dashboardName,
        folder.id,
        `${panelName}`,
        ['pmm-qa', 'tag-upgrade'],
      );

      await grafanaHelper.starDashboard((await customDashboard.json()).uid);
      await grafanaHelper.setHomeDashboard((await customDashboard.json()).uid);

      await page.goto('pmm-ui/graph/');
      await dashboard.verifyMetricsPresent([{ name: panelName, type: 'stat' }]);
      expect(page.url()).toContain(dashboardName);
      expect(page.url()).toContain((await customDashboard.json()).uid);
      await page.goto((await grafanaHelper.getDashboard((await customDashboard.json()).uid)).meta.url);
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
    const errorLogs = cliHelper.execSilent(
      'docker exec pmm-server cat /srv/logs/grafana.log | grep level=error',
    );

    expect(errorLogs.stderr, `Error found in grafana log after upgrade: ${errorLogs.stderr}`).toHaveLength(0);
  });

  pmmTest(
    'Verify duplicate dashboard do not break upgrade @pre-upgrade',
    async ({ grafanaHelper, testState }) => {
      const insightFolder = await grafanaHelper.getFolderDetailsByName('Insight');
      const experimentalFolder = await grafanaHelper.getFolderDetailsByName('Experimental');
      const firstCustomDashboard = await grafanaHelper.createCustomDashboard(
        'test-dashboard',
        insightFolder.id,
        panelName,
      );
      const secondCustomDashboard = await grafanaHelper.createCustomDashboard(
        'test-dashboard',
        experimentalFolder.id,
        panelName,
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
    'PMM-T319 - Open the MySQL Instances Overview dashboard after upgrade @post-upgrade @post-client-upgrade',
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

  pmmTest(
    'PMM-T2049 - Verify PostgreSQL Instances Overview after upgrade @post-upgrade @post-client-upgrade',
    async ({ api, dashboard, page, urlHelper }) => {
      const { service_name } = await api.inventoryApi.getServiceDetailsByPartialName('pgsql');

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.pgsql.instanceOverview.url, {
          from: 'now-1h',
          refresh: '5s',
          serviceName: service_name,
        }),
      );
      await dashboard.verifyMetricsPresent(dashboard.pgsql.instanceOverview.metrics);
      await dashboard.verifyAllPanelsHaveData(dashboard.pgsql.instanceOverview.noDataMetrics);
      await dashboard.verifyPanelValues(dashboard.pgsql.instanceOverview.metricsWithData);
    },
  );

  pmmTest(
    'Verify MongoDB Router Summary after upgrade @post-upgrade @post-client-upgrade',
    async ({ dashboard, page, urlHelper }) => {
      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mongo.routerSummary.url, {
          from: 'now-1h',
          refresh: '5s',
        }),
      );

      await dashboard.verifyMetricsPresent(dashboard.mongo.routerSummary.metrics);
      await dashboard.verifyAllPanelsHaveData(dashboard.mongo.routerSummary.noDataMetrics);
      await dashboard.verifyPanelValues(dashboard.mongo.routerSummary.metricsWithData);
    },
  );

  pmmTest(
    'T9999 Verify MongoDB Sharded Cluster Summary after upgrade @post-upgrade @post-client-upgrade',
    async ({ api, dashboard, page, urlHelper }) => {
      const shardNames = ['rs1', 'rs2'];
      const nodeNames = ['rs1', 'rs2', 'rscfg'];
      const serviceNames = (await api.inventoryApi.getAllServiceDetailsByRegex('rs\\d{3}_\\d+')).map(
        (service: GetService) => service.service_name,
      );

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mongo.shardedClusterSummary.url, {
          from: 'now-1h',
          refresh: '5s',
        }),
      );

      await dashboard.verifyMetricsPresent(
        dashboard.mongo.shardedClusterSummary.metrics(shardNames, nodeNames, serviceNames),
      );
      await dashboard.verifyAllPanelsHaveData(
        dashboard.mongo.shardedClusterSummary.noDataMetrics(shardNames, nodeNames, serviceNames),
      );
      await dashboard.verifyPanelValues(dashboard.mongo.shardedClusterSummary.metricsWithData(shardNames));
    },
  );

  pmmTest(
    'T8888 Verify MongoDB ReplSet Summary after upgrade @post-upgrade @post-client-upgrade',
    async ({ api, dashboard, page, urlHelper }) => {
      const services: GetService[] = await api.inventoryApi.getAllServicesDetailsByPartialName('rs');

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mongo.replSetSummary.url, {
          from: 'now-1h',
          refresh: '5s',
        }),
      );
      await dashboard.collapseAllRows();

      const metrics = dashboard.mongo.replSetSummary.metrics(
        services.map((service) => service.service_name),
        services.map((service) => service.node_name),
      );

      for (const metric of metrics) {
        await dashboard.expandRow(metric.rowName);
        await dashboard.waitForDashboardToLoad();
        await dashboard.verifyRowMetricsPresent(metric.rowName, metric.metrics);
        await dashboard.verifyRowPanelsHaveData(metric.rowName, []);
        await dashboard.verifyRowPanelValues(
          metric.rowName,
          dashboard.mongo.replSetSummary.metricsWithDataForRow(
            metric.rowName,
            services.map((service) => service.service_name),
            services.map((service) => service.node_name),
          ),
        );
        await dashboard.collapseRow(metric.rowName);
      }
    },
  );
});

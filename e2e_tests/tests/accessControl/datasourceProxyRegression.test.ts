import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { dataSourceRoutes, editor, ruleGroup, viewer } from '@testdata/datasourceProxy';
import { accessControlScenarios, dashboardTimeRange, qanUrl } from './accessControl.constants';

const exploreEndpoints = [
  'api/v1/label/__name__/values',
  'api/v1/labels',
  'api/v1/metadata',
  'api/v1/series?match%5B%5D=up',
  'api/v1/query_exemplars?query=up',
  'api/v1/rules',
];
let folderUid: string;

pmmTest.beforeEach(async ({ accessControlHelper, api, grafanaHelper }) => {
  await grafanaHelper.authorize();
  await accessControlHelper.setupUsers();
  folderUid = await api.grafanaApi.createFolder(`pmm-15379-${Date.now()}`);
});

pmmTest.afterEach(async ({ accessControlHelper, api }) => {
  await api.grafanaApi.deleteFolder(folderUid);
  await accessControlHelper.setAccessControl(true);
});

pmmTest(
  'PMM-T2350 - Verify dashboards, variables, Explore, QAN and alert rules keep working for every database type @LBAC',
  async ({
    accessControlHelper,
    api,
    dashboard,
    grafanaHelper,
    leftNavigation,
    page,
    qanStoredMetrics,
    urlHelper,
  }) => {
    const { id, uid } = await accessControlHelper.getMetricsDataSource();
    const routes = dataSourceRoutes(id, uid);
    const failed: string[] = [];

    await accessControlHelper.setAccessControl(false);

    const refusalsBefore = accessControlHelper.countRefusals();

    page.on('response', (response) => {
      if (/\/api\/(ds\/query|datasources\/)/.test(response.url()) && response.status() >= 400) {
        failed.push(`${response.status()} ${response.url()}`);
      }
    });

    await grafanaHelper.signInAs(viewer.username, viewer.password);

    await pmmTest.step('Viewer sees data in QAN', async () => {
      await page.goto(urlHelper.buildUrlWithParameters(qanUrl, { from: dashboardTimeRange }));
      await qanStoredMetrics.verifyQanStoredMetricsHaveData();
    });

    for (const { allowedPanels, serviceType } of accessControlScenarios) {
      await pmmTest.step(`Viewer sees data on the ${serviceType} overview`, async () => {
        await leftNavigation.selectMenuItem(serviceType);
        await dashboard.verifyPanelValues(allowedPanels);
      });
    }

    await pmmTest.step('No data source request failed', async () => {
      expect(failed).toEqual([]);
    });

    await pmmTest.step('Explore requests succeed for an Editor', async () => {
      for (const endpoint of exploreEndpoints) {
        const { status } = await api.datasourceProxyApi.get(`${routes.resourcesByUid}${endpoint}`, editor);

        expect(status, endpoint).toEqual(200);
      }
    });

    await pmmTest.step('An alert rule on the Metrics data source fires', async () => {
      const name = 'pmm-15379-fire';
      const response = await page.request.post(`${apiEndpoints.grafana.ruler}/${folderUid}`, {
        data: ruleGroup(name, uid, 'up{service_name=~".+"}'),
        headers: GrafanaHelper.getAuthHeader(),
      });

      expect(response.status(), await response.text()).toEqual(202);
      await expect
        .poll(
          async () =>
            (await api.alertingApi.getRuleGroups())
              .find((group) => group.name === name)
              ?.rules.find((rule) => rule.name === name)?.state,
          { intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES },
        )
        .toEqual('firing');
    });

    await pmmTest.step('The proxy refused no request', async () => {
      expect(accessControlHelper.countRefusals()).toEqual(refusalsBefore);
    });
  },
);

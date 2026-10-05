import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { DASHBOARDS } from '@testdata/dashboards.registry';
import { dataSourceRoutes, editor, viewer } from '@testdata/datasourceProxy';

const sweptFolders = ['Insight', 'MySQL', 'MongoDB', 'PostgreSQL', 'OS', 'Query Analytics'];
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
  async ({ accessControlHelper, api, dashboard, grafanaHelper, page }) => {
    pmmTest.setTimeout(Timeouts.THIRTY_MINUTES);

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

    for (const entry of DASHBOARDS.filter((d) => sweptFolders.includes(d.folder))) {
      await pmmTest.step(`Viewer opens ${entry.url}`, async () => {
        await page.goto(`pmm-ui/${entry.url}?from=now-1h&to=now`);
        await dashboard.loadAllPanels();
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
        data: {
          interval: '30s',
          name,
          rules: [
            {
              for: '0s',
              grafana_alert: {
                condition: 'A',
                data: [
                  {
                    datasourceUid: uid,
                    model: { expr: 'up{service_name=~".+"}', instant: true, refId: 'A' },
                    refId: 'A',
                    relativeTimeRange: { from: 600, to: 0 },
                  },
                ],
                exec_err_state: 'Error',
                no_data_state: 'NoData',
                title: name,
              },
            },
          ],
        },
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

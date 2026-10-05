import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import { ProxyUserIds } from '@helpers/accessControl.helper';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { admin, editor, fullAccessRoleTitle, noAccessRole } from '@testdata/datasourceProxy';

pmmTest.describe.configure({ mode: 'serial' });

let ids: ProxyUserIds;
let folderUid: string;
let metricsUid: string;
const ruleGroup = (name: string, datasourceUid: string) => ({
  interval: '1m',
  name,
  rules: [
    {
      for: '1m',
      grafana_alert: {
        condition: 'A',
        data: [
          {
            datasourceUid,
            model: { expr: 'up', instant: true, refId: 'A' },
            refId: 'A',
            relativeTimeRange: { from: 600, to: 0 },
          },
        ],
        exec_err_state: 'OK',
        no_data_state: 'OK',
        title: name,
      },
    },
  ],
});

pmmTest.beforeEach(async ({ accessControlHelper, api, grafanaHelper }) => {
  await grafanaHelper.authorize();
  ids = await accessControlHelper.setupUsers();
  metricsUid = (await accessControlHelper.getMetricsDataSource()).uid;
  folderUid = await api.grafanaApi.createFolder(`pmm-15379-${Date.now()}`);
});

pmmTest.afterEach(async ({ accessControlHelper, api }) => {
  await api.grafanaApi.deleteFolder(folderUid);
  await accessControlHelper.setAccessControl(true);
  await accessControlHelper.assignRole(ids.editor, fullAccessRoleTitle);
});

pmmTest(
  'PMM-T2351 - Verify alert rule groups named with # or ? can be opened, edited and deleted @LBAC',
  async ({ alertingPage, page }) => {
    for (const name of ['PMM-15379 #1', 'PMM-15379 ?2']) {
      const groupPath = `${apiEndpoints.grafana.ruler}/${folderUid}/${encodeURIComponent(name)}`;

      await pmmTest.step(`Create group "${name}"`, async () => {
        const response = await page.request.post(`${apiEndpoints.grafana.ruler}/${folderUid}`, {
          data: ruleGroup(name, metricsUid),
          headers: GrafanaHelper.getAuthHeader(),
        });

        expect(response.status(), await response.text()).toEqual(202);
      });

      await pmmTest.step(`Change the interval of "${name}" in the group editor`, async () => {
        await alertingPage.openRuleGroupEditor(folderUid, name);
        await alertingPage.builders.evaluationIntervalOption('30s').click();
        await alertingPage.buttons.save.click();

        await expect(async () => {
          const response = await page.request.get(groupPath, { headers: GrafanaHelper.getAuthHeader() });

          expect(response.status()).toEqual(202);
          expect((await response.json()).interval).toEqual('30s');
        }).toPass({ timeout: Timeouts.THIRTY_SECONDS });
      });

      await pmmTest.step(`Delete "${name}"`, async () => {
        const headers = GrafanaHelper.getAuthHeader();

        expect((await page.request.delete(groupPath, { headers })).status()).toEqual(202);
        expect((await page.request.get(groupPath, { headers })).status()).toEqual(404);
      });
    }
  },
);

pmmTest(
  'PMM-T2352 - Verify alert rule preview shows only the metrics the user may see @LBAC',
  async ({ accessControlHelper, alertingPage, api, grafanaHelper }) => {
    const proxyApi = api.datasourceProxyApi;
    const ruleTest = `/graph/api/v1/rule/test/${metricsUid}`;

    await accessControlHelper.assignRole(ids.editor, noAccessRole.title);

    await pmmTest.step('Admin preview shows every series', async () => {
      await alertingPage.openNewRuleWithQuery(metricsUid, 'up');
      expect(await alertingPage.runQueries()).toBeGreaterThan(0);
    });

    await pmmTest.step('Editor with no access sees no data', async () => {
      await grafanaHelper.signInAs(editor.username, editor.password);
      await alertingPage.openNewRuleWithQuery(metricsUid, 'up');
      expect(await alertingPage.runQueries()).toEqual(0);
      await expect(alertingPage.elements.queryNoData).toBeVisible();
    });

    await pmmTest.step('The data source-managed rule test is refused to the Editor only', async () => {
      expect((await proxyApi.post(ruleTest, editor, { expr: 'up' })).status).toEqual(403);
      expect((await proxyApi.post(ruleTest, admin, { expr: 'up' })).status).toEqual(200);
    });

    await pmmTest.step('With access control off the Editor may run it', async () => {
      await accessControlHelper.setAccessControl(false);
      expect((await proxyApi.post(ruleTest, editor, { expr: 'up' })).status).toEqual(200);
    });
  },
);

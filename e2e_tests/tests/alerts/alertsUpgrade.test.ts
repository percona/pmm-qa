import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';

pmmTest.describe('PMM Alerts tests for upgrade', () => {
  const upgradeRuleName = 'Alerting Upgrade Rule';

  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T577 - Verify user is able to create and see firing alerts before upgrade @pre-upgrade',
    async ({ alertStatusPage, api, page }) => {
      const folder = await api.alertingApi.getFolderByName('PMM Health');

      await api.alertingApi.createRule(GrafanaHelper.getAuthHeader(), {
        filters: [{ label: 'node_name', regexp: 'pmm-server', type: 'FILTER_TYPE_MATCH' }],
        folder_uid: folder.uid,
        for: '30s',
        group: 'upgrade test group',
        interval: '10s',
        name: upgradeRuleName,
        params: [{ float: 1, name: 'threshold', type: 'PARAM_TYPE_FLOAT' }],
        template_name: 'pmm_node_high_cpu_load',
      });

      await page.goto(alertStatusPage.url);
      await expect(alertStatusPage.builders.firingAlert(upgradeRuleName)).toBeVisible({
        timeout: Timeouts.TWO_MINUTES,
      });
    },
  );

  pmmTest(
    'PMM-T577 - Verify user is able to see firing alerts after upgrade @post-upgrade',
    async ({ alertStatusPage, page }) => {
      await page.goto(alertStatusPage.url);
      await expect(alertStatusPage.builders.firingAlert(upgradeRuleName)).toBeVisible({
        timeout: Timeouts.TWO_MINUTES,
      });
    },
  );
});

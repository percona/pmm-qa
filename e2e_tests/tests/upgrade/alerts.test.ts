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
      // PMM 3.7.0 has no built-in "PMM Health" alerting folder (added in a later
      // release); "Insight" is a default PMM folder present on 3.7.0.
      const folder = await api.alertingApi.getFolderByName('Insight');

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
});

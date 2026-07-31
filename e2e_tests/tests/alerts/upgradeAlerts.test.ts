import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';

pmmTest.describe('PMM Tests to verify external clickhouse', () => {
  const templateName = 'pmm_node_high_cpu_load';

  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest('PMM-T577 - Verify user is able create alert before upgrade @pre-upgrade', async ({ api, page }) => {
    const folder = await api.alertingApi.getFolderByName('PMM Health');
    const response = await api.alertingApi.createRule(GrafanaHelper.getAuthHeader(), {
      filters: [
        {
          label: 'node_name',
          regexp: 'pmm-server',
          type: 'FILTER_TYPE_MATCH',
        },
      ],
      folder_uid: folder.uid,
      for: '30s',
      group: 'Test',
      interval: '10s',
      name: 'Upgrade Alert',
      params: [
        {
          float: 1,
          name: 'threshold',
          type: 'PARAM_TYPE_FLOAT',
        },
      ],
      template_name: templateName,
    });

    console.log(await response.json());
    await page.waitForTimeout(30000);
    console.log(await api.alertingApi.getAlerts());
  });
});

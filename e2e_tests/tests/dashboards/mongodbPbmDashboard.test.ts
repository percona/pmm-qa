import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ api, request }) => {
  for (const { scheduled_backup_id } of await api.backupsApi.getScheduledBackups()) {
    const response = await request.delete(`${apiEndpoints.backups.removeScheduled}/${scheduled_backup_id}`, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), response.statusText()).toEqual(200);
  }

  for (const { location_id } of await api.backupsApi.getLocations()) {
    const response = await request.delete(`${apiEndpoints.backups.locations}/${location_id}`, {
      headers: GrafanaHelper.getAuthHeader(),
      params: { force: true },
    });

    expect(response.status(), response.statusText()).toEqual(200);
  }
});

for (const mode of ['BACKUP_MODE_PITR', 'BACKUP_MODE_SNAPSHOT'] as const) {
  pmmTest(
    `PMM-T2036 - Verify MongoDB PBM dashboard @pbm-nightly @gssapi-nightly | ${mode}`,
    async ({ api, dashboard, page, urlHelper }) => {
      const backupDetails = dashboard.mongo.backupDetails;
      const service = await api.inventoryApi.getServiceDetailsByRegexAndParameters('rs101', {
        cluster: 'replicaset',
      });

      await api.backupsApi.ensureMongoBackupData(service, mode);
      await page.goto(
        urlHelper.buildUrlWithParameters(backupDetails.url, {
          cluster: 'replicaset',
          from: 'now-30m',
          to: 'now',
        }),
      );
      await dashboard.waitForDashboardToLoad();
      await dashboard.verifyPanelTextAfterRefresh('Backup Configured', 'YES', Timeouts.ONE_MINUTE);
      await dashboard.verifyPanelTextAfterRefresh(
        'PITR Status',
        mode === 'BACKUP_MODE_PITR' ? 'ON' : 'OFF',
        Timeouts.ONE_MINUTE,
      );
      await dashboard.verifyMetricsPresent(backupDetails.metrics);
      await dashboard.verifyPanelTextAfterRefresh(
        'Last Successful Backup',
        /^(?!N\/A$)\S/,
        Timeouts.TWO_MINUTES,
      );
      await dashboard.verifyPanelHasDataAfterRefresh('Backup Sizes', Timeouts.TWO_MINUTES);
      await dashboard.verifyPanelHasDataAfterRefresh('Backup Duration', Timeouts.TWO_MINUTES);
      await dashboard.verifyAllPanelsHaveData(backupDetails.noDataMetrics);
    },
  );
}

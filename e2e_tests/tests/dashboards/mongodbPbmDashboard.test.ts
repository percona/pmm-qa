import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ api }) => {
  await api.backupsApi.removeAllScheduledBackups();
  await api.backupsApi.removeAllLocations();
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

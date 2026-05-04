Feature('Tests for: "MongoDB PBM Details" dashboard');

let locationId;
const backupTypes = ['BACKUP_MODE_PITR', 'BACKUP_MODE_SNAPSHOT'];

Before(async ({ I, locationsAPI }) => {
  await I.Authorize();
  locationId = await locationsAPI.createStorageLocation(
    'mongo-location-pbm-dashboard-test',
    locationsAPI.storageType.localClient,
    locationsAPI.localStorageDefaultConfig,
  );
});

After(async ({ scheduledAPI, locationsAPI }) => {
  await scheduledAPI.clearAllSchedules();
  await locationsAPI.clearAllLocations();
});

Data(backupTypes).Scenario('PMM-T2036 - Verify MongoDB PBM dashboard @nightly @gssapi-nightly', async ({
  I, current, dashboardPage, inventoryAPI, scheduledAPI, backupAPI,
}) => {
  // Preparation
  const service = await inventoryAPI.getServiceDetailsByPartialDetails({ cluster: 'replicaset', service_name: 'rs101' });
  const snapshotSchedule = {
    service_id: service.service_id,
    location_id: locationId,
    name: `test_schedule_pbm_${current}`,
    mode: current,
    cron_expression: '* * * * *',
  };

  await scheduledAPI.createScheduledBackup(snapshotSchedule);
  await backupAPI.waitForBackupArtifact(service.service_name, `test_schedule_pbm_${current}`);

  // Test
  const url = I.buildUrlWithParams(dashboardPage.mongodbBackupDetailsDashboard.url, {
    from: 'now-5m',
    cluster: current.cluster,
  });

  I.amOnPage(url);
  dashboardPage.waitForDashboardOpened();
  await dashboardPage.mongodbBackupDetailsDashboard.verifyBackupConfiguredValue('YES');
  await dashboardPage.mongodbBackupDetailsDashboard.verifyPitrEnabledValue(current === 'BACKUP_MODE_PITR' ? 'ON' : 'OFF');
  await dashboardPage.expandEachDashboardRow();
  await dashboardPage.verifyMetricsExistence(dashboardPage.mongodbBackupDetailsDashboard.metrics);
  await dashboardPage.verifyThereAreNoGraphsWithoutData();
});

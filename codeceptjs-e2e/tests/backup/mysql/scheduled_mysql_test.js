const moment = require('moment');
const { SERVICE_TYPE } = require('../../helper/constants');

const { psMySql } = inject();
const connection = psMySql.defaultConnection;
const location = {
  name: 'mysql_scheduled_backup_location',
  description: 'MySQL location for scheduling',
};
const mysqlServiceName = 'mysql-with-backup';
let locationId;
let serviceId;

Feature('BM: Mysql Scheduled backups');

BeforeSuite(async ({
  I, backupAPI, locationsAPI, settingsAPI, psMySql,
}) => {
  await settingsAPI.changeSettings({ backup: true });
  await backupAPI.clearAllArtifacts();
  await locationsAPI.clearAllLocations(true);
  locationId = await locationsAPI.createStorageLocation(
    location.name,
    locationsAPI.storageType.s3,
    locationsAPI.psStorageLocationConnection,
    location.description,
  );
  const mysqlComposeConnection = {
    host: '127.0.0.1',
    port: '3306',
    username: 'root',
    password: 'PMM_userk12456',
  };

  psMySql.connectToPS(mysqlComposeConnection);

  await I.say(await I.verifyCommand(`pmm-admin add mysql --username=${mysqlComposeConnection.username} --password=${mysqlComposeConnection.password} --query-source=perfschema ${mysqlServiceName}`));
});

Before(async ({
  I, settingsAPI, scheduledPage, inventoryAPI, scheduledAPI,
}) => {
  const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MYSQL, mysqlServiceName);

  serviceId = service_id;

  await I.Authorize();
  await settingsAPI.changeSettings({ backup: true });
  await scheduledAPI.clearAllSchedules();
  await scheduledPage.openScheduledBackupsPage();
});

AfterSuite(async ({ psMySql }) => {
  await psMySql.disconnectFromPS();
});

Scenario(
  '@PMM-T923 - Verify user is able to schedule a backup for MySQL @bm-mysql @not-ui-pipeline',
  async ({
    I, backupInventoryPage, scheduledAPI, backupAPI, scheduledPage,
  }) => {
    const schedule = {
      name: 'schedule_for_backup',
      retention: 1,
    };

    scheduledPage.openScheduleBackupModal();
    scheduledPage.selectDropdownOption(scheduledPage.fields.serviceNameDropdown, mysqlServiceName);
    I.fillField(scheduledPage.fields.backupName, schedule.name);
    scheduledPage.selectDropdownOption(scheduledPage.fields.locationDropdown, location.name);
    scheduledPage.selectDropdownOption(scheduledPage.fields.everyDropdown, 'Every minute');
    scheduledPage.clearRetentionField();
    I.fillField(scheduledPage.fields.retention, schedule.retention);

    // Verify mention about UTC time in create schedule modal
    I.seeTextEquals(
      scheduledPage.messages.scheduleInModalLabel,
      locate(scheduledPage.elements.scheduleBlockInModal).find('h6'),
    );
    I.click(scheduledPage.buttons.createSchedule);
    I.waitForVisible(scheduledPage.elements.scheduleName(schedule.name), 20);
    I.seeTextEquals('1 backup', scheduledPage.elements.retentionByName(schedule.name));

    // Verify local timestamp is shown in Last Backup column
    await scheduledAPI.waitForFirstExecution(schedule.name);
    scheduledPage.openScheduledBackupsPage();
    const lastBackup = await I.grabTextFrom(scheduledPage.elements.lastBackupByName(schedule.name));

    I.assertStartsWith(lastBackup, moment().format('YYYY-MM-DD'));
    I.assertEndsWith(lastBackup, moment().format('HH:mm:00'));

    await backupAPI.waitForBackupFinish(null, schedule.name, 300);
    const { scheduled_backup_id } = await scheduledAPI.getScheduleIdByName(schedule.name);

    await scheduledAPI.disableScheduledBackup(scheduled_backup_id);

    backupInventoryPage.verifyBackupSucceeded(schedule.name);
  },
);

const assert = require('assert');
const moment = require('moment');
const {
  SERVICE_TYPE,
  gssapi,
} = require('../helper/constants');

const { scheduledPage } = inject();

const location = {
  name: 'mongo-location-for-scheduling',
  description: 'test description',
};

let locationId;
let serviceId;
const mysqlServiceName = 'mysql-with-backup2';
const mongoServiceName = 'mongo-backup-schedule';
const mongoServiceName2 = 'mongo-pitr-test';
const mongoCluster = 'rs';
const clientCredentialsFlags = gssapi.enabled
  ? gssapi.credentials_flags
  : '--username=pmm --password=pmmpass';

const mongoNameWithoutCluster = 'mongo-schedule-no-cluster';
const scheduleErrors = new DataTable(['mode', 'serviceName', 'error']);

scheduleErrors.add(['PITR', mongoServiceName2, scheduledPage.messages.clusterHasPitrNoMoreAllowed(mongoCluster)]);
scheduleErrors.add(['PITR', mongoServiceName, scheduledPage.messages.clusterHasPitrNoMoreAllowed(mongoCluster)]);
scheduleErrors.add(['Full', mongoServiceName, scheduledPage.messages.snapshotNotAllowedWhenClusterHasPitr(mongoCluster)]);
scheduleErrors.add(['On Demand', mongoServiceName, scheduledPage.messages.snapshotNotAllowedWhenClusterHasPitr(mongoCluster)]);

const schedules = new DataTable(['cronExpression', 'name', 'frequency']);

schedules.add(['30 8 * * *', 'schedule_daily', 'At 08:30']);
schedules.add(['0 0 * * 2', 'schedule_weekly', 'At 00:00, only on Tuesday']);
schedules.add(['0 0 1 * *', 'schedule_monthly', 'At 00:00, on day 1 of the month']);
schedules.add(['0 1 1 9 2', 'schedule_odd', 'At 01:00, on day 1 of the month, and on Tuesday, only in September']);

const immortalScheduleName = 'immortal_schedule';

Feature('BM: Scheduled backups');

BeforeSuite(async ({
  I, backupAPI, locationsAPI, settingsAPI,
}) => {
  await settingsAPI.changeSettings({ backup: true });
  await backupAPI.clearAllArtifacts();
  await locationsAPI.clearAllLocations(true);
  locationId = await locationsAPI.createStorageLocation(
    location.name,
    locationsAPI.storageType.s3,
    locationsAPI.storageLocationConnection,
    location.description,
  );
  await I.mongoConnect({
    username: 'pmm',
    password: 'pmmpass',
    port: 27027,
  });

  I.say(await I.verifyCommand(`docker exec rs101 pmm-admin add mongodb ${clientCredentialsFlags} --host=rs101 --port=27017 --service-name=${mongoServiceName} --replication-set=rs --cluster=rs`));
  I.say(await I.verifyCommand(`docker exec rs102 pmm-admin add mongodb ${clientCredentialsFlags} --host=rs102 --port=27017 --service-name=${mongoServiceName2} --replication-set=rs --cluster=rs`));
  I.say(await I.verifyCommand(`docker exec rs103 pmm-admin add mongodb ${clientCredentialsFlags} --host=rs103 --port=27017 --service-name=${mongoNameWithoutCluster} --replication-set=rs`));
});

Before(async ({
  I, scheduledPage, inventoryAPI, scheduledAPI,
}) => {
  const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, mongoServiceName);

  serviceId = service_id;
  const c = await I.mongoGetCollection('test', 'test');

  await c.deleteMany({ number: 2 });

  await I.Authorize();
  await scheduledAPI.clearAllSchedules();
  await scheduledPage.openScheduledBackupsPage();
});

AfterSuite(async ({
  I,
}) => {
  await I.mongoDisconnect();
});

Scenario(
  'Verify message about no scheduled backups @backup @bm-mongo',
  async ({
    I, scheduledPage,
  }) => {
    I.waitForText('No scheduled backups found', 30, scheduledPage.elements.noData);
  },
);

Scenario(
  'PMM-T902 - Verify user is not able to schedule a backup without storage location @backup @bm-mongo',
  async ({
    I, scheduledPage,
  }) => {
    const scheduleName = 'schedule';

    scheduledPage.openScheduleBackupModal();
    scheduledPage.selectDropdownOption(scheduledPage.fields.serviceNameDropdown, mongoServiceName);
    I.seeTextEquals(mongoServiceName, scheduledPage.elements.selectedService);
    I.waitForValue(scheduledPage.fields.vendor, 'MongoDB', 5);

    scheduledPage.selectDropdownOption(scheduledPage.fields.locationDropdown, location.name);
    I.seeTextEquals(location.name, scheduledPage.elements.selectedLocation);

    I.seeElementsDisabled(scheduledPage.buttons.createSchedule);
    I.fillField(scheduledPage.fields.backupName, scheduleName);
    I.waitForEnabled(scheduledPage.buttons.createSchedule, 10);
  },
);

Scenario(
  'PMM-T954 + PMM-T952 + PMM-T956 + PMM-T958 + PMM-T1500 - Verify validation errors for retention and existing name @backup @bm-mongo',
  async ({
    I, scheduledPage, scheduledAPI,
  }) => {
    const scheduleName = 'new_schedule';
    const immortalSchedule = {
      service_id: serviceId,
      location_id: locationId,
      cron_expression: '0 0 * * *',
      name: 'immortal_schedule',
      mode: scheduledAPI.backupModes.snapshot,
      description: 'description',
      retry_interval: '30s',
      retries: 0,
      enabled: true,
      retention: 6,
    };

    await scheduledAPI.createScheduledBackup(immortalSchedule);

    scheduledPage.openScheduleBackupModal();
    scheduledPage.selectDropdownOption(scheduledPage.fields.serviceNameDropdown, mongoServiceName);

    scheduledPage.selectDropdownOption(scheduledPage.fields.locationDropdown, location.name);
    I.seeInField(scheduledPage.fields.retention, 7);

    scheduledPage.clearRetentionField();
    I.seeTextEquals(scheduledPage.messages.requiredField, scheduledPage.elements.retentionValidation);

    I.fillField(scheduledPage.fields.retention, 'q');
    I.seeTextEquals(scheduledPage.messages.requiredField, scheduledPage.elements.retentionValidation);

    I.fillField(scheduledPage.fields.retention, '-1');
    I.seeTextEquals(scheduledPage.messages.outOfRetentionRange, scheduledPage.elements.retentionValidation);

    I.fillField(scheduledPage.fields.retention, '100');
    I.seeTextEquals(scheduledPage.messages.outOfRetentionRange, scheduledPage.elements.retentionValidation);

    I.fillField(scheduledPage.fields.retention, '0.5');
    I.seeTextEquals('', scheduledPage.elements.retentionValidation);

    // Existing schedule name
    I.fillField(scheduledPage.fields.backupName, immortalScheduleName);
    I.click(scheduledPage.buttons.createSchedule);
    I.verifyPopUpMessage(`couldn't create task with name ${immortalScheduleName}: already exists`);

    // Non existing schedule name
    I.clearField(scheduledPage.fields.backupName);
    I.fillField(scheduledPage.fields.backupName, scheduleName);
    I.click(scheduledPage.buttons.createSchedule);

    I.verifyPopUpMessage(scheduledPage.messages.backupScheduled);
    I.waitForVisible(scheduledPage.elements.retentionByName(scheduleName), 20);
    I.seeTextEquals('Unlimited', scheduledPage.elements.retentionByName(scheduleName));
  },
);

Scenario(
  'PMM-T909 + PMM-T952 + PMM-T956 + PMM-T1501 - Verify user can update created scheduled backup @backup @bm-mongo',
  async ({
    I, scheduledPage, scheduledAPI,
  }) => {
    const newScheduleName = 'updated_schedule';
    const newScheduleDescr = 'new_description';
    const defaultFolder = 'replicaset';

    const schedule = {
      service_id: serviceId,
      location_id: locationId,
      folder: defaultFolder,
      cron_expression: '0 0 * * *',
      name: 'schedule_for_update',
      mode: scheduledAPI.backupModes.snapshot,
      description: 'description',
      retry_interval: '30s',
      retries: 0,
      enabled: true,
      retention: 6,
    };
    const immortalSchedule = {
      service_id: serviceId,
      location_id: locationId,
      folder: defaultFolder,
      cron_expression: '0 0 * * *',
      name: 'immortal_schedule',
      mode: scheduledAPI.backupModes.snapshot,
      description: 'description',
      retry_interval: '30s',
      retries: 0,
      enabled: true,
      retention: 6,
    };

    await scheduledAPI.createScheduledBackup(schedule);
    await scheduledAPI.createScheduledBackup(immortalSchedule);

    await scheduledPage.openScheduledBackupsPage();
    I.waitForVisible(scheduledPage.buttons.actionsMenuByName(schedule.name), 10);
    I.click(scheduledPage.buttons.actionsMenuByName(schedule.name));
    I.click(scheduledPage.buttons.editByName(schedule.name));

    I.waitForVisible(scheduledPage.fields.backupName, 30);
    I.clearField(scheduledPage.fields.backupName);
    I.fillField(scheduledPage.fields.backupName, immortalScheduleName);
    I.click(scheduledPage.buttons.createSchedule);
    I.verifyPopUpMessage(`couldn't change task name to ${immortalScheduleName}: already exists`);

    I.clearField(scheduledPage.fields.backupName);
    I.fillField(scheduledPage.fields.backupName, newScheduleName);

    I.clearField(scheduledPage.fields.description);
    I.fillField(scheduledPage.fields.description, newScheduleDescr);

    I.seeInField(scheduledPage.fields.retention, 6);

    scheduledPage.clearRetentionField();
    I.fillField(scheduledPage.fields.retention, '1');
    I.seeTextEquals('', scheduledPage.elements.retentionValidation);

    I.click(scheduledPage.buttons.createSchedule);

    I.waitForVisible(scheduledPage.elements.scheduleName(newScheduleName), 20);
    I.seeTextEquals('1 backup', scheduledPage.elements.retentionByName(newScheduleName));
  },
);

Scenario(
  'PMM-T913 + PMM-T922 + PMM-T977 - Verify user can schedule a backup for MongoDB with replica @backup @bm-mongo @bm-fb',
  async ({
    I, backupInventoryPage, scheduledAPI, backupAPI, scheduledPage,
  }) => {
    const schedule = {
      name: 'schedule_for_backup',
      retention: 1,
    };

    scheduledPage.openScheduleBackupModal();
    scheduledPage.selectDropdownOption(scheduledPage.fields.serviceNameDropdown, mongoServiceName);
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

Data(schedules).Scenario(
  'PMM-T899 + PMM-T903 + PMM-T904 + PMM-T905 + PMM-T907 - Verify user can create daily scheduled backup @backup @bm-mongo',
  async ({
    scheduledPage, scheduledAPI, current,
  }) => {
    const schedule = {
      service_id: serviceId,
      location_id: locationId,
      cron_expression: current.cronExpression,
      name: current.name,
      description: `Desc ${current.frequency}`,
      retention: 6,
    };
    const scheduleDetails = {
      name: current.name,
      vendor: 'MongoDB',
      frequency: current.frequency,
      description: schedule.description,
      retention: 6,
      type: 'Full',
      location: `${location.name} (S3)`,
      dataModel: 'Logical',
      cronExpression: current.cronExpression,
    };

    await scheduledAPI.createScheduledBackup(schedule);
    await scheduledPage.openScheduledBackupsPage();
    await scheduledPage.verifyBackupValues(scheduleDetails);
  },
);

Scenario(
  'PMM-T900 - Verify user can copy scheduled backup @backup @bm-mongo',
  async ({
    I, scheduledPage, scheduledAPI,
  }) => {
    const schedule = {
      service_id: serviceId,
      location_id: locationId,
      name: 'test_schedule_copy',
      description: 'some description',
      cron_expression: '0 0 * * *',
    };

    const newSchedule = {
      name: `Copy_of_${schedule.name}`,
      vendor: 'MongoDB',
      description: schedule.description,
      enabled: false,
      frequency: 'At 00:00',
      retention: 7,
      type: 'Full',
      location: `${location.name} (S3)`,
      dataModel: 'Logical',
      cronExpression: schedule.cron_expression,
    };

    await scheduledAPI.createScheduledBackup(schedule);
    await scheduledPage.openScheduledBackupsPage();

    scheduledPage.copySchedule(schedule.name);

    // Verify copied schedule details
    I.waitForVisible(scheduledPage.buttons.actionsMenuByName(newSchedule.name), 10);
    I.click(scheduledPage.buttons.actionsMenuByName(newSchedule.name));
    I.waitForVisible(scheduledPage.buttons.deleteByName(newSchedule.name), 10);
    await scheduledPage.verifyBackupValues(newSchedule);

    // Verify schedule is disabled after copy
    const isChecked = await I.grabAttributeFrom(scheduledPage.elements.toggleByName(newSchedule.name), 'checked');

    I.assertEqual(isChecked, null, `Element "${scheduledPage.elements.toggleByName(newSchedule.name).xpath}" is checked, but should not be.`);
  },
);

// TODO: unskip after https://perconadev.atlassian.net/browse/PMM-12988
Scenario.skip(
  'PMM-T908 - Verify user can enable/disable scheduled backup @backup @bm-mongo @bm-fb',
  async ({
    I, scheduledPage, scheduledAPI,
  }) => {
    const schedule = {
      service_id: serviceId,
      location_id: locationId,
      name: 'test_schedule_enable_disable',
      enabled: false,
    };

    await scheduledAPI.createScheduledBackup(schedule);
    await scheduledPage.openScheduledBackupsPage();

    // Verify schedule is disabled
    I.seeAttributesOnElements(scheduledPage.elements.toggleByName(schedule.name), { checked: null });

    // Grab background-color of a row
    const color = await I.grabCssPropertyFrom(scheduledPage.elements.scheduleTypeByName(schedule.name), 'background-color');

    // Enable schedule
    I.click(scheduledPage.buttons.enableDisableByName(schedule.name));
    I.seeAttributesOnElements(scheduledPage.elements.toggleByName(schedule.name), { checked: true });

    // Grab background-color of a row after enabling schedule
    const newColor = await I.grabCssPropertyFrom(scheduledPage.elements.scheduleTypeByName(schedule.name), 'background-color');

    assert.ok(color !== newColor, 'Background color should change after toggle');

    // Disable schedule
    I.click(scheduledPage.buttons.enableDisableByName(schedule.name));
    I.seeAttributesOnElements(scheduledPage.elements.toggleByName(schedule.name), { checked: null });

    // Verify the color is the same as before enabling
    I.seeCssPropertiesOnElements(scheduledPage.elements.scheduleTypeByName(schedule.name), { 'background-color': color });
  },
);

Scenario(
  'PMM-T901 - Verify user can delete scheduled backup @backup @bm-mongo',
  async ({
    I, scheduledPage, scheduledAPI,
  }) => {
    const schedule = {
      service_id: serviceId,
      location_id: locationId,
      name: 'test_schedule_delete',
    };

    await scheduledAPI.createScheduledBackup(schedule);
    await scheduledPage.openScheduledBackupsPage();

    scheduledPage.openDeleteModal(schedule.name);

    // Click Cancel button and verify schedule still exists
    I.click(scheduledPage.buttons.cancelDelete);
    I.waitForDetached(scheduledPage.elements.modalContent);
    I.seeElement(scheduledPage.buttons.actionsMenuByName(schedule.name));

    // Open Delete modal again and verify it has a correct schedule name in message
    scheduledPage.openDeleteModal(schedule.name);
    I.seeTextEquals(
      scheduledPage.messages.confirmDelete(schedule.name),
      locate(scheduledPage.elements.modalContent).find('h4'),
    );

    // Confirm delete and verify success message
    I.click(scheduledPage.buttons.confirmDelete);
    I.verifyPopUpMessage(scheduledPage.messages.successfullyDeleted(schedule.name));
  },
);

Scenario(
  '@PMM-T924 - Verify user is able to schedule a backup for MongoDB with replica & MySQL '
  + 'and try to run those backup schedule job in parallel @bm-common',
  async ({
    I, backupInventoryPage, scheduledAPI, backupAPI, inventoryAPI,
  }) => {
    await I.say(await I.verifyCommand(`pmm-admin add mysql --username=root --password=PMM_userk12456 --query-source=perfschema ${mysqlServiceName}`));
    // Every 2 mins schedule
    const scheduleMongo = {
      service_id: serviceId,
      location_id: locationId,
      cron_expression: '*/2 * * * *',
      name: 'Mongo_for_parallel_backup_test',
      mode: scheduledAPI.backupModes.snapshot,
      description: '',
      retry_interval: '30s',
      retries: 0,
      enabled: true,
      retention: 1,
    };
    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MYSQL, mysqlServiceName);
    const scheduleMySql = {
      service_id,
      location_id: locationId,
      cron_expression: '*/2 * * * *',
      name: 'mySQL_for_parallel_backup_test',
      mode: scheduledAPI.backupModes.snapshot,
      description: '',
      isLogical: false,
      retry_interval: '30s',
      retries: 0,
      enabled: true,
      retention: 1,
    };
    const mongoScheduleId = await scheduledAPI.createScheduledBackup(scheduleMongo);
    const mySqlScheduleId = await scheduledAPI.createScheduledBackup(scheduleMySql);

    await backupAPI.waitForBackupFinish(null, scheduleMySql.name, 240);
    await backupAPI.waitForBackupFinish(null, scheduleMongo.name, 120);
    await scheduledAPI.disableScheduledBackup(mongoScheduleId);
    await scheduledAPI.disableScheduledBackup(mySqlScheduleId);

    I.refreshPage();
    backupInventoryPage.verifyBackupSucceeded(scheduleMongo.name);
    backupInventoryPage.verifyBackupSucceeded(scheduleMySql.name);
  },
);

Data(scheduleErrors).Scenario(
  'PMM-T1031 + PMM-T1530 - Verify that user can\'t enable PITR together with any another backup type'
  + ' @backup @bm-mongo',
  async ({
    I, scheduledPage, scheduledAPI, current,
  }) => {
    const schedule = {
      service_id: serviceId,
      location_id: locationId,
      name: 'test_schedule_On_Demand',
      mode: scheduledAPI.backupModes.pitr,
    };

    await scheduledAPI.createScheduledBackup(schedule);
    await scheduledPage.openScheduledBackupsPage();

    scheduledPage.openScheduleBackupModal();
    scheduledPage.selectDropdownOption(scheduledPage.fields.serviceNameDropdown, current.serviceName);
    I.fillField(scheduledPage.fields.backupName, schedule.name);
    scheduledPage.selectDropdownOption(scheduledPage.fields.locationDropdown, location.name);
    if (current.mode === 'On Demand') {
      I.click(scheduledPage.buttons.backupOnDemand);
    } else {
      I.click(scheduledPage.buttons.backupTypeSwitch(current.mode));
    }

    I.click(scheduledPage.buttons.createSchedule);
    I.verifyPopUpMessage(current.error, 5);
  },
);

Scenario(
  '@PMM-T1517 Verify that BM Scheduler is more clear regarding frequency specification @backup @bm-common',
  async ({
    I, scheduledPage,
  }) => {
    scheduledPage.openScheduleBackupModal();
    I.seeTextEquals('Every year', scheduledPage.fields.schedule.scheduledTime);
    I.seeTextEquals('Every month', scheduledPage.fields.schedule.months);
    I.seeTextEquals('Every day', scheduledPage.fields.schedule.days);
    I.seeTextEquals('Every weekday', scheduledPage.fields.schedule.weekdays);
  },
);

Scenario(
  'PMM-T1527 - Verify BM Scheduler blocks mongo services that are not managed as cluster'
  + ' @backup @bm-mongo @bm-fb',
  async ({ I, scheduledPage }) => {
    const schedule = {
      name: 'test_no_cluster_error',
      retention: 1,
      folder: 'test',
    };

    scheduledPage.openScheduleBackupModal();
    scheduledPage.selectDropdownOption(scheduledPage.fields.serviceNameDropdown, mongoNameWithoutCluster);
    I.fillField(scheduledPage.fields.backupName, schedule.name);
    I.fillField(scheduledPage.fields.folder, schedule.folder);
    scheduledPage.selectDropdownOption(scheduledPage.fields.locationDropdown, location.name);
    scheduledPage.selectDropdownOption(scheduledPage.fields.everyDropdown, 'Every minute');
    scheduledPage.clearRetentionField();
    I.fillField(scheduledPage.fields.retention, schedule.retention);

    I.click(scheduledPage.buttons.createSchedule);

    I.verifyPopUpMessage(scheduledPage.messages.mustBeMemberOfCluster(mongoNameWithoutCluster), 5);
  },
);

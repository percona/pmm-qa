import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { ServiceType } from '@interfaces/inventory';

const location = { description: 'test description', name: 'mongo-location-for-scheduling' };
const mongoServiceName = 'mongo-backup-schedule';
const pitrServiceName = 'mongo-pitr-test';
const noClusterServiceName = 'mongo-schedule-no-cluster';
const immortalScheduleName = 'immortal_schedule';
const disabledRowBackground = 'rgb(17, 18, 23)';
const mongoServices = [
  { cluster: '--cluster=rs', member: 'rs101', name: mongoServiceName },
  { cluster: '--cluster=rs', member: 'rs102', name: pitrServiceName },
  { cluster: '', member: 'rs103', name: noClusterServiceName },
] as const;
const defaultSchedule = {
  cron_expression: '0 0 * * *',
  data_model: 'DATA_MODEL_LOGICAL',
  description: 'description',
  enabled: true,
  mode: 'BACKUP_MODE_SNAPSHOT',
  retention: 7,
  retries: 0,
  retry_interval: '30s',
} as const;
let backupManagementEnabled: boolean;
let locationId: string;
let serviceId: string;

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeAll(async ({ api, cliHelper }) => {
  backupManagementEnabled = (await api.settingsApi.getSettings()).settings.backup_management_enabled;
  await api.settingsApi.enableBackupManagement();
  await api.backupsApi.removeAllArtifacts();
  await api.backupsApi.removeAllLocations();
  locationId = await api.backupsApi.addS3Location(location.name, location.description);

  for (const { cluster, member, name } of mongoServices) {
    cliHelper.removeService(member, ServiceType.mongodb, name);
    cliHelper
      .execute(
        `docker exec ${member} pmm-admin add mongodb ${process.env.WIZARD_ARGS?.includes('GSSAPI') ? '--username="pmm@PERCONATEST.COM" --password=password1 --authentication-mechanism=GSSAPI --authentication-database="$external"' : '--username=pmm --password=pmmpass'} --host=${member} --port=27017 --service-name=${name} --replication-set=rs ${cluster}`,
      )
      .assertSuccess();
  }

  serviceId = (
    await api.inventoryApi.getServiceDetailsByTypeAndPartialName(ServiceType.mongodb, mongoServiceName)
  ).service_id;
});

pmmTest.beforeEach(async ({ api, grafanaHelper, mongoDbHelper, scheduledBackupsPage }) => {
  await mongoDbHelper.getCollection('test', 'test').deleteMany({ number: 2 });
  await grafanaHelper.authorize();
  await api.backupsApi.removeAllScheduledBackups();
  await scheduledBackupsPage.open();
});

pmmTest.afterEach(async ({ api }) => {
  await api.backupsApi.removeAllScheduledBackups();
});

pmmTest.afterAll(async ({ api, cliHelper }) => {
  await api.backupsApi.removeAllArtifacts();
  await api.backupsApi.removeAllLocations();

  for (const { member, name } of mongoServices) cliHelper.removeService(member, ServiceType.mongodb, name);

  await api.settingsApi.updateSettings({ enable_backup_management: backupManagementEnabled });
});

pmmTest(
  'PMM-T2628 - Verify message about no scheduled backups @bm-mongo',
  async ({ scheduledBackupsPage }) => {
    await expect(scheduledBackupsPage.elements.noData).toContainText('No scheduled backups found', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

pmmTest(
  'PMM-T902 - Verify user is not able to schedule a backup without storage location @bm-mongo',
  async ({ backupInventoryPage, scheduledBackupsPage }) => {
    await scheduledBackupsPage.openScheduleForm();

    await pmmTest.step('Select the service and name the schedule', async () => {
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.service, mongoServiceName);
      await expect(backupInventoryPage.inputs.service).toHaveText(mongoServiceName);
      await expect(backupInventoryPage.inputs.vendor).toHaveValue('MongoDB');
      await backupInventoryPage.inputs.backupName.fill('schedule');
    });

    await expect(backupInventoryPage.buttons.createBackup).toBeDisabled();

    await pmmTest.step('Select the location', async () => {
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.location, location.name);
      await expect(backupInventoryPage.inputs.location).toHaveText(location.name);
    });

    await expect(backupInventoryPage.buttons.createBackup).toBeEnabled({ timeout: Timeouts.TEN_SECONDS });
  },
);

pmmTest(
  'PMM-T954 + PMM-T952 + PMM-T956 + PMM-T958 + PMM-T1500 - Verify validation errors for retention and existing name @bm-mongo',
  async ({ api, backupInventoryPage, scheduledBackupsPage }) => {
    const scheduleName = 'new_schedule';

    await api.backupsApi.createScheduledBackup({
      ...defaultSchedule,
      location_id: locationId,
      name: immortalScheduleName,
      retention: 6,
      service_id: serviceId,
    });

    await pmmTest.step('Select the service and location', async () => {
      await scheduledBackupsPage.openScheduleForm();
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.service, mongoServiceName);
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.location, location.name);
      await expect(scheduledBackupsPage.inputs.retention).toHaveValue('7');
    });

    await pmmTest.step('Verify the retention validation', async () => {
      await scheduledBackupsPage.inputs.retention.fill('');
      await expect(scheduledBackupsPage.elements.retentionError).toHaveText('Required field');
      await scheduledBackupsPage.inputs.retention.pressSequentially('q');
      await expect(scheduledBackupsPage.elements.retentionError).toHaveText('Required field');

      for (const retention of ['-1', '100']) {
        await scheduledBackupsPage.inputs.retention.fill(retention);
        await expect(scheduledBackupsPage.elements.retentionError).toHaveText(
          'Value should be in the range from 0 to 99',
        );
      }

      await scheduledBackupsPage.inputs.retention.fill('0.5');
      await expect(scheduledBackupsPage.elements.retentionError).toBeEmpty();
    });

    await pmmTest.step('Verify a schedule cannot reuse an existing name', async () => {
      await backupInventoryPage.inputs.backupName.fill(immortalScheduleName);
      await backupInventoryPage.buttons.createBackup.click();
      await expect(backupInventoryPage.messages.popUp).toContainText(
        `couldn't create task with name ${immortalScheduleName}: already exists`,
        { timeout: Timeouts.THIRTY_SECONDS },
      );
      await backupInventoryPage.buttons.closeAlert.click();
    });

    await pmmTest.step('Schedule the backup under a new name', async () => {
      await backupInventoryPage.inputs.backupName.fill(scheduleName);
      await backupInventoryPage.buttons.createBackup.click();
      await expect(backupInventoryPage.messages.popUp).toContainText('Backup successfully scheduled', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
    });

    await expect(scheduledBackupsPage.builders.cell(scheduleName, 'retention')).toBeVisible({
      timeout: Timeouts.TWENTY_SECONDS,
    });
    await expect(scheduledBackupsPage.builders.cell(scheduleName, 'retention')).toHaveText('Unlimited');
  },
);

pmmTest(
  'PMM-T909 + PMM-T952 + PMM-T956 + PMM-T1501 - Verify user can update created scheduled backup @bm-mongo',
  async ({ api, backupInventoryPage, scheduledBackupsPage }) => {
    const scheduleName = 'schedule_for_update';
    const newScheduleName = 'updated_schedule';

    for (const name of [scheduleName, immortalScheduleName]) {
      await api.backupsApi.createScheduledBackup({
        ...defaultSchedule,
        location_id: locationId,
        name,
        retention: 6,
        service_id: serviceId,
      });
    }

    await scheduledBackupsPage.open();
    await scheduledBackupsPage.openEditForm(scheduleName);
    await expect(backupInventoryPage.inputs.backupName).toHaveValue(scheduleName, {
      timeout: Timeouts.THIRTY_SECONDS,
    });

    await pmmTest.step('Verify a schedule cannot be renamed to an existing name', async () => {
      await backupInventoryPage.inputs.backupName.fill(immortalScheduleName);
      await backupInventoryPage.buttons.createBackup.click();
      await expect(backupInventoryPage.messages.popUp).toContainText(
        `couldn't change task name to ${immortalScheduleName}: already exists`,
        { timeout: Timeouts.THIRTY_SECONDS },
      );
    });

    await pmmTest.step('Change the name, description and retention', async () => {
      await backupInventoryPage.inputs.backupName.fill(newScheduleName);
      await scheduledBackupsPage.inputs.description.fill('new_description');
      await expect(scheduledBackupsPage.inputs.retention).toHaveValue('6');
      await scheduledBackupsPage.inputs.retention.fill('1');
      await expect(scheduledBackupsPage.elements.retentionError).toBeEmpty();
      await backupInventoryPage.buttons.createBackup.click();
    });

    await expect(scheduledBackupsPage.builders.row(newScheduleName)).toBeVisible({
      timeout: Timeouts.TWENTY_SECONDS,
    });
    await expect(scheduledBackupsPage.builders.cell(newScheduleName, 'retention')).toHaveText('1 backup');
  },
);

pmmTest(
  'PMM-T913 + PMM-T922 + PMM-T977 - Verify user can schedule a backup for MongoDB with replica @bm-mongo',
  async ({ api, backupInventoryPage, scheduledBackupsPage }) => {
    const scheduleName = 'schedule_for_backup';

    await pmmTest.step('Schedule a backup every minute', async () => {
      await scheduledBackupsPage.openScheduleForm();
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.service, mongoServiceName);
      await backupInventoryPage.inputs.backupName.fill(scheduleName);
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.location, location.name);
      await backupInventoryPage.selectFromDropdown(
        scheduledBackupsPage.builders.scheduleField('period'),
        'Every minute',
      );
      await scheduledBackupsPage.inputs.retention.fill('1');
      await expect(scheduledBackupsPage.elements.scheduleHint).toHaveText('UTC time');
      await backupInventoryPage.buttons.createBackup.click();
    });

    await expect(scheduledBackupsPage.builders.row(scheduleName)).toBeVisible({
      timeout: Timeouts.TWENTY_SECONDS,
    });
    await expect(scheduledBackupsPage.builders.cell(scheduleName, 'retention')).toHaveText('1 backup');

    await pmmTest.step('Verify the last backup shows the local time of the first run', async () => {
      await expect
        .poll(
          async () =>
            (await api.backupsApi.getScheduledBackups()).find(({ name }) => name === scheduleName)?.last_run,
          {
            intervals: [Timeouts.FIVE_SECONDS],
            message: 'The schedule should run for the first time',
            timeout: Timeouts.TWO_MINUTES,
          },
        )
        .toMatch(/\S/);
      await scheduledBackupsPage.open();

      const now = new Date();
      const minute = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

      await expect(scheduledBackupsPage.builders.lastBackup(scheduleName)).toHaveText(
        new RegExp(`^${now.toLocaleDateString('sv-SE')}.*${minute}:00$`),
      );
    });

    await api.backupsApi.verifyBackupStatus(scheduleName, 'BACKUP_STATUS_SUCCESS');

    const scheduleId = (await api.backupsApi.getScheduledBackups()).find(
      ({ name }) => name === scheduleName,
    )?.scheduled_backup_id;

    expect(scheduleId, 'The schedule created in the UI must be listed').toMatch(/\S/);
    await api.backupsApi.disableScheduledBackup(scheduleId ?? '');
    await backupInventoryPage.verifyBackupStatus(scheduleName, 'BACKUP_STATUS_SUCCESS');
  },
);

for (const { cronExpression, frequency, name } of [
  { cronExpression: '30 8 * * *', frequency: 'At 08:30', name: 'schedule_daily' },
  { cronExpression: '0 0 * * 2', frequency: 'At 00:00, only on Tuesday', name: 'schedule_weekly' },
  { cronExpression: '0 0 1 * *', frequency: 'At 00:00, on day 1 of the month', name: 'schedule_monthly' },
  {
    cronExpression: '0 1 1 9 2',
    frequency: 'At 01:00, on day 1 of the month, and on Tuesday, only in September',
    name: 'schedule_odd',
  },
] as const) {
  pmmTest(
    `PMM-T899 + PMM-T903 + PMM-T904 + PMM-T905 + PMM-T907 - Verify user can create daily scheduled backup @bm-mongo | ${name}`,
    async ({ api, scheduledBackupsPage }) => {
      await api.backupsApi.createScheduledBackup({
        ...defaultSchedule,
        cron_expression: cronExpression,
        description: `Desc ${frequency}`,
        location_id: locationId,
        name,
        retention: 6,
        service_id: serviceId,
      });
      await scheduledBackupsPage.open();
      await expect(scheduledBackupsPage.builders.row(name)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await scheduledBackupsPage.verifyScheduleValues({
        cronExpression,
        dataModel: 'Logical',
        description: `Desc ${frequency}`,
        frequency,
        location: `${location.name} (S3)`,
        name,
        retention: 6,
        type: 'Full',
        vendor: 'MongoDB',
      });
    },
  );
}

pmmTest(
  'PMM-T900 - Verify user can copy scheduled backup @bm-mongo',
  async ({ api, scheduledBackupsPage }) => {
    const scheduleName = 'test_schedule_copy';
    const copyName = `Copy_of_${scheduleName}`;

    await api.backupsApi.createScheduledBackup({
      ...defaultSchedule,
      description: 'some description',
      location_id: locationId,
      name: scheduleName,
      service_id: serviceId,
    });
    await scheduledBackupsPage.open();
    await scheduledBackupsPage.copySchedule(scheduleName);

    await pmmTest.step('Verify the copied schedule details', async () => {
      await scheduledBackupsPage.builders.actionsToggle(copyName).click();
      await expect(scheduledBackupsPage.builders.deleteButton(copyName)).toBeVisible({
        timeout: Timeouts.TEN_SECONDS,
      });
      await scheduledBackupsPage.verifyScheduleValues({
        cronExpression: defaultSchedule.cron_expression,
        dataModel: 'Logical',
        description: 'some description',
        frequency: 'At 00:00',
        location: `${location.name} (S3)`,
        name: copyName,
        retention: 7,
        type: 'Full',
        vendor: 'MongoDB',
      });
    });

    await expect(scheduledBackupsPage.builders.toggle(copyName)).not.toBeChecked();
  },
);

// eslint-disable-next-line playwright/no-skipped-test -- PMM-12988: enabling and disabling a schedule is among the open PMM3 backup management bugs; unskip once PMM-12988 is fixed.
pmmTest.skip(
  'PMM-T908 - Verify user can enable/disable scheduled backup @bm-mongo',
  async ({ api, scheduledBackupsPage }) => {
    const scheduleName = 'test_schedule_enable_disable';
    const typeCell = scheduledBackupsPage.builders.cell(scheduleName, 'type');

    await api.backupsApi.createScheduledBackup({
      ...defaultSchedule,
      enabled: false,
      location_id: locationId,
      name: scheduleName,
      service_id: serviceId,
    });
    await scheduledBackupsPage.open();
    await expect(scheduledBackupsPage.builders.toggle(scheduleName)).not.toBeChecked();
    await expect(typeCell).toHaveCSS('background-color', disabledRowBackground);

    await pmmTest.step('Enable the schedule', async () => {
      await scheduledBackupsPage.builders.toggle(scheduleName).click();
      await expect(scheduledBackupsPage.builders.toggle(scheduleName)).toBeChecked();
      await expect(typeCell).not.toHaveCSS('background-color', disabledRowBackground);
    });

    await pmmTest.step('Disable the schedule', async () => {
      await scheduledBackupsPage.builders.toggle(scheduleName).click();
      await expect(scheduledBackupsPage.builders.toggle(scheduleName)).not.toBeChecked();
      await expect(typeCell).toHaveCSS('background-color', disabledRowBackground);
    });
  },
);

pmmTest(
  'PMM-T901 - Verify user can delete scheduled backup @bm-mongo',
  async ({ api, backupInventoryPage, scheduledBackupsPage }) => {
    const scheduleName = 'test_schedule_delete';

    await api.backupsApi.createScheduledBackup({
      ...defaultSchedule,
      location_id: locationId,
      name: scheduleName,
      service_id: serviceId,
    });
    await scheduledBackupsPage.open();

    await pmmTest.step('Cancel the delete and verify the schedule stays', async () => {
      await scheduledBackupsPage.openDeleteModal(scheduleName);
      await expect(scheduledBackupsPage.buttons.confirmDelete).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await scheduledBackupsPage.buttons.cancelDelete.click();
      await expect(scheduledBackupsPage.elements.modalContent).toBeHidden();
      await expect(scheduledBackupsPage.builders.actionsToggle(scheduleName)).toBeVisible();
    });

    await pmmTest.step('Delete the schedule', async () => {
      await scheduledBackupsPage.openDeleteModal(scheduleName);
      await expect(scheduledBackupsPage.buttons.confirmDelete).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await expect(scheduledBackupsPage.elements.deleteMessage).toHaveText(
        `Are you sure you want to delete the scheduled backup "${scheduleName}"?`,
      );
      await scheduledBackupsPage.buttons.confirmDelete.click();
      await expect(backupInventoryPage.messages.popUp).toContainText(
        `Scheduled backup "${scheduleName}" successfully deleted.`,
        { timeout: Timeouts.THIRTY_SECONDS },
      );
    });
  },
);

// eslint-disable-next-line playwright/no-skipped-test -- PMM-15916: pmm-managed drops one of two scheduled backups that fire together; unskip once PMM-15916 is fixed.
pmmTest.skip(
  'PMM-T924 - Verify user is able to schedule a backup for MongoDB with replica & MySQL and try to run those backup schedule job in parallel @bm-common',
  async ({ api, backupInventoryPage }) => {
    const mongoSchedule = {
      ...defaultSchedule,
      cron_expression: '*/2 * * * *',
      description: '',
      location_id: locationId,
      name: 'Mongo_for_parallel_backup_test',
      retention: 1,
      service_id: serviceId,
    };
    const mysqlService = await api.inventoryApi.getServiceDetailsByRegex('^ps_pmm_\\d');

    expect(mysqlService.cluster, 'pmm-framework must register the PS 8.4 service in a cluster').toMatch(/\S/);

    const mysqlSchedule = {
      ...mongoSchedule,
      data_model: 'DATA_MODEL_PHYSICAL',
      folder: mysqlService.cluster,
      name: 'mySQL_for_parallel_backup_test',
      service_id: mysqlService.service_id,
    } as const;
    const scheduleIds = [
      await api.backupsApi.createScheduledBackup(mongoSchedule),
      await api.backupsApi.createScheduledBackup(mysqlSchedule),
    ];

    await api.backupsApi.verifyBackupStatus(mysqlSchedule.name, 'BACKUP_STATUS_SUCCESS');
    await api.backupsApi.verifyBackupStatus(mongoSchedule.name, 'BACKUP_STATUS_SUCCESS');

    for (const scheduleId of scheduleIds) await api.backupsApi.disableScheduledBackup(scheduleId);

    await backupInventoryPage.verifyBackupStatus(mongoSchedule.name, 'BACKUP_STATUS_SUCCESS');
    await backupInventoryPage.verifyBackupStatus(mysqlSchedule.name, 'BACKUP_STATUS_SUCCESS');
  },
);

for (const [mode, serviceName] of [
  ['PITR', pitrServiceName],
  ['PITR', mongoServiceName],
  ['Full', mongoServiceName],
  ['On Demand', mongoServiceName],
] as const) {
  pmmTest(
    `PMM-T1031 + PMM-T1530 - Verify that user can't enable PITR together with any another backup type @bm-mongo | ${mode} ${serviceName}`,
    async ({ api, backupInventoryPage, scheduledBackupsPage }) => {
      const scheduleName = 'test_schedule_On_Demand';

      await api.backupsApi.createScheduledBackup({
        ...defaultSchedule,
        location_id: locationId,
        mode: 'BACKUP_MODE_PITR',
        name: scheduleName,
        service_id: serviceId,
      });

      await pmmTest.step('Fill the backup form', async () => {
        await scheduledBackupsPage.openScheduleForm();
        await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.service, serviceName);
        await backupInventoryPage.inputs.backupName.fill(scheduleName);
        await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.location, location.name);
      });

      if (mode === 'On Demand') {
        await scheduledBackupsPage.buttons.onDemand.click();
      } else {
        await scheduledBackupsPage.builders.mode(mode).click();
      }

      await backupInventoryPage.buttons.createBackup.click();
      await expect(backupInventoryPage.messages.popUp).toContainText(
        mode === 'PITR'
          ? "A PITR backup for the cluster 'rs' can be enabled only if there are no other scheduled backups for this cluster."
          : "A snapshot backup for cluster 'rs' can be performed only if there is no enabled PITR backup for this cluster.",
      );
    },
  );
}

pmmTest(
  'PMM-T1517 - Verify that BM Scheduler is more clear regarding frequency specification @bm-common @bm-mongo',
  async ({ scheduledBackupsPage }) => {
    await scheduledBackupsPage.openScheduleForm();
    await expect(scheduledBackupsPage.builders.scheduleField('period')).toHaveText('Every year');
    await expect(scheduledBackupsPage.builders.scheduleField('month')).toHaveText('Every month');
    await expect(scheduledBackupsPage.builders.scheduleField('day')).toHaveText('Every day');
    await expect(scheduledBackupsPage.builders.scheduleField('weekDay')).toHaveText('Every weekday');
  },
);

pmmTest(
  'PMM-T1527 - Verify BM Scheduler blocks mongo services that are not managed as cluster @bm-mongo',
  async ({ backupInventoryPage, scheduledBackupsPage }) => {
    await pmmTest.step('Schedule a backup of a service outside a cluster', async () => {
      await scheduledBackupsPage.openScheduleForm();
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.service, noClusterServiceName);
      await backupInventoryPage.inputs.backupName.fill('test_no_cluster_error');
      await scheduledBackupsPage.inputs.folder.fill('test');
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.location, location.name);
      await backupInventoryPage.selectFromDropdown(
        scheduledBackupsPage.builders.scheduleField('period'),
        'Every minute',
      );
      await scheduledBackupsPage.inputs.retention.fill('1');
      await backupInventoryPage.buttons.createBackup.click();
    });

    await expect(backupInventoryPage.messages.popUp).toContainText(
      `Service ${noClusterServiceName} must be a member of a cluster`,
    );
  },
);

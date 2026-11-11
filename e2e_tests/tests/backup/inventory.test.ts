import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { ServiceType } from '@interfaces/inventory';

const s3Location = { description: 'test description', name: 'mongo-location' };
const localLocationName = 'mongoLocation';
const replicaSetMembers = ['rs101', 'rs102', 'rs103'];
const healthyMemberStates = ['PRIMARY', 'SECONDARY', 'SECONDARY'];
const mongoServiceName = 'mongo-backup-inventory-1';
const deletedServiceName = 'mongo-service-to-delete';
const remoteServiceName = 'mongo-binary-test';
const credentialsFlags = process.env.WIZARD_ARGS?.includes('GSSAPI')
  ? '--username="pmm@PERCONATEST.COM" --password=password1 --authentication-mechanism=GSSAPI --authentication-database="$external"'
  : '--username=pmm --password=pmmpass';
let backupManagementEnabled: boolean;
let localLocationId: string;
let s3LocationId: string;
let serviceId: string;

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeAll(async ({ api, cliHelper }) => {
  backupManagementEnabled = (await api.settingsApi.getSettings()).settings.backup_management_enabled;
  await api.settingsApi.enableBackupManagement();
  await api.backupsApi.removeAllLocations();
  localLocationId = await api.backupsApi.addLocalLocation(localLocationName);
  s3LocationId = await api.backupsApi.addS3Location(s3Location.name, s3Location.description);

  for (const [index, member] of replicaSetMembers.entries()) {
    const serviceName = `mongo-backup-inventory-${index + 1}`;

    cliHelper.removeService(member, ServiceType.mongodb, serviceName);
    cliHelper
      .execute(
        `docker exec ${member} pmm-admin add mongodb ${credentialsFlags} --host=${member} --port=27017 --service-name=${serviceName} --replication-set=rs --cluster=rs`,
      )
      .assertSuccess();
  }

  serviceId = (
    await api.inventoryApi.getServiceDetailsByTypeAndPartialName(ServiceType.mongodb, mongoServiceName)
  ).service_id;
});

pmmTest.beforeEach(async ({ api, backupInventoryPage, grafanaHelper, mongoDbHelper }) => {
  await expect(async () => {
    expect(await mongoDbHelper.getReplicaSetMemberStates()).toEqual(healthyMemberStates);
    await mongoDbHelper.getCollection('test', 'test').deleteMany({ number: 2 });
  }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
  await grafanaHelper.authorize();
  await api.backupsApi.removeAllArtifacts();
  await backupInventoryPage.open();
});

pmmTest.afterEach(async ({ api, cliHelper }) => {
  for (const member of replicaSetMembers) {
    cliHelper.execute(`docker exec ${member} systemctl start mongod`).assertSuccess();
  }

  await api.backupsApi.removeAllScheduledBackups();
  await api.backupsApi.removeAllArtifacts();
  cliHelper.removeService('rs101', ServiceType.mongodb, deletedServiceName);
  await api.inventoryApi.removeNodesByName([remoteServiceName]);
});

pmmTest.afterAll(async ({ api, cliHelper }) => {
  await api.backupsApi.removeAllLocations();

  for (const [index, member] of replicaSetMembers.entries()) {
    cliHelper.removeService(member, ServiceType.mongodb, `mongo-backup-inventory-${index + 1}`);
  }

  await api.settingsApi.updateSettings({ enable_backup_management: backupManagementEnabled });
});

pmmTest(
  'PMM-T691 - Verify message about no backups in inventory @bm-mongo',
  async ({ backupInventoryPage }) => {
    await expect(backupInventoryPage.elements.noData).toContainText('No backups found', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

for (const locationName of [s3Location.name, localLocationName]) {
  pmmTest(
    `PMM-T855 + PMM-T1393 - Verify user is able to perform MongoDB backup @bm-mongo | ${locationName}`,
    async ({ backupInventoryPage, cliHelper }) => {
      const backupName = `mongo_backup_test_${locationName}`;

      await pmmTest.step('Create the backup', async () => {
        await backupInventoryPage.buttons.createBackup.click();
        await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.service, mongoServiceName);
        await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.location, locationName);
        await backupInventoryPage.inputs.backupName.fill(backupName);
        await backupInventoryPage.submitBackup();
        await expect(backupInventoryPage.builders.pendingStatus(backupName)).toBeVisible({
          timeout: Timeouts.TEN_SECONDS,
        });
      });

      await backupInventoryPage.verifyBackupStatus(backupName, 'BACKUP_STATUS_SUCCESS');

      if (locationName === localLocationName) cliHelper.execute('ls -la /tmp/backup_data/rs').assertSuccess();
    },
  );
}

pmmTest(
  'PMM-T961 + PMM-T1005 + PMM-T1024 - Verify create backup modal @bm-mongo',
  async ({ backupInventoryPage }) => {
    await backupInventoryPage.buttons.createBackup.click();

    await pmmTest.step('Select the service and location', async () => {
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.service, mongoServiceName);
      await expect(backupInventoryPage.inputs.service).toHaveText(mongoServiceName);
      await expect(backupInventoryPage.inputs.vendor).toHaveValue('MongoDB');
      await expect(backupInventoryPage.inputs.vendor).toBeDisabled();
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.location, s3Location.name);
      await expect(backupInventoryPage.inputs.location).toHaveText(s3Location.name);
    });

    await pmmTest.step('Verify the retry defaults and the retry modes', async () => {
      await backupInventoryPage.buttons.advancedSettings.click();
      await expect(backupInventoryPage.inputs.retryTimes).toHaveValue('2');
      await expect(backupInventoryPage.inputs.retryInterval).toHaveValue('30');
      await expect(backupInventoryPage.inputs.retryTimes).toBeDisabled();
      await backupInventoryPage.builders.retryMode('Auto').click();
      await expect(backupInventoryPage.inputs.retryTimes).toBeEnabled({ timeout: Timeouts.TEN_SECONDS });
      await expect(backupInventoryPage.inputs.retryInterval).toBeEnabled({ timeout: Timeouts.TEN_SECONDS });
      await backupInventoryPage.builders.retryMode('Manual').click();
      await expect(backupInventoryPage.inputs.retryTimes).toBeDisabled();
      await expect(backupInventoryPage.inputs.retryInterval).toBeDisabled();
    });

    await pmmTest.step('Verify a backup name enables the submit button', async () => {
      await expect(backupInventoryPage.buttons.createBackup).toBeDisabled();
      await backupInventoryPage.inputs.backupName.fill('backup_modal_test');
      await expect(backupInventoryPage.buttons.createBackup).toBeEnabled({ timeout: Timeouts.TEN_SECONDS });
    });
  },
);

for (const dataModel of ['PHYSICAL', 'LOGICAL'] as const) {
  for (const storageType of ['s3_config', 'filesystem_config'] as const) {
    pmmTest(
      `PMM-T862 + PMM-T1508 + PMM-T1393 + PMM-T1394 + PMM-T1520 + PMM-T1452 + PMM-T1583 + PMM-T1674 + PMM-T1675 - Verify user is able to perform MongoDB restore from different storage locations @bm-mongo | ${storageType}-${dataModel}`,
      async ({ api, backupInventoryPage, cliHelper, mongoDbHelper }) => {
        const backupName = `mongo-restore-${storageType}-${dataModel}`;
        const isLocal = storageType === 'filesystem_config';
        const locationId = isLocal ? localLocationId : s3LocationId;
        const artifactId = await api.backupsApi.startBackup(backupName, serviceId, locationId, {
          data_model: `DATA_MODEL_${dataModel}`,
        });

        await api.backupsApi.verifyBackupSuccess(artifactId);
        await backupInventoryPage.verifyBackupStatus(backupName, 'BACKUP_STATUS_SUCCESS');

        const artifactName =
          (await backupInventoryPage.builders.artifactName(backupName).textContent()) ?? '';

        expect(artifactName, 'The backup must be listed under its artifact name').toMatch(/\S/);

        if (isLocal) cliHelper.execute('ls -la /tmp/backup_data/rs').assertSuccess();

        await pmmTest.step('Restore the backup over a newer document', async () => {
          await mongoDbHelper.getCollection('test', 'test').insertOne({ name: 'Anna', number: 2 });
          await backupInventoryPage.startRestore(artifactName);
          await backupInventoryPage.open(backupInventoryPage.urls.restoreHistory);
          await expect(backupInventoryPage.builders.targetService(artifactName)).toHaveText(
            mongoServiceName,
            {
              timeout: Timeouts.TEN_SECONDS,
            },
          );
          await backupInventoryPage.verifyRestoreStatus(artifactName, 'RESTORE_STATUS_SUCCESS');
        });

        await expect
          .poll(() => mongoDbHelper.getReplicaSetMemberStates(), {
            message: 'Every replica set member must be back after the restore',
            timeout: Timeouts.FIVE_MINUTES,
          })
          .toEqual(healthyMemberStates);
        expect(
          await mongoDbHelper.getCollection('test', 'test').findOne({ name: 'Anna', number: 2 }),
          'The restore must remove the document inserted after the backup',
        ).toBeNull();

        await pmmTest.step('Verify the restore started and finished today', async () => {
          const today = new RegExp(`^${new Date().toLocaleDateString('sv-SE')}`);

          await expect(backupInventoryPage.builders.restoreStarted(artifactName)).toHaveText(today);
          await expect(backupInventoryPage.builders.restoreFinished(artifactName)).toHaveText(today);
        });

        if (isLocal) {
          await pmmTest.step(
            'Restore the first backup after a newer backup rewrote the PBM config',
            async () => {
              await api.backupsApi.verifyBackupSuccess(
                await api.backupsApi.startBackup(backupName, serviceId, locationId, {
                  data_model: `DATA_MODEL_${dataModel}`,
                }),
              );
              await api.backupsApi.startRestore(artifactId, serviceId);
              await backupInventoryPage.verifyRestoreStatus(artifactName, 'RESTORE_STATUS_SUCCESS');
            },
          );
        }
      },
    );
  }
}

pmmTest(
  'PMM-T910 + PMM-T911 - Verify delete from storage is selected by default @bm-mongo',
  async ({ api, backupInventoryPage }) => {
    const backupName = 'mongo_artifact_delete_test';

    await api.backupsApi.verifyBackupSuccess(
      await api.backupsApi.startBackup(backupName, serviceId, s3LocationId),
    );
    await backupInventoryPage.verifyBackupStatus(backupName, 'BACKUP_STATUS_SUCCESS');

    const artifactName = (await backupInventoryPage.builders.artifactName(backupName).textContent()) ?? '';

    expect(artifactName, 'The backup must be listed under its artifact name').toMatch(/\S/);

    await pmmTest.step('Verify the delete modal', async () => {
      await backupInventoryPage.openDeleteModal(backupName);
      await expect(backupInventoryPage.elements.forceDeleteLabel).toBeVisible({
        timeout: Timeouts.TWENTY_SECONDS,
      });
      await expect(backupInventoryPage.elements.deleteMessage).toHaveText(
        `Are you sure you want to delete "${artifactName}"?`,
      );
      await expect(backupInventoryPage.elements.forceDeleteLabel).toHaveText('Delete from storage');
      await expect(backupInventoryPage.elements.modalHeader).toHaveText('Delete backup artifact');
      await expect(backupInventoryPage.buttons.forceDelete).toBeChecked();
    });

    await backupInventoryPage.buttons.confirmDelete.click();
    await expect(backupInventoryPage.builders.artifactRow(backupName)).toBeHidden({
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

pmmTest(
  'PMM-T928 + PMM-T992 - Verify schedule retries and restore from a scheduled backup artifact @bm-mongo',
  async ({ api, backupInventoryPage, cliHelper, mongoDbHelper }) => {
    const scheduleName = 'schedule_for_restore';
    const scheduleId = await api.backupsApi.createScheduledBackup({
      cron_expression: '*/2 * * * *',
      data_model: 'DATA_MODEL_LOGICAL',
      description: '',
      enabled: true,
      location_id: s3LocationId,
      mode: 'BACKUP_MODE_SNAPSHOT',
      name: scheduleName,
      retention: 1,
      retries: 5,
      retry_interval: '10s',
      service_id: serviceId,
    });

    await pmmTest.step('Verify the scheduled backup fails while mongod is stopped', async () => {
      cliHelper.execute('docker exec rs101 systemctl stop mongod').assertSuccess();
      await api.backupsApi.verifyBackupStatus(scheduleName, 'BACKUP_STATUS_ERROR');
      await backupInventoryPage.verifyBackupStatus(scheduleName, 'BACKUP_STATUS_ERROR');
    });

    await pmmTest.step('Verify the scheduled backup succeeds once mongod is back', async () => {
      cliHelper.execute('docker exec rs101 systemctl start mongod').assertSuccess();
      await expect(backupInventoryPage.builders.successIcon(scheduleName)).toBeVisible({
        timeout: Timeouts.FIVE_MINUTES,
      });
      await api.backupsApi.disableScheduledBackup(scheduleId);
    });

    await pmmTest.step('Restore the scheduled backup over a newer document', async () => {
      await mongoDbHelper.getCollection('test', 'test').insertOne({ name: 'BeforeRestore', number: 2 });
      await backupInventoryPage.verifyBackupStatus(scheduleName, 'BACKUP_STATUS_SUCCESS');
      await backupInventoryPage.startRestore(scheduleName);
      await backupInventoryPage.verifyRestoreStatus(scheduleName, 'RESTORE_STATUS_SUCCESS');
    });

    expect(
      await mongoDbHelper.getCollection('test', 'test').findOne({ name: 'BeforeRestore' }),
      'The restore must remove the document inserted after the backup',
    ).toBeNull();
  },
);

pmmTest(
  'PMM-T848 - Verify service no longer exists error message during restore @bm-mongo',
  async ({ api, backupInventoryPage, cliHelper }) => {
    const backupName = 'service_remove_backup';

    cliHelper
      .execute(
        `docker exec rs101 pmm-admin add mongodb ${credentialsFlags} --host=rs101 --port=27017 --service-name=${deletedServiceName} --replication-set=rs --cluster=rs`,
      )
      .assertSuccess();

    const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mongodb,
      deletedServiceName,
    );

    await api.backupsApi.verifyBackupSuccess(
      await api.backupsApi.startBackup(backupName, service_id, s3LocationId),
    );
    await api.managementApi.removeService(service_id);
    await backupInventoryPage.verifyBackupStatus(backupName, 'BACKUP_STATUS_SUCCESS');
    await backupInventoryPage.openRestoreModal(backupName);
    await expect(backupInventoryPage.buttons.restore).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
    await expect(backupInventoryPage.elements.backupModalError).toHaveText(
      'This service no longer exists. Please choose a compatible one.',
    );
    await expect(backupInventoryPage.buttons.restore).toBeDisabled();
  },
);

pmmTest(
  'PMM-T1159 + PMM-T1160 - Verify backup names are limited to 100 characters and a long name is truncated @bm-mongo',
  async ({ backupInventoryPage }) => {
    const backupName = 'a'.repeat(100);

    await backupInventoryPage.buttons.createBackup.click();
    await backupInventoryPage.inputs.backupName.fill(`${backupName}a`);
    await expect(backupInventoryPage.messages.backupNameError).toContainText(
      'Must contain at most 100 characters',
    );

    await pmmTest.step('Create a backup with a 100 character name', async () => {
      await backupInventoryPage.inputs.backupName.fill(backupName);
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.service, mongoServiceName);
      await expect(backupInventoryPage.inputs.service).toHaveText(mongoServiceName);
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.location, s3Location.name);
      await expect(backupInventoryPage.inputs.location).toHaveText(s3Location.name);
      await backupInventoryPage.submitBackup();
      await backupInventoryPage.verifyBackupStatus(backupName, 'BACKUP_STATUS_SUCCESS');
    });

    await expect(backupInventoryPage.builders.artifactName(backupName)).toHaveCSS(
      'text-overflow',
      'ellipsis',
    );
    await backupInventoryPage.builders.showDetails(backupName).click();
    await expect(backupInventoryPage.elements.fullBackupName).toContainText(backupName);
  },
);

pmmTest(
  'PMM-T1163 - Verify that Backup time format is identical for whole feature @bm-mongo',
  async ({ api, backupInventoryPage, scheduledBackupsPage }) => {
    const scheduleName = 'PMM-T1163_schedule';
    const scheduleId = await api.backupsApi.createScheduledBackup({
      cron_expression: '*/2 * * * *',
      data_model: 'DATA_MODEL_LOGICAL',
      description: '',
      enabled: true,
      location_id: s3LocationId,
      mode: 'BACKUP_MODE_SNAPSHOT',
      name: scheduleName,
      retention: 1,
      retries: 0,
      retry_interval: '30s',
      service_id: serviceId,
    });

    await api.backupsApi.verifyBackupStatus(scheduleName, 'BACKUP_STATUS_SUCCESS');
    await api.backupsApi.disableScheduledBackup(scheduleId);
    await backupInventoryPage.verifyBackupStatus(scheduleName, 'BACKUP_STATUS_SUCCESS');

    const backupDate = (await backupInventoryPage.builders.createdDate(scheduleName).textContent()) ?? '';

    expect(backupDate, 'The backup must show its creation date').toMatch(/\S/);
    await scheduledBackupsPage.open();
    await expect(scheduledBackupsPage.builders.lastBackup(scheduleName)).toHaveText(backupDate);
  },
);

pmmTest(
  'PMM-T1033 - Verify that user is able to display backup logs from MongoDB on UI @bm-mongo',
  async ({ api, backupInventoryPage, page }) => {
    const backupName = 'mongo_backup_logs_test';

    await api.backupsApi.verifyBackupSuccess(
      await api.backupsApi.startBackup(backupName, serviceId, s3LocationId),
    );
    await page.reload();
    await backupInventoryPage.builders.logsButton(backupName).click();
    await expect(backupInventoryPage.elements.logs).not.toBeEmpty();
    await expect(backupInventoryPage.buttons.copyToClipboard).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
  },
);

pmmTest(
  'PMM-T1551 - Verify Mongod binary error during backup @bm-mongo',
  async ({ api, backupInventoryPage }) => {
    await api.remoteInstanceApi.addRemoteInstance({
      mongodb: {
        add_node: { node_name: remoteServiceName, node_type: 'NODE_TYPE_REMOTE_NODE' },
        address: 'rs101',
        cluster: 'mongo_clstr',
        password: 'pmmpass',
        pmm_agent_id: 'pmm-server',
        port: '27017',
        qan_mongodb_profiler: true,
        service_name: remoteServiceName,
        tls_skip_verify: true,
        username: 'pmm',
      },
    });

    await pmmTest.step('Start a backup of the remote service', async () => {
      await backupInventoryPage.buttons.createBackup.click();
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.service, remoteServiceName);
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.location, s3Location.name);
      await backupInventoryPage.inputs.backupName.fill('test_error');
      await backupInventoryPage.submitBackup();
    });

    await expect(backupInventoryPage.messages.popUp).toContainText(
      'software "mongodb" is not installed: incompatible service',
      { timeout: Timeouts.THIRTY_SECONDS },
    );
  },
);

pmmTest(
  'PMM-T1562 - Verify Mongo restore error logs when replica primary down @bm-mongo',
  async ({ api, backupInventoryPage, cliHelper }) => {
    const backupName = 'mongo_error_logs';

    await api.backupsApi.verifyBackupSuccess(
      await api.backupsApi.startBackup(backupName, serviceId, s3LocationId),
    );
    await backupInventoryPage.verifyBackupStatus(backupName, 'BACKUP_STATUS_SUCCESS');

    await pmmTest.step('Stop the primary while the restore runs', async () => {
      const restoreId = await backupInventoryPage.startRestore(backupName);

      await expect
        .poll(async () => (await api.backupsApi.getRestoreLogs(restoreId)).length, {
          intervals: [Timeouts.ONE_SECOND],
          message: 'PBM should start the restore and stream its first log',
          timeout: Timeouts.TWO_MINUTES,
        })
        .toBeGreaterThan(0);
      cliHelper.execute('docker exec rs101 systemctl stop mongod').assertSuccess();
      await backupInventoryPage.verifyRestoreStatus(backupName, 'RESTORE_STATUS_ERROR');
    });

    await backupInventoryPage.builders.logsButton(backupName).click();
    await expect(backupInventoryPage.elements.logs).toContainText(
      'create mongo connection: ping: server selection error: server selection timeout',
    );
  },
);

for (const storageType of ['s3_config', 'filesystem_config'] as const) {
  pmmTest(
    `PMM-T1563 + PMM-T1564 - Verify Mongo restore error logs when deleted artifact @bm-mongo | ${storageType}`,
    async ({ api, backupInventoryPage, cliHelper }) => {
      const backupName = `mongo-error-no-artifact-${storageType}`;
      const isS3 = storageType === 's3_config';

      await api.backupsApi.verifyBackupSuccess(
        await api.backupsApi.startBackup(backupName, serviceId, isS3 ? s3LocationId : localLocationId),
      );
      await backupInventoryPage.verifyBackupStatus(backupName, 'BACKUP_STATUS_SUCCESS');

      await pmmTest.step('Restore the backup after its files are deleted', async () => {
        cliHelper
          .execute(
            isS3 ? 'sudo rm -rfv /tmp/minio/backups/bcp/*' : 'docker exec rs101 rm -rfv /tmp/backup_data/*',
          )
          .assertSuccess();
        await backupInventoryPage.startRestore(backupName);
        await backupInventoryPage.verifyRestoreStatus(backupName, 'RESTORE_STATUS_ERROR');
      });

      await backupInventoryPage.builders.logsButton(backupName).click();
      await expect(backupInventoryPage.elements.logs).toContainText('backup record not found by backup tool');
    },
  );
}

pmmTest(
  'PMM-T991 - Verify retries for backup on demand @bm-mongo',
  async ({ api, backupInventoryPage, cliHelper, page }) => {
    const backupName = 'mongo_retry';

    await api.backupsApi.startBackup(backupName, serviceId, s3LocationId, {
      retries: 5,
      retry_interval: '60s',
    });
    // eslint-disable-next-line playwright/no-wait-for-timeout -- outage window: the backup reports pending as soon as it is requested, so no status marks PBM having started it.
    await page.waitForTimeout(Timeouts.FIVE_SECONDS);
    cliHelper.execute('docker exec rs101 systemctl stop mongod').assertSuccess();

    await pmmTest.step('Verify the backup fails while mongod is stopped', async () => {
      await api.backupsApi.verifyBackupStatus(backupName, 'BACKUP_STATUS_ERROR');
      await backupInventoryPage.verifyBackupStatus(backupName, 'BACKUP_STATUS_ERROR');
    });

    cliHelper.execute('docker exec rs101 systemctl start mongod').assertSuccess();
    await expect(backupInventoryPage.builders.successIcon(backupName)).toBeVisible({
      timeout: Timeouts.FIVE_MINUTES,
    });
  },
);

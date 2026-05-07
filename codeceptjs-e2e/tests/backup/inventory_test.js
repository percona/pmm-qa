const assert = require('assert');
const moment = require('moment/moment');
const faker = require('faker');
const {
  SERVICE_TYPE,
  gssapi,
} = require('../helper/constants');

const { locationsAPI } = inject();

const location = {
  name: 'mongo-location',
  description: 'test description',
};
const localStorageLocationName = 'mongoLocation';

let localStorageLocationId;
let locationId;
let serviceId;

const mongoServiceName = 'mongo-backup-inventory-1';
const mongoServiceName2 = 'mongo-backup-inventory-2';
const mongoServiceName3 = 'mongo-backup-inventory-3';

const mongoExtraServiceName = 'mongo-extra-1';
const mongoExtraServiceName2 = 'mongo-extra-2';
const mongoExtraServiceName3 = 'mongo-extra-3';

let mongoClient;

const mongoConnection = {
  username: 'pmm',
  password: 'pmmpass',
  port: 27027,
};

const mongoConnectionReplica2 = {
  username: 'pmm',
  password: 'pmmpass',
  port: 27037,
};

const clientCredentialsFlags = gssapi.enabled
  ? gssapi.credentials_flags
  : `--username=${mongoConnection.username} --password=${mongoConnection.password}`;

Feature('BM: Backup Inventory');

BeforeSuite(async ({
  I, locationsAPI, settingsAPI, inventoryAPI,
}) => {
  await settingsAPI.changeSettings({ backup: true });
  await locationsAPI.clearAllLocations(true);
  localStorageLocationId = await locationsAPI.createStorageLocation(
    localStorageLocationName,
    locationsAPI.storageType.localClient,
    locationsAPI.localStorageDefaultConfig,
  );
  locationId = await locationsAPI.createStorageLocation(
    location.name,
    locationsAPI.storageType.s3,
    locationsAPI.storageLocationConnection,
    location.description,
  );

  await I.mongoConnect(mongoConnection);
  const mongoNodeExists = !!(await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, mongoServiceName));

  if (mongoNodeExists) {
    return;
  }

  I.say(`GSSAPI enabled: ${gssapi.enabled}`);

  I.say(`using flags: ${clientCredentialsFlags}`);

  I.say(await I.verifyCommand(`docker exec rs101 pmm-admin add mongodb ${clientCredentialsFlags} --host=rs101 --port=27017 --service-name=${mongoServiceName} --replication-set=rs --cluster=rs`));
  I.say(await I.verifyCommand(`docker exec rs102 pmm-admin add mongodb ${clientCredentialsFlags} --host=rs102 --port=27017 --service-name=${mongoServiceName2} --replication-set=rs --cluster=rs`));
  I.say(await I.verifyCommand(`docker exec rs103 pmm-admin add mongodb ${clientCredentialsFlags} --host=rs103 --port=27017 --service-name=${mongoServiceName3} --replication-set=rs --cluster=rs`));

  // Adding extra replica set for restore
  I.say(await I.verifyCommand(`docker exec rs201 pmm-admin add mongodb ${clientCredentialsFlags} --host=rs201 --port=27017 --service-name=${mongoExtraServiceName} --replication-set=rs1 --cluster=rs1`));
  I.say(await I.verifyCommand(`docker exec rs202 pmm-admin add mongodb ${clientCredentialsFlags} --host=rs202 --port=27017 --service-name=${mongoExtraServiceName2} --replication-set=rs1 --cluster=rs1`));
  I.say(await I.verifyCommand(`docker exec rs203 pmm-admin add mongodb ${clientCredentialsFlags} --host=rs203 --port=27017 --service-name=${mongoExtraServiceName3} --replication-set=rs1 --cluster=rs1`));
});

Before(async ({
  I, settingsAPI, backupInventoryPage, inventoryAPI, backupAPI,
}) => {
  const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, mongoServiceName);

  serviceId = service_id;

  await I.verifyCommand('docker exec rs101 systemctl start mongod');

  const c = await I.mongoGetCollection('test', 'test');

  await c.deleteMany({ number: 2 });

  await I.Authorize();
  await settingsAPI.changeSettings({ backup: true });
  await backupAPI.clearAllArtifacts();
  await backupInventoryPage.openInventoryPage();
});

After(async ({ I }) => {
  if (mongoClient) {
    await mongoClient.close();
  }

  await I.verifyCommand('docker exec rs101 systemctl start mongod');
});

AfterSuite(async ({ I }) => {
  await I.mongoDisconnect();
});

Scenario(
  'PMM-T691 - Verify message about no backups in inventory @backup @bm-mongo @pre-mongo-backup-upgrade',
  async ({
    I, backupInventoryPage,
  }) => {
    I.waitForText('No backups found', 30, backupInventoryPage.elements.noData);
  },
);

const createBackupTests = new DataTable(['storageLocationName']);

createBackupTests.add([location.name]);
createBackupTests.add([localStorageLocationName]);

Data(createBackupTests).Scenario(
  'PMM-T855 + PMM-T1393 - Verify user is able to perform MongoDB backup @backup @bm-mongo @bm-fb @pre-mongo-backup-upgrade',
  async ({
    I, backupInventoryPage, backupAPI, current,
  }) => {
    const backupName = `mongo_backup_test_${current.storageLocationName}`;

    I.click(backupInventoryPage.buttons.openAddBackupModal);

    await I.selectGrafanaDropdownOption('Service name', mongoServiceName);
    await I.selectGrafanaDropdownOption('Location', current.storageLocationName);

    I.fillField(backupInventoryPage.fields.backupName, backupName);
    // TODO: uncomment when PMM-10899 will be fixed
    // I.fillField(backupInventoryPage.fields.description, 'test description');
    I.click(backupInventoryPage.buttons.addBackup);
    I.waitForVisible(backupInventoryPage.elements.pendingBackupByName(backupName), 10);
    backupInventoryPage.verifyBackupSucceeded(backupName);

    const artifactName = await I.grabTextFrom(backupInventoryPage.elements.artifactName(backupName));
    const artifact = await backupAPI.getArtifactByName(artifactName);

    if (current.storageLocationName === localStorageLocationName) {
      await I.verifyCommand('ls -la /tmp/backup_data/rs', artifact.metadata_list[0].name);
    }
  },
).retry(1);

Scenario(
  'PMM-T961 + PMM-T1005 + PMM-T1024 - Verify create backup modal @backup @bm-mongo @pre-mongo-backup-upgrade',
  async ({
    I, backupInventoryPage,
  }) => {
    const backupName = 'backup_modal_test';

    I.click(backupInventoryPage.buttons.openAddBackupModal);

    await I.selectGrafanaDropdownOption('Service name', mongoServiceName);
    I.seeTextEquals(mongoServiceName, backupInventoryPage.elements.selectedService);
    I.waitForValue(backupInventoryPage.fields.vendor, 'MongoDB', 5);
    I.seeElementsDisabled(backupInventoryPage.fields.vendor);

    await I.selectGrafanaDropdownOption('Location', location.name);
    I.seeTextEquals(location.name, backupInventoryPage.elements.selectedLocation);

    // I.seeInField(backupInventoryPage.elements.dataModelState, 'PHYSICAL');

    // Verify retry times and retry interval default values
    I.click(backupInventoryPage.buttons.showAdvancedSettings);
    I.waitForVisible(backupInventoryPage.elements.retryTimes, 2);
    I.seeInField(backupInventoryPage.elements.retryTimes, 2);
    I.seeInField(backupInventoryPage.elements.retryInterval, 30);

    I.seeElementsDisabled(backupInventoryPage.elements.retryTimes);
    I.click(backupInventoryPage.buttons.retryModeOption('Auto'));
    I.waitForEnabled(backupInventoryPage.elements.retryTimes, 10);
    I.waitForEnabled(backupInventoryPage.elements.retryInterval, 10);
    I.click(backupInventoryPage.buttons.retryModeOption('Manual'));
    I.seeElementsDisabled(backupInventoryPage.elements.retryTimes);
    I.seeElementsDisabled(backupInventoryPage.elements.retryInterval);

    I.seeElementsDisabled(backupInventoryPage.buttons.addBackup);
    I.fillField(backupInventoryPage.fields.backupName, backupName);
    I.waitForEnabled(backupInventoryPage.buttons.addBackup, 10);
    // TODO: uncomment when PMM-10899 will be fixed
    // I.fillField(backupInventoryPage.fields.description, 'test description');
  },
);

const restoreFromDifferentStorageLocationsTests = new DataTable(['storageType', 'backupType']);

restoreFromDifferentStorageLocationsTests.add([locationsAPI.storageType.s3, 'PHYSICAL']);
restoreFromDifferentStorageLocationsTests.add([locationsAPI.storageType.localClient, 'PHYSICAL']);
restoreFromDifferentStorageLocationsTests.add([locationsAPI.storageType.s3, 'LOGICAL']);
restoreFromDifferentStorageLocationsTests.add([locationsAPI.storageType.localClient, 'LOGICAL']);

Data(restoreFromDifferentStorageLocationsTests).Scenario(
  'PMM-T862 + PMM-T1508 + PMM-T1393 + PMM-T1394 + PMM-T1508 + PMM-T1520 + PMM-T1452 + PMM-T1583 + PMM-T1674 + PMM-T1675 -'
  + ' Verify user is able to perform MongoDB restore from different storage locations @backup @bm-mongo @bm-fb @post-mongo-backup-upgrade',
  async ({
    I, backupInventoryPage, backupAPI, inventoryAPI, restorePage, current,
  }) => {
    const currentLocationId = current.storageType === locationsAPI.storageType.s3
      ? locationId : localStorageLocationId;
    const backupName = `mongo-restore-${current.storageType}-${current.backupType}`;
    const isLogical = current.backupType === 'LOGICAL';

    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, mongoServiceName);

    const artifactId = await backupAPI.startBackup(backupName, service_id, currentLocationId, false, isLogical);

    await backupAPI.waitForBackupFinish(artifactId);

    I.refreshPage();
    I.waitForVisible(backupInventoryPage.elements.artifactName(backupName), 10);
    backupInventoryPage.verifyBackupSucceeded(backupName);

    const artifactName = await I.grabTextFrom(backupInventoryPage.elements.artifactName(backupName));
    const artifact = await backupAPI.getArtifactByName(artifactName);

    if (current.storageType === locationsAPI.storageType.localClient) {
      await I.verifyCommand('ls -la /tmp/backup_data/rs', artifact.metadata_list[0].name);
      // TODO: add check if the folder is not empty
    }

    let c = await I.mongoGetCollection('test', 'test');

    await c.insertOne({ number: 2, name: 'Anna' });

    backupInventoryPage.startRestore(artifactName);

    // PMM-T1520 PMM-T1508
    I.amOnPage(restorePage.url);
    I.waitForVisible(restorePage.elements.targetServiceByName(artifactName), 10);
    I.seeTextEquals(mongoServiceName, restorePage.elements.targetServiceByName(artifactName));
    await restorePage.waitForRestoreSuccess(artifactName);

    // Wait 30 seconds to have all members restarted
    if (current.backupType === 'PHYSICAL') {
      I.wait(30);
    }

    c = await I.mongoGetCollection('test', 'test');
    const record = await c.findOne({ number: 2, name: 'Anna' });

    assert.ok(record === null, `Was expecting to not have a record ${JSON.stringify(record, null, 2)} after restore operation`);

    // PMM-T1452
    const startedAt = await I.grabTextFrom(restorePage.elements.startedAtByName(artifactName));
    const finishedAt = await I.grabTextFrom(restorePage.elements.finishedAtByName(artifactName));

    I.assertStartsWith(startedAt, moment().format('YYYY-MM-DD'));
    I.assertStartsWith(finishedAt, moment().format('YYYY-MM-DD'));

    if (current.storageType === locationsAPI.storageType.localClient) {
      // PMM-T1583
      // Create new backup to rewrite pbm config and start restore from the very first backup artifact
      const newArtifactId = await backupAPI.startBackup(backupName, service_id, currentLocationId, false, isLogical);

      await backupAPI.waitForBackupFinish(newArtifactId);

      await backupAPI.startRestore(service_id, artifactId);
      await restorePage.waitForRestoreSuccess(artifactName);
    }
  },
).retry(1);

const restoreToDifferentService = new DataTable(['backupType']);

// TODO: unskip in scope of https://perconadev.atlassian.net/browse/PMM-13097
// restoreToDifferentService.add(['LOGICAL']);
// restoreToDifferentService.add(['PHYSICAL']);

Data(restoreToDifferentService).Scenario(
  '@PMM-T1773 Verify user is able to perform MongoDB restore to compatible service @backup @bm-mongo @bm-fb',
  async ({
    I, backupInventoryPage, backupAPI, inventoryAPI, restorePage, current,
  }) => {
    const backupName = `mongo-restore-another-replica-${current.backupType}`;
    const isLogical = current.backupType === 'LOGICAL';

    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, mongoServiceName);
    const artifactId = await backupAPI.startBackup(backupName, service_id, locationId, false, isLogical);

    await backupAPI.waitForBackupFinish(artifactId);

    I.refreshPage();
    I.waitForVisible(backupInventoryPage.elements.artifactName(backupName), 10);
    backupInventoryPage.verifyBackupSucceeded(backupName);

    const artifactName = await I.grabTextFrom(backupInventoryPage.elements.artifactName(backupName));
    const artifact = await backupAPI.getArtifactByName(artifactName);

    if (current.storageType === locationsAPI.storageType.localClient) {
      await I.verifyCommand('ls -la /tmp/backup_data/rs', artifact.metadata_list[0].name);
      // TODO: add check if the folder is not empty
    }

    backupInventoryPage.startRestoreCompatible(artifactName, mongoExtraServiceName);

    I.waitForVisible(restorePage.elements.targetServiceByName(artifactName), 10);
    I.seeTextEquals(mongoExtraServiceName, restorePage.elements.targetServiceByName(artifactName));
    await restorePage.waitForRestoreSuccess(artifactName);

    // Wait 30 seconds to have all members restarted
    if (current.backupType === 'PHYSICAL') {
      I.wait(30);
    }

    mongoClient = await I.getMongoClient(mongoConnectionReplica2);
    const c = mongoClient.db('test').collection('test');

    const record = await c.findOne({ number: 2, name: 'Anna' });

    assert.ok(record === null, `Was expecting to not have a record ${JSON.stringify(record, null, 2)} after restore operation`);
  },
).retry(1);

// TODO: unskip after https://perconadev.atlassian.net/browse/PMM-14723 is fixed
Scenario.skip(
  'PMM-T910 + PMM-T911 - Verify delete from storage is selected by default @backup @bm-mongo',
  async ({
    I, backupInventoryPage, backupAPI, inventoryAPI,
  }) => {
    const backupName = 'mongo_artifact_delete_test';
    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, mongoServiceName);
    const artifactId = await backupAPI.startBackup(backupName, service_id, locationId);

    await backupAPI.waitForBackupFinish(artifactId);

    I.refreshPage();
    backupInventoryPage.verifyBackupSucceeded(backupName);

    const artifactName = await I.grabTextFrom(backupInventoryPage.elements.artifactName(backupName));

    await backupInventoryPage.openDeleteBackupModal(backupName);
    I.seeTextEquals(backupInventoryPage.messages.confirmDeleteText(artifactName), 'h4');
    I.seeTextEquals(backupInventoryPage.messages.forceDeleteLabelText, backupInventoryPage.elements.forceDeleteLabel);
    I.seeTextEquals(backupInventoryPage.messages.modalHeaderText, backupInventoryPage.modal.header);

    I.seeCheckboxIsChecked(backupInventoryPage.buttons.forceDeleteCheckbox);

    I.click(backupInventoryPage.buttons.confirmDelete);

    I.waitForInvisible(backupInventoryPage.buttons.deleteByName(backupName), 30);
  },
);

// Unskip after https://jira.percona.com/browse/PBM-1193 is fixed
Scenario.skip(
  'PMM-T928 + PMM-T992 - Verify schedule retries and restore from a scheduled backup artifact @backup @bm-mongo @post-mongo-backup-upgrade',
  async ({
    I, backupInventoryPage, scheduledAPI, backupAPI, restorePage,
  }) => {
    // Every 2 mins schedule
    const schedule = {
      service_id: serviceId,
      location_id: locationId,
      cron_expression: '*/2 * * * *',
      name: `schedule_for_restore_${faker.lorem.word()}`,
      mode: scheduledAPI.backupModes.snapshot,
      description: '',
      retry_interval: '10s',
      retries: 5,
      enabled: true,
      retention: 1,
    };

    const scheduleId = await scheduledAPI.createScheduledBackup(schedule);

    // Check retry mechanism for scheduled backups
    await I.verifyCommand('docker exec rs101 systemctl stop mongod');
    await backupAPI.waitForBackupFinish(null, schedule.name, 240);

    I.refreshPage();
    backupInventoryPage.verifyBackupFailed(schedule.name);
    await I.verifyCommand('docker exec rs101 systemctl start mongod');

    // Proceed happy path
    I.waitForElement(backupInventoryPage.elements.successIconByName(schedule.name), 180);
    await scheduledAPI.disableScheduledBackup(scheduleId);

    let c = await I.mongoGetCollection('test', 'test');

    await c.insertOne({ number: 2, name: 'BeforeRestore' });
    I.refreshPage();

    backupInventoryPage.verifyBackupSucceeded(schedule.name);
    backupInventoryPage.startRestore(schedule.name);
    await restorePage.waitForRestoreSuccess(schedule.name);

    c = await I.mongoGetCollection('test', 'test');
    const record = await c.findOne({ name: 'BeforeRestore' });

    assert.ok(record === null, `Was expecting to not have a record ${JSON.stringify(record, null, 2)} after restore operation`);
  },
).retry(1);

Scenario(
  'PMM-T848 - Verify service no longer exists error message during restore @backup @bm-mongo',
  async ({
    I, backupInventoryPage, backupAPI, inventoryAPI,
  }) => {
    const backupName = 'service_remove_backup';
    const serviceName = `mongo-service-to-delete-${faker.datatype.number(2)}`;

    I.say(await I.verifyCommand(`docker exec rs101 pmm-admin add mongodb ${clientCredentialsFlags} --host=rs101 --port=27017 --service-name=${serviceName} --replication-set=rs --cluster=rs`));
    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, serviceName);
    const artifactId = await backupAPI.startBackup(backupName, service_id, locationId);

    await backupAPI.waitForBackupFinish(artifactId);
    await inventoryAPI.deleteService(service_id);

    I.refreshPage();
    backupInventoryPage.verifyBackupSucceeded(backupName);

    I.click(backupInventoryPage.buttons.actionsMenuByName(backupName));
    I.waitForVisible(backupInventoryPage.buttons.restoreByName(backupName), 2);
    I.click(backupInventoryPage.buttons.restoreByName(backupName));
    I.waitForVisible(backupInventoryPage.buttons.modalRestore, 10);
    I.seeTextEquals(backupInventoryPage.messages.serviceNoLongerExists, backupInventoryPage.elements.backupModalError);
    I.seeElementsDisabled(backupInventoryPage.buttons.modalRestore);
  },
);

Scenario(
  'PMM-T1159 + PMM-T1160 - Verify that backup with long backup name is displayed correctly, Verify that backup names are limited to 100 chars length @backup @bm-mongo',
  async ({
    I, backupInventoryPage,
  }) => {
    I.click(backupInventoryPage.buttons.openAddBackupModal);
    backupInventoryPage.inputRandomBackupName(101);
    I.see(backupInventoryPage.messages.lengthErrorBackupName);
    const backupName = backupInventoryPage.inputRandomBackupName(100);

    backupInventoryPage.selectDropdownOption(backupInventoryPage.fields.serviceNameDropdown, mongoServiceName);
    I.seeTextEquals(mongoServiceName, backupInventoryPage.elements.selectedService);
    backupInventoryPage.selectDropdownOption(backupInventoryPage.fields.locationDropdown, location.name);
    I.seeTextEquals(location.name, backupInventoryPage.elements.selectedLocation);
    // TODO: uncomment when PMM-10899 will be fixed
    // I.fillField(backupInventoryPage.fields.description, 'Test description');
    I.click(backupInventoryPage.buttons.addBackup);
    backupInventoryPage.verifyBackupSucceeded(backupName);
    I.seeCssPropertiesOnElements(backupInventoryPage.elements.artifactName(backupName), { 'text-overflow': 'ellipsis' });
    I.click(backupInventoryPage.buttons.showDetails(backupName));
    I.see(backupName, backupInventoryPage.elements.fullBackUpName);
  },
);

Scenario(
  'PMM-T1163 - Verify that Backup time format is identical for whole feature @backup @bm-mongo',
  async ({
    I, backupInventoryPage, backupAPI, scheduledAPI, scheduledPage,
  }) => {
    // Every 2 mins schedule
    const schedule = {
      service_id: serviceId,
      location_id: locationId,
      cron_expression: '*/2 * * * *',
      name: 'PMM-T1163_schedule',
      mode: scheduledAPI.backupModes.snapshot,
      description: '',
      retry_interval: '30s',
      retries: 0,
      enabled: true,
      retention: 1,
    };
    const scheduleId = await scheduledAPI.createScheduledBackup(schedule);

    await backupAPI.waitForBackupFinish(null, schedule.name, 240);
    await scheduledAPI.disableScheduledBackup(scheduleId);
    I.refreshPage();
    backupInventoryPage.verifyBackupSucceeded(schedule.name);
    const backupDate = await I.grabTextFrom(backupInventoryPage.elements.backupDateByName(schedule.name));

    await scheduledPage.openScheduledBackupsPage();
    const scheduleDate = await I.grabTextFrom(scheduledPage.elements.lastBackupByName(schedule.name));

    I.assertEqual(backupDate, scheduleDate, 'Backup Date format from Inventory page does not match Scheduled backups!');
  },
);

Scenario(
  'PMM-T1033 - Verify that user is able to display backup logs from MongoDB on UI @backup @bm-mongo',
  async ({
    I, inventoryAPI, backupAPI, backupInventoryPage,
  }) => {
    const backupName = 'mongo_backup_logs_test';
    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, mongoServiceName);
    const artifactId = await backupAPI.startBackup(backupName, service_id, locationId);

    await backupAPI.waitForBackupFinish(artifactId);

    I.refreshPage();
    I.waitForVisible(backupInventoryPage.buttons.backupLogsByName(backupName), 10);
    I.click(backupInventoryPage.buttons.backupLogsByName(backupName));

    const logs = await I.grabTextFrom(backupInventoryPage.modal.content);

    I.assertTrue(logs.length > 0);

    I.waitForVisible(backupInventoryPage.modal.copyToClipboardButton, 10);

    // TODO: add clibboard check after PMM-9654 is done
    // I.click(backupInventoryPage.modal.copyToClipboardButton);
    // I.wait(1);
    // const clipboardText = I.readClipboard();
    //
    // I.assertEqual(clipboardText, logs);
  },
);

Scenario(
  'PMM-T1551 - Verify Mongod binary error during backup @backup @bm-mongo',
  async ({
    I, backupInventoryPage, addInstanceAPI,
  }) => {
    const serviceName = `mongo-binary-test-${faker.datatype.number(2)}`;

    await addInstanceAPI.addMongodb(serviceName, {
      host: 'rs101',
      port: 27017,
      username: 'pmm',
      password: 'pmmpass',
    });

    I.click(backupInventoryPage.buttons.openAddBackupModal);

    backupInventoryPage.selectDropdownOption(backupInventoryPage.fields.serviceNameDropdown, serviceName);
    backupInventoryPage.selectDropdownOption(backupInventoryPage.fields.locationDropdown, location.name);
    I.fillField(backupInventoryPage.fields.backupName, 'test_error');
    I.click(backupInventoryPage.buttons.addBackup);

    await I.verifyPopUpMessage('software "mongodb" is not installed: incompatible service');
  },
);

// Unskip after https://jira.percona.com/browse/PBM-1193 is fixed
Scenario.skip(
  'PMM-T1562 - Verify Mongo restore error logs when replica primary down @backup @bm-mongo',
  async ({
    I, inventoryAPI, backupInventoryPage, backupAPI, restorePage,
  }) => {
    const backupName = 'mongo_error_logs';
    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, mongoServiceName);
    const artifactId = await backupAPI.startBackup(backupName, service_id, locationId);

    await backupAPI.waitForBackupFinish(artifactId);

    I.refreshPage();
    backupInventoryPage.verifyBackupSucceeded(backupName);

    backupInventoryPage.startRestore(backupName);
    I.wait(5);

    await I.verifyCommand('docker exec rs101 systemctl stop mongod');
    restorePage.waitForRestoreFailure(backupName);

    I.click(restorePage.elements.logsByName(backupName));

    I.waitForVisible(restorePage.elements.logsText);

    const logsText = await I.grabTextFrom(restorePage.elements.logsText);

    assert.ok(
      logsText.includes('connect to mongodb: create mongo connection: mongo ping: server selection error: server selection timeout'),
      `Received unexpected logs: \n "${logsText}"`,
    );
  },
).retry(1);

const deleteArtifactsTests = new DataTable(['storageType']);

deleteArtifactsTests.add([locationsAPI.storageType.s3]);
deleteArtifactsTests.add([locationsAPI.storageType.localClient]);
Data(deleteArtifactsTests).Scenario(
  'PMM-T1563 + PMM-T1564 - Verify Mongo restore error logs when deleted artifact @backup @bm-mongo',
  async ({
    I, inventoryAPI, backupInventoryPage, backupAPI, restorePage, current,
  }) => {
    const backupName = `mongo-error-no-artifact-${current.storageType}`;
    const isS3Type = current.storageType === locationsAPI.storageType.s3;
    const currentLocationId = isS3Type ? locationId : localStorageLocationId;
    const commandToClearStorage = isS3Type ? 'sudo rm -rfv /tmp/minio/backups/bcp/*' : 'docker exec rs101 rm -rfv /tmp/backup_data/*';

    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, mongoServiceName);
    const artifactId = await backupAPI.startBackup(backupName, service_id, currentLocationId);

    await backupAPI.waitForBackupFinish(artifactId);

    I.refreshPage();
    backupInventoryPage.verifyBackupSucceeded(backupName);

    // Delete all files from the storage dir
    await I.verifyCommand(commandToClearStorage);

    backupInventoryPage.startRestore(backupName);
    restorePage.waitForRestoreFailure(backupName);

    I.click(restorePage.elements.logsByName(backupName));
    I.waitForVisible(restorePage.elements.logsText);

    const logsText = await I.grabTextFrom(restorePage.elements.logsText);

    assert.ok(
      logsText.includes('backup record not found by backup tool'),
      `Received unexpected logs: \n "${logsText}"`,
    );
  },
);

// Unskip after https://jira.percona.com/browse/PBM-1193 is fixed
Scenario.skip(
  'PMM-T991 - Verify retries for backup on demand @backup @bm-mongo',
  async ({
    I, inventoryAPI, backupInventoryPage, backupAPI,
  }) => {
    const backupName = 'mongo_retry';
    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, mongoServiceName);
    const artifactId = await backupAPI.startBackup(backupName, service_id, locationId, true);

    I.wait(5);
    await I.verifyCommand('docker exec rs101 systemctl stop mongod');

    await backupAPI.waitForBackupFinish(artifactId);

    I.refreshPage();
    backupInventoryPage.verifyBackupFailed(backupName);

    await I.verifyCommand('docker exec rs101 systemctl start mongod');

    I.waitForElement(backupInventoryPage.elements.successIconByName(backupName), 180);
  },
);

const { SERVICE_TYPE } = require('../../helper/constants');

const { locationsPage, psMySql } = inject();
const connection = psMySql.defaultConnection;
const location = {
  name: 'mysql_backups',
  description: 'MySQL backup location',
};

let locationId;
let serviceId;

const mysqlServiceName = 'mysql-with-backup-inventory';
const mysqlServiceNameToDelete = 'mysql-service-to-delete';
const mysqlServiceNameForPreCheckTest = 'mysql-backup-pre-checks';
const mysqlCredentials = {
  host: '127.0.0.1',
  port: '3306',
  username: 'root',
  password: 'PMM_userk12456',
};

Feature('BM: MySQL Backup Inventory');

BeforeSuite(async ({
  I, locationsAPI, settingsAPI, psMySql, inventoryAPI,
}) => {
  await settingsAPI.changeSettings({ backup: true });
  await locationsAPI.clearAllLocations(true);
  locationId = await locationsAPI.createStorageLocation(
    location.name,
    locationsAPI.storageType.s3,
    locationsAPI.psStorageLocationConnection,
    location.description,
  );
  await inventoryAPI.deleteNodeByServiceName(SERVICE_TYPE.MYSQL, mysqlServiceNameForPreCheckTest);

  await I.verifyCommand('docker exec pmm-server dnf remove -y Percona-Server-server-57');
  await I.verifyCommand('docker exec pmm-server dnf remove -y percona-xtrabackup-24');
  await I.verifyCommand('docker exec pmm-server dnf remove -y qpress');

  psMySql.connectToPS(mysqlCredentials);

  await I.say(await I.verifyCommand(`pmm-admin add mysql --username=${mysqlCredentials.username} --password=${mysqlCredentials.password} --query-source=perfschema ${mysqlServiceName}`));
  await I.say(await I.verifyCommand(`pmm-admin add mysql --username=${mysqlCredentials.username} --password=${mysqlCredentials.password} --query-source=perfschema ${mysqlServiceNameToDelete}`));
});

Before(async ({
  I, settingsAPI, backupInventoryPage, inventoryAPI, backupAPI,
}) => {
  const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MYSQL, mysqlServiceName);

  serviceId = service_id;

  await I.Authorize();
  await settingsAPI.changeSettings({ backup: true });
  await backupAPI.clearAllArtifacts();
  await backupInventoryPage.openInventoryPage();
});

AfterSuite(async ({ psMySql }) => {
  await psMySql.disconnectFromPS();
});

Scenario(
  '@PMM-T769, @PMM-T920 - Verify user is able to perform MySQL backup @bm-mysql @not-ui-pipeline',
  async ({ I, backupInventoryPage }) => {
    const backupName = 'mysql_backup_test';

    I.click(backupInventoryPage.buttons.openAddBackupModal);

    backupInventoryPage.selectDropdownOption(backupInventoryPage.fields.serviceNameDropdown, mysqlServiceName);
    backupInventoryPage.selectDropdownOption(backupInventoryPage.fields.locationDropdown, location.name);
    I.fillField(backupInventoryPage.fields.backupName, backupName);
    // TODO: uncomment when PMM-10899 will be fixed
    // I.fillField(backupInventoryPage.fields.description, 'test description');
    I.click(backupInventoryPage.buttons.addBackup);
    I.waitForVisible(backupInventoryPage.elements.pendingBackupByName(backupName), 10);
    backupInventoryPage.verifyBackupSucceeded(backupName);
    // TODO: add check file on AWS S3
  },
);

Scenario(
  '@PMM-T862 Verify user is able to perform MySQL restore @bm-mysql @not-ui-pipeline',
  async ({
    I, backupInventoryPage, backupAPI, restorePage, psMySql,
  }) => {
    const backupName = 'mysql_restore_test';
    const tableName = 'test';

    await psMySql.deleteTable(tableName);
    const artifactId = await backupAPI.startBackup(backupName, serviceId, locationId, false, false);

    await backupAPI.waitForBackupFinish(artifactId);
    I.refreshPage();
    backupInventoryPage.verifyBackupSucceeded(backupName);
    await psMySql.createTable(tableName);
    /* connection must be closed in correct way before restore backup. Restore procedure restarts mysql service */
    await psMySql.disconnectFromPS();
    backupInventoryPage.startRestore(backupName);
    await restorePage.waitForRestoreSuccess(backupName);

    await psMySql.asyncConnectToPS(mysqlCredentials);
    const tableExists = await psMySql.isTableExists(tableName);

    I.assertFalse(tableExists, `Table "${tableName}" is expected to be absent after restore backup operation`);
  },
);

Scenario(
  'PMM-T910 + PMM-T911 - Verify delete from storage is selected by default @bm-mysql @not-ui-pipeline',
  async ({
    I, backupInventoryPage, backupAPI, inventoryAPI,
  }) => {
    const backupName = 'mysql_artifact_delete_test';
    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MYSQL, mysqlServiceName);
    const artifactId = await backupAPI.startBackup(backupName, service_id, locationId, false, false);

    await backupAPI.waitForBackupFinish(artifactId);

    I.refreshPage();
    backupInventoryPage.verifyBackupSucceeded(backupName);

    const artifactName = await I.grabTextFrom(backupInventoryPage.elements.artifactName(backupName));

    await backupInventoryPage.openDeleteBackupModal(backupName);
    I.seeTextEquals(backupInventoryPage.messages.confirmDeleteText(artifactName), 'h4');
    I.seeTextEquals(backupInventoryPage.messages.forceDeleteLabelText, backupInventoryPage.elements.forceDeleteLabel);
    I.seeTextEquals(backupInventoryPage.messages.modalHeaderText, backupInventoryPage.elements.modalHeader);

    I.seeCheckboxIsChecked(backupInventoryPage.buttons.forceDeleteCheckbox);

    I.click(backupInventoryPage.buttons.confirmDelete);

    I.waitForInvisible(backupInventoryPage.buttons.deleteByName(backupName), 30);
  },
);

Scenario(
  '@PMM-T810 Verify user can restore MySQL backup from a scheduled backup @bm-mysql @not-ui-pipeline',
  async ({
    I, backupInventoryPage, scheduledAPI, backupAPI, restorePage, psMySql,
  }) => {
    // Every 2 mins schedule
    const schedule = {
      service_id: serviceId,
      location_id: locationId,
      cron_expression: '*/2 * * * *',
      name: 'for_restore_mysql_test',
      mode: scheduledAPI.backupModes.snapshot,
      description: '',
      isLogical: false,
      retry_interval: '30s',
      retries: 0,
      enabled: true,
      retention: 1,
    };
    const tableName = 'sh_test';
    const scheduleId = await scheduledAPI.createScheduledBackup(schedule);

    await psMySql.deleteTable(tableName);
    await backupAPI.waitForBackupFinish(null, schedule.name, 240);
    await scheduledAPI.disableScheduledBackup(scheduleId);

    I.refreshPage();
    await psMySql.createTable(tableName);
    backupInventoryPage.verifyBackupSucceeded(schedule.name);
    /* connection must be closed in correct way before restore backup. Restore procedure restarts mysql service */
    await psMySql.disconnectFromPS();
    backupInventoryPage.startRestore(schedule.name);
    await restorePage.waitForRestoreSuccess(schedule.name);

    await psMySql.asyncConnectToPS(mysqlCredentials);
    const tableExists = await psMySql.isTableExists(tableName);

    I.assertFalse(tableExists, `Table "${tableName}" is expected to be absent after restore backup operation`);
  },
);

Scenario(
  '@PMM-T848 Verify service no longer exists error message during restore @bm-mysql @not-ui-pipeline',
  async ({
    I, backupInventoryPage, backupAPI, inventoryAPI,
  }) => {
    const backupName = 'service_remove_backup';
    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MYSQL, mysqlServiceNameToDelete);
    const artifactId = await backupAPI.startBackup(backupName, service_id, locationId, false, false);

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
  '@PMM-T1057 @PMM-T1058 Verify pre checks for PS tools before backup @bm-mysql @not-ui-pipeline',
  async ({
    I, backupInventoryPage, addInstanceAPI, links,
  }) => {
    const backupName = 'test_pre_checks';

    await addInstanceAPI.addMysql(mysqlServiceNameForPreCheckTest);

    I.click(backupInventoryPage.buttons.openAddBackupModal);

    backupInventoryPage.selectDropdownOption(backupInventoryPage.fields.serviceNameDropdown, mysqlServiceNameForPreCheckTest);
    backupInventoryPage.selectDropdownOption(backupInventoryPage.fields.locationDropdown, location.name);
    I.fillField(backupInventoryPage.fields.backupName, backupName);
    I.click(backupInventoryPage.buttons.addBackup);
    await I.verifyPopUpMessage('software "mysqld" is not installed: incompatible service');

    await I.verifyCommand('docker exec pmm-server percona-release setup ps57');
    await I.verifyCommand('docker exec pmm-server dnf install -y Percona-Server-server-57');
    I.click(backupInventoryPage.buttons.addBackup);
    await I.verifyPopUpMessage('software "xtrabackup" is not installed: xtrabackup is not installed');

    I.seeTextEquals('Xtrabackup is not installed. ', backupInventoryPage.elements.addBackupModalError);
    I.seeAttributesOnElements(backupInventoryPage.elements.addBackupModalErrorReadMore, { href: links.xtrabackup80Docs });

    await I.verifyCommand('docker exec pmm-server dnf install -y percona-xtrabackup-24');
    I.click(backupInventoryPage.buttons.addBackup);
    await I.verifyPopUpMessage('software "qpress" is not installed: incompatible service');

    await I.verifyCommand('docker exec pmm-server dnf install -y qpress');
    I.click(backupInventoryPage.buttons.addBackup);

    I.waitForVisible(backupInventoryPage.elements.pendingBackupByName(backupName), 10);
  },
);

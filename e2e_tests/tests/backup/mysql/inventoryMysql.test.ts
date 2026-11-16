import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { ServiceType } from '@interfaces/inventory';

const psContainer = 'ps_pmm_8_4_1';
const locationName = 'mysql_backups';
const serviceName = 'mysql-with-backup-inventory';
const preCheckServiceName = 'mysql-backup-pre-checks';
const removePreCheckPackages =
  "docker exec --user root pmm-server sh -c 'dnf remove -y Percona-Server-server-57 percona-xtrabackup-24 qpress && percona-release disable ps-57 release && percona-release disable tools release'";
let backupManagementEnabled: boolean;
let locationId: string;
let serviceId: string;

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeAll(async ({ api, cliHelper, credentials }) => {
  backupManagementEnabled = (await api.settingsApi.getSettings()).settings.backup_management_enabled;
  await api.settingsApi.enableBackupManagement();
  await api.backupsApi.removeAllLocations();
  locationId = await api.backupsApi.addS3Location(locationName, 'MySQL backup location');
  await api.inventoryApi.removeNodesByName([preCheckServiceName]);
  cliHelper.execute(removePreCheckPackages).assertSuccess();
  cliHelper.removeService(psContainer, ServiceType.mysql, serviceName);
  cliHelper
    .execute(
      `docker exec ${psContainer} pmm-admin add mysql --username=${credentials.perconaServer.username} --password=${credentials.perconaServer.password} --query-source=perfschema ${serviceName}`,
    )
    .assertSuccess();
  serviceId = (await api.inventoryApi.getServiceDetailsByTypeAndPartialName(ServiceType.mysql, serviceName))
    .service_id;
});

pmmTest.beforeEach(async ({ api, backupInventoryPage, grafanaHelper }) => {
  await grafanaHelper.authorize();
  await api.backupsApi.removeAllArtifacts();
  await backupInventoryPage.open();
});

pmmTest.afterEach(async ({ api, cliHelper }) => {
  cliHelper.execute(`docker exec ${psContainer} systemctl start mysqld`).assertSuccess();
  await api.backupsApi.removeAllScheduledBackups();
  await api.backupsApi.removeAllArtifacts();
  await api.inventoryApi.removeNodesByName([preCheckServiceName]);
  cliHelper.execute(removePreCheckPackages).assertSuccess();
});

pmmTest.afterAll(async ({ api, cliHelper }) => {
  await api.backupsApi.removeAllLocations();
  cliHelper.removeService(psContainer, ServiceType.mysql, serviceName);
  await api.settingsApi.updateSettings({ enable_backup_management: backupManagementEnabled });
});

pmmTest(
  'PMM-T769 + PMM-T920 - Verify user is able to perform MySQL backup @bm-mysql @not-ui-pipeline',
  async ({ backupInventoryPage }) => {
    const backupName = 'mysql_backup_test';

    await pmmTest.step('Create the backup', async () => {
      await backupInventoryPage.buttons.createBackup.click();
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.service, serviceName);
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.location, locationName);
      await backupInventoryPage.inputs.backupName.fill(backupName);
      await backupInventoryPage.submitBackup();
      await expect(backupInventoryPage.builders.pendingStatus(backupName)).toBeVisible({
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await backupInventoryPage.verifyBackupStatus(backupName, 'BACKUP_STATUS_SUCCESS');
  },
);

pmmTest(
  'PMM-T862 - Verify user is able to perform MySQL restore @bm-mysql @not-ui-pipeline',
  async ({ api, backupInventoryPage, cliHelper, credentials }) => {
    const backupName = 'mysql_restore_test';

    cliHelper.queryMysql(psContainer, credentials.perconaServer, 'DROP TABLE IF EXISTS test');
    await api.backupsApi.verifyBackupSuccess(
      await api.backupsApi.startBackup(backupName, serviceId, locationId, {
        data_model: 'DATA_MODEL_PHYSICAL',
      }),
    );
    await backupInventoryPage.verifyBackupStatus(backupName, 'BACKUP_STATUS_SUCCESS');

    await pmmTest.step('Restore the backup over a newer table', async () => {
      cliHelper.queryMysql(
        psContainer,
        credentials.perconaServer,
        'CREATE TABLE IF NOT EXISTS test (id INT AUTO_INCREMENT PRIMARY KEY, user VARCHAR(20) NOT NULL) ENGINE=INNODB',
      );
      await backupInventoryPage.startRestore(backupName);
      await backupInventoryPage.verifyRestoreStatus(backupName, 'RESTORE_STATUS_SUCCESS');
    });

    await expect(() => {
      expect(
        cliHelper.queryMysql(
          psContainer,
          credentials.perconaServer,
          "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'mysql' AND table_name = 'test'",
        ),
        'The restore must remove the table created after the backup',
      ).toBe('0');
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.ONE_MINUTE });
  },
);

pmmTest(
  'PMM-T910 + PMM-T911 - Verify delete from storage is selected by default @bm-mysql @not-ui-pipeline',
  async ({ api, backupInventoryPage }) => {
    const backupName = 'mysql_artifact_delete_test';

    await api.backupsApi.verifyBackupSuccess(
      await api.backupsApi.startBackup(backupName, serviceId, locationId, {
        data_model: 'DATA_MODEL_PHYSICAL',
      }),
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
  'PMM-T810 - Verify user can restore MySQL backup from a scheduled backup @bm-mysql @not-ui-pipeline',
  async ({ api, backupInventoryPage, cliHelper, credentials }) => {
    const scheduleName = 'for_restore_mysql_test';

    cliHelper.queryMysql(psContainer, credentials.perconaServer, 'DROP TABLE IF EXISTS sh_test');

    const scheduleId = await api.backupsApi.createScheduledBackup({
      cron_expression: '*/2 * * * *',
      data_model: 'DATA_MODEL_PHYSICAL',
      description: '',
      enabled: true,
      location_id: locationId,
      mode: 'BACKUP_MODE_SNAPSHOT',
      name: scheduleName,
      retention: 1,
      retries: 0,
      retry_interval: '30s',
      service_id: serviceId,
    });

    await api.backupsApi.verifyBackupStatus(scheduleName, 'BACKUP_STATUS_SUCCESS');
    await api.backupsApi.disableScheduledBackup(scheduleId);

    await pmmTest.step('Restore the scheduled backup over a newer table', async () => {
      cliHelper.queryMysql(
        psContainer,
        credentials.perconaServer,
        'CREATE TABLE IF NOT EXISTS sh_test (id INT AUTO_INCREMENT PRIMARY KEY, user VARCHAR(20) NOT NULL) ENGINE=INNODB',
      );
      await backupInventoryPage.verifyBackupStatus(scheduleName, 'BACKUP_STATUS_SUCCESS');
      await backupInventoryPage.startRestore(scheduleName);
      await backupInventoryPage.verifyRestoreStatus(scheduleName, 'RESTORE_STATUS_SUCCESS');
    });

    await expect(() => {
      expect(
        cliHelper.queryMysql(
          psContainer,
          credentials.perconaServer,
          "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'mysql' AND table_name = 'sh_test'",
        ),
        'The restore must remove the table created after the backup',
      ).toBe('0');
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.ONE_MINUTE });
  },
);

pmmTest(
  'PMM-T1057 + PMM-T1058 - Verify pre checks for PS tools before backup @bm-mysql @not-ui-pipeline',
  async ({ api, backupInventoryPage, cliHelper, credentials }) => {
    const backupName = 'test_pre_checks';

    await api.remoteInstanceApi.addRemoteInstance({
      mysql: {
        add_node: { node_name: preCheckServiceName, node_type: 'NODE_TYPE_REMOTE_NODE' },
        address: psContainer,
        cluster: 'mysql_clstr',
        engine: 'DISCOVER_RDS_ENGINE_MYSQL',
        password: credentials.perconaServer.password,
        pmm_agent_id: 'pmm-server',
        port: '3306',
        qan_mysql_perfschema: true,
        service_name: preCheckServiceName,
        username: credentials.perconaServer.username,
      },
    });

    await pmmTest.step('Verify the backup needs mysqld on the PMM Server agent', async () => {
      await backupInventoryPage.buttons.createBackup.click();
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.service, preCheckServiceName);
      await backupInventoryPage.selectFromDropdown(backupInventoryPage.inputs.location, locationName);
      await backupInventoryPage.inputs.backupName.fill(backupName);
      await backupInventoryPage.submitBackup();
      await expect(backupInventoryPage.messages.popUp).toContainText(
        'software "mysqld" is not installed: incompatible service',
        { timeout: Timeouts.THIRTY_SECONDS },
      );
      await backupInventoryPage.buttons.closeAlert.click();
    });

    await pmmTest.step('Verify the backup needs xtrabackup once mysqld is installed', async () => {
      cliHelper
        .execute(
          "docker exec --user root pmm-server sh -c 'percona-release enable ps-57 release && percona-release enable tools release'",
        )
        .assertSuccess();
      cliHelper
        .execute('docker exec --user root pmm-server dnf install -y Percona-Server-server-57')
        .assertSuccess();
      await backupInventoryPage.submitBackup();
      await expect(backupInventoryPage.messages.popUp).toContainText(
        'software "xtrabackup" is not installed: xtrabackup is not installed',
        { timeout: Timeouts.THIRTY_SECONDS },
      );
      await backupInventoryPage.buttons.closeAlert.click();
      await expect(backupInventoryPage.elements.backupErrors).toHaveText(
        'Xtrabackup is not installed. Read more',
      );
      await expect(backupInventoryPage.elements.backupErrorsReadMore).toHaveAttribute(
        'href',
        'https://per.co.na/install_pxb',
      );
    });

    await pmmTest.step('Verify the backup needs qpress once xtrabackup is installed', async () => {
      cliHelper
        .execute('docker exec --user root pmm-server dnf install -y percona-xtrabackup-24')
        .assertSuccess();
      await backupInventoryPage.submitBackup();
      await expect(backupInventoryPage.messages.popUp).toContainText(
        'software "qpress" is not installed: incompatible service',
        { timeout: Timeouts.THIRTY_SECONDS },
      );
      await backupInventoryPage.buttons.closeAlert.click();
    });

    cliHelper.execute('docker exec --user root pmm-server dnf install -y qpress').assertSuccess();
    await backupInventoryPage.submitBackup();
    await expect(backupInventoryPage.builders.pendingStatus(backupName)).toBeVisible({
      timeout: Timeouts.TEN_SECONDS,
    });
  },
);

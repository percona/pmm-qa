import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { ServiceType } from '@interfaces/inventory';
import { s3StorageConnection } from '@testdata/backupLocations';

const location = { description: 'test description', name: 's3_location' };
const mongoServiceName = 'mongo-backup-locations';
let backupManagementEnabled: boolean;

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeAll(async ({ api, cliHelper }) => {
  backupManagementEnabled = (await api.settingsApi.getSettings()).settings.backup_management_enabled;
  await api.settingsApi.enableBackupManagement();
  cliHelper.removeService('rs101', ServiceType.mongodb, mongoServiceName);
  cliHelper
    .execute(
      `docker exec rs101 pmm-admin add mongodb --username=pmm --password=pmmpass --port=27017 --service-name=${mongoServiceName} --replication-set=rs0 --cluster=rs`,
    )
    .assertSuccess();
});

pmmTest.beforeEach(async ({ api, grafanaHelper, storageLocationsPage }) => {
  await grafanaHelper.authorize();
  await api.backupsApi.removeAllLocations();
  await storageLocationsPage.open();
});

pmmTest.afterEach(async ({ api }) => {
  await api.backupsApi.removeAllLocations();
});

pmmTest.afterAll(async ({ api, cliHelper }) => {
  await api.settingsApi.updateSettings({ enable_backup_management: backupManagementEnabled });
  cliHelper.removeService('rs101', ServiceType.mongodb, mongoServiceName);
});

pmmTest(
  'PMM-T691 - Verify message about no storage locations @bm-locations',
  async ({ storageLocationsPage }) => {
    await expect(storageLocationsPage.elements.noData).toContainText('No storage locations found', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

pmmTest(
  'PMM-T2507 - Verify add storage location modal elements @bm-locations',
  async ({ storageLocationsPage }) => {
    await storageLocationsPage.openAddLocationModal();

    await pmmTest.step('Verify the field labels', async () => {
      for (const [field, label] of [
        ['accessKey', 'Access Key'],
        ['bucketName', 'Bucket Name'],
        ['description', 'Description'],
        ['endpoint', 'Endpoint'],
        ['name', 'Name'],
        ['secretKey', 'Secret Key'],
        ['type', 'Type'],
      ] as const) {
        await expect(storageLocationsPage.builders.fieldLabel(field)).toHaveText(label);
      }
    });

    await pmmTest.step('Verify S3 is the selected type', async () => {
      await expect(storageLocationsPage.builders.typeRadio('S3')).toBeChecked();
      await expect(storageLocationsPage.builders.typeRadio('Local Client')).not.toBeChecked();
    });

    await pmmTest.step('Verify Add and Test are disabled and Cancel is enabled', async () => {
      await expect(storageLocationsPage.buttons.addLocation).toHaveText('Add');
      await expect(storageLocationsPage.buttons.addLocation).toBeDisabled();
      await expect(storageLocationsPage.buttons.testLocation).toHaveText('Test');
      await expect(storageLocationsPage.buttons.testLocation).toBeDisabled();
      await expect(storageLocationsPage.buttons.cancel).toHaveText('Cancel');
      await expect(storageLocationsPage.buttons.cancel).toBeEnabled({ timeout: Timeouts.TEN_SECONDS });
    });
  },
);

pmmTest(
  'PMM-T696 - Verify validation for add storage location modal @bm-locations',
  async ({ storageLocationsPage }) => {
    await storageLocationsPage.openAddLocationModal();
    await storageLocationsPage.touchRequiredFields();

    for (const field of storageLocationsPage.requiredFields) {
      await expect(storageLocationsPage.builders.fieldError(field)).toHaveText('Required field');
    }
  },
);

pmmTest(
  'PMM-T707 - Verify user is able to test connection for storage location @bm-locations',
  async ({ storageLocationsPage }) => {
    await storageLocationsPage.openAddLocationModal();
    await storageLocationsPage.fillS3Location(location.name);
    await expect(storageLocationsPage.buttons.addLocation).toBeEnabled({ timeout: Timeouts.TEN_SECONDS });
    await expect(storageLocationsPage.buttons.testLocation).toBeEnabled({ timeout: Timeouts.TEN_SECONDS });

    await storageLocationsPage.buttons.testLocation.click();
    await expect(storageLocationsPage.messages.popUp).toContainText('This storage location is valid', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

for (const { error, field, value } of [
  { error: "Bucket doesn't exist", field: 'bucket_name', value: 'pmm-backup12' },
  {
    error: 'InvalidAccessKeyId: The Access Key Id you provided does not exist in our records..',
    field: 'access_key',
    value: 'invalid',
  },
  {
    error:
      'SignatureDoesNotMatch: The request signature we calculated does not match the signature you provided. Check your key and signing method.',
    field: 'secret_key',
    value: 'invalid',
  },
] as const) {
  pmmTest(
    `PMM-T708 - Verify errors related to s3 storage location @bm-locations | ${field}`,
    async ({ storageLocationsPage }) => {
      await storageLocationsPage.openAddLocationModal();
      await storageLocationsPage.fillS3Location(location.name, { ...s3StorageConnection, [field]: value });
      await storageLocationsPage.buttons.testLocation.click();
      await expect(storageLocationsPage.messages.popUp).toContainText(error, {
        timeout: Timeouts.ONE_MINUTE,
      });
    },
  );
}

pmmTest(
  'PMM-T683 + PMM-T684 - Verify user is able to add storage location @bm-locations',
  async ({ storageLocationsPage }) => {
    await pmmTest.step('Add an S3 storage location', async () => {
      await storageLocationsPage.openAddLocationModal();
      await storageLocationsPage.fillS3Location(location.name);
      await storageLocationsPage.buttons.addLocation.click();
      await expect(storageLocationsPage.messages.popUp).toContainText(
        'Backup location was successfully added',
        {
          timeout: Timeouts.THIRTY_SECONDS,
        },
      );
    });

    await expect(storageLocationsPage.elements.columnHeaders).toHaveText([
      'Name',
      'Type',
      'Endpoint or path',
      'Actions',
    ]);

    await pmmTest.step('Verify the storage location is listed', async () => {
      await storageLocationsPage.builders.actionsToggle(location.name).click();
      await expect(storageLocationsPage.builders.deleteButton(location.name)).toBeVisible();
      await expect(storageLocationsPage.builders.editButton(location.name)).toBeVisible();
      await expect(storageLocationsPage.builders.cell(location.name, 'S3')).toBeVisible();
      await expect(
        storageLocationsPage.builders.cell(location.name, s3StorageConnection.endpoint),
      ).toBeVisible();
    });
  },
);

pmmTest(
  'PMM-T690 - Verify user is not able to add storage location with the same name @bm-locations',
  async ({ api, storageLocationsPage }) => {
    await api.backupsApi.addS3Location(location.name, location.description);
    await storageLocationsPage.open();
    await storageLocationsPage.openAddLocationModal();
    await storageLocationsPage.fillS3Location(location.name);
    await storageLocationsPage.buttons.addLocation.click();
    await expect(storageLocationsPage.messages.popUp).toContainText(
      `Location with name "${location.name}" already exists.`,
      { timeout: Timeouts.THIRTY_SECONDS },
    );
  },
);

pmmTest(
  'PMM-T693 - Verify user is able to delete storage location @bm-locations',
  async ({ api, storageLocationsPage }) => {
    await api.backupsApi.addS3Location(location.name, location.description);
    await storageLocationsPage.open();

    await pmmTest.step('Verify the delete modal and cancel it', async () => {
      await storageLocationsPage.openDeleteModal(location.name);
      await expect(storageLocationsPage.elements.modalHeader).toContainText('Delete Storage Location', {
        timeout: Timeouts.TEN_SECONDS,
      });
      await expect(storageLocationsPage.elements.deleteMessage).toHaveText(
        `Are you sure you want to delete the Storage Location "${location.name}"?`,
      );
      await expect(storageLocationsPage.elements.deleteWarning).toHaveText(
        'This action will only remove the Storage Location from PMM inventory, but will not delete the physical storage.',
      );
      await storageLocationsPage.buttons.cancelDelete.click();
      await expect(storageLocationsPage.elements.modalHeader).toBeHidden();
    });

    await pmmTest.step('Delete the storage location', async () => {
      await storageLocationsPage.openDeleteModal(location.name);
      await storageLocationsPage.buttons.confirmDelete.click();
      await expect(storageLocationsPage.messages.popUp).toContainText(
        `Backup location "${location.name}" successfully deleted.`,
        { timeout: Timeouts.THIRTY_SECONDS },
      );
      await expect(storageLocationsPage.builders.row(location.name)).toBeHidden();
    });
  },
);

pmmTest(
  'PMM-T695 - Verify user is not able to delete storage location that has backups @bm-locations',
  async ({ api, storageLocationsPage }) => {
    const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mongodb,
      mongoServiceName,
    );
    const locationId = await api.backupsApi.addS3Location(location.name, location.description);

    await api.backupsApi.verifyBackupSuccess(
      await api.backupsApi.startBackup('delete_location', service_id, locationId),
    );
    await storageLocationsPage.open();
    await storageLocationsPage.openDeleteModal(location.name);
    await storageLocationsPage.buttons.confirmDelete.click();
    await expect(storageLocationsPage.messages.popUp).toContainText(
      `backup location with ID "${locationId}" has artifacts.`,
      { timeout: Timeouts.THIRTY_SECONDS },
    );
  },
);

pmmTest(
  'PMM-T694 - Verify user is able to force delete storage location that has backups @bm-locations',
  async ({ api, backupInventoryPage, storageLocationsPage }) => {
    const backupName = 'delete_location';
    const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mongodb,
      mongoServiceName,
    );
    const locationId = await api.backupsApi.addS3Location(location.name, location.description);
    const artifactId = await api.backupsApi.startBackup(backupName, service_id, locationId);

    await api.backupsApi.verifyBackupSuccess(artifactId);
    await storageLocationsPage.open();

    await pmmTest.step('Force delete the storage location', async () => {
      await storageLocationsPage.openDeleteModal(location.name);
      await storageLocationsPage.buttons.forceDelete.click({ force: true });
      await storageLocationsPage.buttons.confirmDelete.click();
      await expect(storageLocationsPage.messages.popUp).toContainText(
        `Backup location "${location.name}" successfully deleted.`,
        { timeout: Timeouts.THIRTY_SECONDS },
      );
      await expect(storageLocationsPage.builders.row(location.name)).toBeHidden();
    });

    await pmmTest.step('Verify the backup is gone', async () => {
      expect((await api.backupsApi.getArtifacts()).map(({ artifact_id }) => artifact_id)).not.toContain(
        artifactId,
      );
      await backupInventoryPage.open();
      await expect(backupInventoryPage.builders.artifactRow(backupName)).toBeHidden();
    });
  },
);

pmmTest(
  'PMM-T692 - Verify user is able to edit storage location @bm-locations',
  async ({ api, storageLocationsPage }) => {
    const updatedLocation = { description: 'updated description', name: 'updated location' };

    await api.backupsApi.addS3Location(location.name, location.description);
    await storageLocationsPage.open();

    await pmmTest.step('Open the edit modal and verify the saved fields', async () => {
      await storageLocationsPage.openEditModal(location.name);
      await expect(storageLocationsPage.buttons.addLocation).toContainText('Edit', {
        timeout: Timeouts.TEN_SECONDS,
      });
      await expect(storageLocationsPage.buttons.addLocation).toBeDisabled();
      await storageLocationsPage.verifyLocationFields(location.name, location.description);
    });

    await pmmTest.step('Rename the storage location and change its description', async () => {
      await storageLocationsPage.builders.textInput('name').fill(updatedLocation.name);
      await storageLocationsPage.inputs.description.fill(updatedLocation.description);
      await storageLocationsPage.buttons.addLocation.click();
      await expect(storageLocationsPage.messages.popUp).toContainText(
        `Backup location "${updatedLocation.name}" was successfully updated`,
        { timeout: Timeouts.THIRTY_SECONDS },
      );
    });

    await storageLocationsPage.openEditModal(updatedLocation.name);
    await storageLocationsPage.verifyLocationFields(updatedLocation.name, updatedLocation.description);
  },
);

pmmTest(
  'PMM-T689 - Verify user is able see storage location details @bm-locations',
  async ({ api, storageLocationsPage }) => {
    await api.backupsApi.addS3Location(location.name, location.description);
    await storageLocationsPage.open();

    await pmmTest.step('Open the details row and verify the storage location details', async () => {
      await storageLocationsPage.builders.showDetails(location.name).click();
      await expect(storageLocationsPage.elements.detailsDescription).toHaveText(location.description);
      await expect(
        storageLocationsPage.builders.detailsBucket(s3StorageConnection.bucket_name),
      ).toBeVisible();
      await expect(storageLocationsPage.elements.detailsAccessKey).toContainText(
        s3StorageConnection.access_key,
      );
      await expect(storageLocationsPage.elements.detailsSecretKey).toContainText('*****');
      await storageLocationsPage.buttons.showSecret.click();
      await expect(storageLocationsPage.elements.detailsSecretKey).toContainText(
        s3StorageConnection.secret_key,
      );
    });

    await storageLocationsPage.builders.hideDetails(location.name).click();
    await expect(storageLocationsPage.elements.detailsWrapper).toBeHidden();
  },
);

pmmTest(
  'PMM-T896 - Verify user is able to force delete location after MongoDB restore @bm-locations',
  async ({ api, backupInventoryPage, page, storageLocationsPage }) => {
    const backupName = 'mongo_force_delete_locations_test';
    const mongoLocationName = 'mongoL';
    const locationId = await api.backupsApi.addS3Location(mongoLocationName, location.description);
    const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mongodb,
      mongoServiceName,
    );
    const artifactId = await api.backupsApi.startBackup(backupName, service_id, locationId);

    await api.backupsApi.verifyBackupSuccess(artifactId);

    const restoreId = await pmmTest.step('Restore the backup', async () => {
      const id = await api.backupsApi.startRestore(artifactId, service_id);

      expect(id, 'The restore must return its id').toMatch(/\S/);
      await expect
        .poll(
          async () =>
            (await api.backupsApi.getRestores()).find(({ restore_id }) => restore_id === id)?.status,
          { intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES },
        )
        .toMatch(/^RESTORE_STATUS_(?!IN_PROGRESS$)/);

      return id;
    });

    await pmmTest.step('Verify the location with artifacts cannot be deleted without force', async () => {
      await page.reload();
      await storageLocationsPage.openDeleteModal(mongoLocationName);
      await expect(storageLocationsPage.buttons.confirmDelete).toBeVisible({
        timeout: Timeouts.TWENTY_SECONDS,
      });
      await storageLocationsPage.buttons.confirmDelete.click();
      await expect(storageLocationsPage.messages.popUp).toContainText(
        `backup location with ID "${locationId}" has artifacts.`,
        { timeout: Timeouts.THIRTY_SECONDS },
      );
      await storageLocationsPage.buttons.closeAlert.click();
    });

    await pmmTest.step('Force delete the location', async () => {
      await storageLocationsPage.buttons.forceDelete.click({ force: true });
      await expect(storageLocationsPage.buttons.forceDelete).toBeChecked();
      await storageLocationsPage.buttons.confirmDelete.click({ force: true });
      await expect(storageLocationsPage.messages.popUp).toContainText(
        `Backup location "${mongoLocationName}" successfully deleted.`,
        { timeout: Timeouts.THIRTY_SECONDS },
      );
      await expect(storageLocationsPage.builders.row(mongoLocationName)).toBeHidden();
    });

    await pmmTest.step('Verify the backup and its restore are gone', async () => {
      expect((await api.backupsApi.getRestores()).map(({ restore_id }) => restore_id)).not.toContain(
        restoreId,
      );
      expect((await api.backupsApi.getArtifacts()).map(({ artifact_id }) => artifact_id)).not.toContain(
        artifactId,
      );
      await backupInventoryPage.open(backupInventoryPage.urls.restoreHistory);
      await expect(backupInventoryPage.builders.artifactRow(backupName)).toBeHidden();
      await backupInventoryPage.open();
      await expect(backupInventoryPage.builders.artifactRow(backupName)).toBeHidden();
    });
  },
);

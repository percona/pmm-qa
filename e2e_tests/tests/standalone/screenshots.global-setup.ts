import { test as setup } from '@playwright/test';
import BackupsApi from '@api/backups.api';
import InventoryApi from '@api/inventory.api';
import SettingsApi from '@api/settings.api';

setup('seed data for dashboard screenshots', async ({ request }) => {
  const settingsApi = new SettingsApi(request);
  const inventoryApi = new InventoryApi(request);
  const backupsApi = new BackupsApi(request);

  await settingsApi.enableBackupManagement();

  const mongoBackupService = await inventoryApi.getServiceDetailsByRegexAndParameters('^rs101(_\\d+)?$', {
    cluster: 'replicaset',
  });

  await backupsApi.ensureMongoBackupData(mongoBackupService);
});

import * as path from 'path';
import { test as setup } from '@playwright/test';
import BackupsApi from '@api/backups.api';
import InventoryApi from '@api/inventory.api';
import SettingsApi from '@api/settings.api';

const STORAGE_STATE_PATH = path.resolve(__dirname, '../../.auth/screenshots.json');

setup('authenticate and seed data for dashboard screenshots', async ({ page, request }) => {
  const password = process.env.ADMIN_PASSWORD || 'admin';
  const authToken = Buffer.from(`admin:${password}`).toString('base64');

  // Authenticate and persist storage state for downstream tests.
  await page.setExtraHTTPHeaders({ Authorization: `Basic ${authToken}` });
  await page.request.post('graph/login', { data: { password, user: 'admin' } });
  await page.goto('');
  await page.context().storageState({ path: STORAGE_STATE_PATH });

  // Seed backup data.
  const settingsApi = new SettingsApi(request);
  const inventoryApi = new InventoryApi(request);
  const backupsApi = new BackupsApi(request);

  await settingsApi.enableBackupManagement();

  const mongoBackupService = await inventoryApi.getServiceDetailsByRegexAndParameters('^rs101(_\\d+)?$', {
    cluster: 'replicaset',
  });

  await backupsApi.ensureMongoBackupData(mongoBackupService);
});

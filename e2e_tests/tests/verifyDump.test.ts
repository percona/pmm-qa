import fs from 'node:fs';
import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import { extractTarGz } from '@helpers/archive.helper';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe.configure({ mode: 'default' });

const sftpVolume = 'output/sftp';
const dumpSuccess = 'DUMP_STATUS_SUCCESS';
let dumpId = '';

pmmTest.beforeAll(async ({ cliHelper }) => {
  fs.mkdirSync(sftpVolume, { recursive: true });
  fs.chmodSync(sftpVolume, 0o777);
  cliHelper.execute('docker compose -f docker-compose.yml up -d --wait sftp-server').assertSuccess();
});

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ request }) => {
  if (dumpId) {
    const response = await request.post(apiEndpoints.dumps.batchDelete, {
      data: { dump_ids: [dumpId] },
      headers: GrafanaHelper.getAuthHeader(),
      timeout: Timeouts.ONE_MINUTE,
    });

    expect(response.status()).toEqual(200);
  }

  dumpId = '';
});

pmmTest.afterAll(async ({ cliHelper }) => {
  cliHelper.execute('docker compose -f docker-compose.yml rm -fs sftp-server').assertSuccess();
});

pmmTest(
  'PMM-T1835 - Create Dump Archive and Verify its successful in UI @dump',
  async ({ api, dumpPage, page }) => {
    dumpId = (await api.dumpApi.createDump()).dump_id;
    await page.goto(dumpPage.url);
    await expect
      .poll(async () => (await api.dumpApi.getDump(dumpId))?.status, { timeout: Timeouts.ONE_MINUTE })
      .toBe(dumpSuccess);
    await expect(dumpPage.builders.row(dumpId)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
  },
);

pmmTest('PMM-T1835 - Verify Edit Buttons are Enabled for Dump @dump', async ({ api, dumpPage, page }) => {
  dumpId = (await api.dumpApi.createDump()).dump_id;
  await expect
    .poll(async () => (await api.dumpApi.getDump(dumpId))?.status, { timeout: Timeouts.ONE_MINUTE })
    .toBe(dumpSuccess);
  await page.goto(dumpPage.url);

  await pmmTest.step('Verify Download is enabled in the row menu', async () => {
    await dumpPage.builders.rowMenu(dumpId).click();
    await expect(dumpPage.builders.menuItem('Download')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  await pmmTest.step('Verify Send to Support is enabled in the row menu', async () => {
    await dumpPage.builders.rowMenu(dumpId).click();
    await expect(dumpPage.builders.menuItem('Send to Support')).toBeVisible();
  });
});

pmmTest(
  'PMM-T1835 - Download and Verify Dump Archive with QAN enabled @dump',
  async ({ api, dumpPage, page }, testInfo) => {
    dumpId = (await api.dumpApi.createDump([], true)).dump_id;
    await expect
      .poll(async () => (await api.dumpApi.getDump(dumpId))?.status, { timeout: Timeouts.ONE_MINUTE })
      .toBe(dumpSuccess);
    await page.goto(dumpPage.url);
    await expect(dumpPage.builders.row(dumpId)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });

    const { dirs, files } = extractTarGz(await api.dumpApi.downloadDump(dumpId), testInfo.outputPath(dumpId));

    expect(dirs, `Expected 2 folders in the archive but found ${dirs}`).toHaveLength(2);
    expect(files, `Expected 5 files in the archive but found ${files}`).toHaveLength(5);
  },
);

pmmTest(
  'PMM-T1835 - Download and Verify Dump Archive with QAN disabled @dump',
  async ({ api, dumpPage, page }, testInfo) => {
    dumpId = (await api.dumpApi.createDump([], false)).dump_id;
    await expect
      .poll(async () => (await api.dumpApi.getDump(dumpId))?.status, { timeout: Timeouts.ONE_MINUTE })
      .toBe(dumpSuccess);
    await page.goto(dumpPage.url);
    await expect(dumpPage.builders.row(dumpId)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });

    const { dirs, files } = extractTarGz(await api.dumpApi.downloadDump(dumpId), testInfo.outputPath(dumpId));

    expect(dirs, `Expected 1 folders in the archive but found ${dirs}`).toHaveLength(1);
    expect(files, `Expected 4 files in the archive but found ${files}`).toHaveLength(4);
  },
);

pmmTest(
  'PMM-T1835 - Check Dump Archives can be sent to Support in UI @dump',
  async ({ api, dumpPage, page }, testInfo) => {
    dumpId = (await api.dumpApi.createDump()).dump_id;
    await expect
      .poll(async () => (await api.dumpApi.getDump(dumpId))?.status, { timeout: Timeouts.ONE_MINUTE })
      .toBe(dumpSuccess);
    await page.goto(dumpPage.url);

    await pmmTest.step('Send the dump to the SFTP server', async () => {
      await dumpPage.builders.rowMenu(dumpId).click();
      await dumpPage.builders.menuItem('Send to Support').click();
      await expect(dumpPage.elements.sendToSupportHeading).toBeVisible();
      await dumpPage.inputs.address.fill('sftp-server:22');
      await dumpPage.inputs.name.fill('foo');
      await dumpPage.inputs.password.fill('password');
      await dumpPage.inputs.directory.fill('/upload/');
      await dumpPage.buttons.send.click();
      await expect(dumpPage.messages.sentToSupport).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
    });

    const archive = `${sftpVolume}/${dumpId}.tar.gz`;

    await expect(() => {
      const { dirs, files } = extractTarGz(fs.readFileSync(archive), testInfo.outputPath(dumpId));

      expect(dirs, `Expected 2 folders in the archive but found ${dirs}`).toHaveLength(2);
      expect(files, `Expected 5 files in the archive but found ${files}`).toHaveLength(5);
    }).toPass({ intervals: [Timeouts.ONE_SECOND], timeout: Timeouts.ONE_MINUTE });
  },
);

pmmTest('PMM-T1835 - Verify Dump extraction logs are visible @dump', async ({ api, dumpPage, page }) => {
  dumpId = (await api.dumpApi.createDump()).dump_id;
  await expect
    .poll(async () => (await api.dumpApi.getDump(dumpId))?.status, { timeout: Timeouts.ONE_MINUTE })
    .toBe(dumpSuccess);
  await page.goto(dumpPage.url);
  await dumpPage.builders.rowMenu(dumpId).click();
  await dumpPage.builders.menuItem('View logs').click();
  await expect(dumpPage.elements.modalHeader).toContainText(`Logs for ${dumpId}`);
});

pmmTest('PMM-T1835 - Verify details of Dump based on Service Name @dump', async ({ api, dumpPage, page }) => {
  dumpId = (await api.dumpApi.createDump(['pmm-server-postgresql'])).dump_id;
  await expect
    .poll(async () => (await api.dumpApi.getDump(dumpId))?.status, { timeout: Timeouts.ONE_MINUTE })
    .toBe(dumpSuccess);
  await page.goto(dumpPage.url);
  await dumpPage.builders.rowDetails(dumpId).click();
  await expect(dumpPage.builders.serviceName('pmm-server-postgresql')).toBeVisible({
    timeout: Timeouts.ONE_MINUTE,
  });
});

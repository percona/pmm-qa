import pmmTest from '@fixtures/pmmTest';
import { dontSeeEntriesInZip, seeEntriesInZip } from '@helpers/archive.helper';

pmmTest.beforeEach(async ({ grafanaHelper, page }) => {
  await grafanaHelper.authorize();
  await page.goto('pmm-ui/help', { waitUntil: 'load' });
});

/* eslint-disable-next-line playwright/expect-expect -- zip entry assertions live in archive.helper */
pmmTest('PMM-T1830 - Verify downloading server diagnostics logs @menu', async ({ api, helpPage }) => {
  const download = await helpPage.exportLogs();
  const path = await download.path();

  if (!path) {
    throw new Error('Download path is null');
  }

  await seeEntriesInZip(path, ['pmm-agent.yaml', 'pmm-managed.log', 'pmm-agent.log']);

  if ((await api.serverApi.getPmmVersion()).minor > 40) {
    await dontSeeEntriesInZip(path, ['alertmanager.yml', 'alertmanager.base.yml']);
  }
});

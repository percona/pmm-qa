import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';

pmmTest.beforeEach(async ({ grafanaHelper, page }) => {
  await page.goto('');
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM- 2075 Verify there is no "Want more Advisors?" message on Advisors page @settings',
  async ({ page, portalRemoval }) => {
    await pmmTest.step('Check Advisors UI and iframe for portal content', async () => {
      await page.goto(portalRemoval.advisorsUrl);

      await expect(portalRemoval.elements.advisorsText).toHaveCount(0);
      await expect(portalRemoval.elements.connectToPlatform).toHaveCount(0);
    });
  },
);

pmmTest('Verify Settings UI elements are removed @settings', async ({ page, portalRemoval }) => {
  await pmmTest.step('Check Settings UI and iframe for portal content', async () => {
    await page.goto(portalRemoval.settingsUrl);

    await expect(portalRemoval.elements.perconaPlatformTab).toHaveCount(0);
  });
});

pmmTest(
  'Verify navigation to removed Percona Platform URLs results in page not found @settings',
  async ({ page, portalRemoval }) => {
    for (const url of portalRemoval.removedUrls) {
      await pmmTest.step(`Check navigation to ${url}`, async () => {
        await page.goto(url);
        await expect(portalRemoval.elements.pageNotFound).toBeVisible();
      });
    }
  },
);

pmmTest('Verify Percona Platform connect API is disabled @settings', async ({ page, portalRemoval }) => {
  await pmmTest.step('API platform connect disabled', async () => {
    await portalRemoval.openAdvancedSettings();

    const response = await page.request.post('/v1/platform:connect', {
      data: {
        personal_access_token: 'test-token',
        server_name: 'server-name',
      },
      headers: {
        Authorization: `Basic ${GrafanaHelper.getToken()}`,
        'Content-Type': 'application/json',
      },
    });

    expect([404]).toContain(response.status());
  });
});

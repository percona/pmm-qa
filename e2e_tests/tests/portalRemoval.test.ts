import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page }) => {
  await page.goto('');
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM- 2075 Verify there is no "Want more Advisors?" message on Advisors page @settings',
  async ({ page, portalRemoval }) => {
    await pmmTest.step('Check Advisors UI and iframe for portal content', async () => {
      await page.goto('/advisors');

      for (const isIframe of [false, true]) {
        await expect(portalRemoval.advisorsText(isIframe)).toHaveCount(0);
        await expect(portalRemoval.connectToPlatform(isIframe)).toHaveCount(0);
      }
    });
  },
);

pmmTest('Verify Settings UI elements are removed @settings', async ({ page, portalRemoval }) => {
  await pmmTest.step('Check Settings UI and iframe for portal content', async () => {
    await page.goto('/graph/settings');

    for (const isIframe of [false, true]) {
      await expect(portalRemoval.perconaPlatformTab(isIframe)).toHaveCount(0);
    }
  });
});

pmmTest(
  'Verify navigation to removed Percona Platform URLs results in page not found @settings',
  async ({ page, portalRemoval }) => {
    const removedUrls = ['/entitlements', '/tickets', '/settings/percona-platform'];

    for (const url of removedUrls) {
      await pmmTest.step(`Check navigation to ${url}`, async () => {
        await page.goto(url);
        await expect(portalRemoval.elements.pageNotFound).toBeVisible();
      });
    }
  },
);

pmmTest('Verify Percona Platform connect API is disabled @settings', async ({ request }) => {
  await pmmTest.step('API platform connect disabled', async () => {
    const response = await request.post('/v1/platform:connect', {
      data: {
        personal_access_token: 'test-token',
        server_name: 'server-name',
      },
    });

    expect([404, 410, 501]).toContain(response.status());
  });
});

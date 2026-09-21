import * as fs from 'fs';
import * as path from 'path';
import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import GrafanaHelper from '@helpers/grafana.helper';
import { DASHBOARDS, nameFromUrl, resolveServiceName } from '../../testdata/dashboards.registry';

const outRoot = path.resolve(process.cwd(), path.join('screenshots', 'dashboards'));

pmmTest.describe('Capture dashboard screenshots @standalone', () => {
  pmmTest.beforeEach(async ({ page }) => {
    const authToken = GrafanaHelper.getToken();

    await page.setExtraHTTPHeaders({ Authorization: `Basic ${authToken}` });
    await page.request.post('graph/login', {
      data: { password: process.env.ADMIN_PASSWORD || 'admin', user: 'admin' },
    });
  });

  for (const dashboardEntry of DASHBOARDS) {
    const name = nameFromUrl(dashboardEntry.url);

    pmmTest(`${dashboardEntry.folder}/${name} screenshot`, async ({ api, dashboard, page, urlHelper }) => {
      const serviceName = await resolveServiceName(dashboardEntry.serviceName, api.inventoryApi);
      const dir = path.join(outRoot, dashboardEntry.folder);
      const regularFile = path.join(dir, `${name}.png`);
      const extendedFile = path.join(dir, `${name}-extended.png`);
      const fullUrl = urlHelper.buildUrlWithParameters(
        `${process.env.PMM_UI_URL}pmm-ui/${dashboardEntry.url}`,
        {
          cluster: dashboardEntry.cluster,
          from: 'now-15m',
          replicationSet: dashboardEntry.replicationSet,
          serviceName,
          to: 'now',
        },
      );
      const frame = page.frameLocator('#grafana-iframe');

      fs.mkdirSync(dir, { recursive: true });

      // Open dashboard and wait for all panels to load.
      await page.goto(fullUrl);

      for (let i = 0; i < 3; i++) {
        await dashboard.loadAllPanels();
      }

      // Find the height of the dashboard content.
      const bottomPixel = await page.locator('#grafana-iframe').evaluate((iframe: HTMLIFrameElement) => {
        const h = Math.ceil(
          (iframe.contentWindow?.scrollY ?? 0) + (iframe.contentWindow?.innerHeight ?? 1_080),
        );

        iframe.style.height = `${h}px`;
        iframe.style.maxHeight = 'none';

        return h;
      });

      // Scroll to top for regular viewport screenshot (1920x1080).
      await frame.getByRole('region').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: regularFile });
      await page.setViewportSize({ height: Math.max(1_080, bottomPixel), width: 1_920 });
      await page.screenshot({ fullPage: true, path: extendedFile });
      await page.setViewportSize({ height: 1_080, width: 1_920 });

      expect(
        fs.existsSync(regularFile),
        `Regular screenshot was not created for ${dashboardEntry.url}`,
      ).toBeTruthy();
      expect(
        fs.existsSync(extendedFile),
        `Extended screenshot was not created for ${dashboardEntry.url}`,
      ).toBeTruthy();
    });
  }
});

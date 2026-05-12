import * as fs from 'fs';
import * as path from 'path';
import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import { DASHBOARDS, nameFromUrl, resolveServiceName } from '../../testdata/dashboards.registry';

pmmTest(
  'Capture dashboard screenshots @standalone',
  async ({ api, dashboard, grafanaHelper, page, urlHelper }) => {
    pmmTest.setTimeout(30 * 60_000);

    const outRoot = path.resolve(process.cwd(), path.join('screenshots', 'dashboards'));
    const captured: { folder: string; name: string; url: string }[] = [];

    fs.mkdirSync(outRoot, { recursive: true });
    await grafanaHelper.authorize();

    for (const entry of DASHBOARDS) {
      const serviceName = await resolveServiceName(entry.serviceName, api.inventoryApi);
      const name = nameFromUrl(entry.url);
      const dir = path.join(outRoot, entry.folder);
      const regularFile = path.join(dir, `${name}.png`);
      const extendedFile = path.join(dir, `${name}-extended.png`);
      const fullUrl = urlHelper.buildUrlWithParameters(`${process.env.PMM_UI_URL}${entry.url}`, {
        cluster: entry.cluster,
        from: 'now-15m',
        replicationSet: entry.replicationSet,
        serviceName,
        to: 'now',
      });
      const frame = page.frameLocator('#grafana-iframe');

      fs.mkdirSync(dir, { recursive: true });

      // Open dashboard and wait for all panels to load
      await page.goto(fullUrl, { timeout: 30_000 });

      for (let i = 0; i < 3; i++) {
        await dashboard.loadAllPanels();
      }

      // Find the height of the dashboard content
      const bottomPixel = await page.locator('#grafana-iframe').evaluate((iframe: HTMLIFrameElement) => {
        const h = Math.ceil(
          (iframe.contentWindow?.scrollY ?? 0) + (iframe.contentWindow?.innerHeight ?? 1_080),
        );

        iframe.style.height = `${h}px`;
        iframe.style.maxHeight = 'none';

        return h;
      });

      // Scroll to top for regular viewport screenshot (1920×1080)
      await frame.getByRole('region').first().scrollIntoViewIfNeeded();
      // Capture regular and extended screenshots
      await page.screenshot({ path: regularFile });
      await page.setViewportSize({ height: Math.max(1_080, bottomPixel), width: 1_920 });
      await page.screenshot({ fullPage: true, path: extendedFile });
      await page.setViewportSize({ height: 1_080, width: 1_920 });

      captured.push({ folder: entry.folder, name, url: fullUrl });
    }

    console.log(`[capture-dashboard-screenshots] Took ${captured.length} screenshots`);
    expect(captured.length).toBeGreaterThan(0);
  },
);

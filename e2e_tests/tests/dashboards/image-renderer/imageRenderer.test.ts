import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

const panelTitle = 'Image renderer';
let uid = '';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ api }) => {
  if (uid) await api.grafanaApi.deleteDashboard(uid);

  uid = '';
});

pmmTest('PMM-T1946 - verify image renderer usage @image-renderer', async ({ api, dashboard, page }) => {
  const created = await api.grafanaApi.createDashboard(`Image renderer ${Date.now()}`, panelTitle, {
    options: { content: 'Rendered by the Grafana image renderer.', mode: 'markdown' },
    type: 'text',
  });

  uid = created.uid;
  await page.goto(created.url);
  await expect(dashboard.elements.panelName).toHaveText(panelTitle);
  await dashboard.renderImageForPanel(panelTitle);
  await expect(dashboard.elements.renderedImage).toHaveScreenshot('image-renderer-test.png', {
    maxDiffPixelRatio: 0.05,
  });
});

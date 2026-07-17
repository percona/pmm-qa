import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest('PMM-T1946 - verify image renderer usage @image-renderer', async ({ dashboard, page, urlHelper }) => {
  await page.goto(
    urlHelper.buildUrlWithParameters(dashboard.home.url, {
      from: 'now-5m',
    }),
  );
  await dashboard.verifyMetricsPresent(dashboard.home.metrics());
  await dashboard.renderImageForPanel('Failed advisors');
  await expect(dashboard.elements.renderedImage).toHaveScreenshot('image-renderer-test.png');
});

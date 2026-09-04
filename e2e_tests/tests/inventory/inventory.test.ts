import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

let calls: { method: string; requestTime: Date; url: string }[] = [];
const dataTests = [
  { apiUrl: 'v1/ha/nodes', name: 'NodesPage' },
  { apiUrl: 'v1/management/services', name: 'ServicesPage' },
];

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

for (const dataTest of dataTests) {
  pmmTest(
    `PMM-T2168 - Verify that ${dataTest.name} pages get data from BE every five seconds @inventory`,
    async ({ nodesPage, page, servicesPage }) => {
      page.on('request', (request) => {
        if (request.url().includes(dataTest.apiUrl)) {
          calls.push({
            method: request.method(),
            requestTime: new Date(),
            url: request.url(),
          });
        }
      });
      await page.goto(dataTest.name === 'NodesPage' ? nodesPage.url : servicesPage.url);
      await nodesPage.builders.showRowDetailsByIndex('0').click();
      await expect
        .poll(() => calls.length, {
          message: 'BE calls should be in the 5s interval!',
          timeout: Timeouts.TEN_SECONDS,
        })
        .toBeGreaterThanOrEqual(2);
      await expect(nodesPage.elements.detailsContent.first(), 'Page should not reload data!').toBeVisible();
      calls = [];

      page.on('request', (request) => {
        if (request.url().includes('v1/management/agents?')) {
          calls.push({
            method: request.method(),
            requestTime: new Date(),
            url: request.url(),
          });
        }
      });
      await nodesPage.elements.runningAgents.click();
      await nodesPage.builders.showRowDetailsByIndex('0').click();
      await expect
        .poll(() => calls.length, {
          message: 'BE calls should be in the 5s interval!',
          timeout: Timeouts.TEN_SECONDS,
        })
        .toBeGreaterThanOrEqual(2);
      await expect(nodesPage.elements.detailsContent.first(), 'Page should not reload data!').toBeVisible();
    },
  );
}

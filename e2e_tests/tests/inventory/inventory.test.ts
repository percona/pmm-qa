import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';
import data from '@fixtures/dataTest';

let calls: { method: string; requestTime: Date; url: string }[] = [];
const urls = [
  { apiUrl: 'v1/ha/nodes', name: 'NodesPage' },
  { apiUrl: 'v1/management/services', name: 'ServicesPage' },
];

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

data(urls).pmmTest(
  'PMM-T2168 - Verify that Nodes and Services pages get data from BE every five seconds @inventory',
  async (data, { nodesPage, page, servicesPage }) => {
    await page.goto(data.name === 'NodesPage' ? nodesPage.url : servicesPage.url);
    await nodesPage.builders.showRowDetailsByIndex('0').click();
    page.on('request', (request) => {
      if (request.url().includes(data.apiUrl)) {
        calls.push({
          method: request.method(),
          requestTime: new Date(),
          url: request.url(),
        });
      }
    });
    await expect.poll(() => calls.length, { timeout: Timeouts.TWELVE_SECONDS }).toEqual(2);
    await expect(nodesPage.elements.detailsContent.first()).toBeVisible();
    calls = [];

    await nodesPage.elements.runningAgents.click();
    await nodesPage.builders.showRowDetailsByIndex('0').click();
    page.on('request', (request) => {
      if (request.url().includes('v1/management/agents?')) {
        calls.push({
          method: request.method(),
          requestTime: new Date(),
          url: request.url(),
        });
      }
    });
    await expect.poll(() => calls.length, { timeout: Timeouts.TEN_SECONDS }).toEqual(2);
    await expect(nodesPage.elements.detailsContent.first()).toBeVisible();
  },
);

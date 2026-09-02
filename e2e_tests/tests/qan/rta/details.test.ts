import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ api, grafanaHelper, page, queryAnalytics }) => {
  await grafanaHelper.authorize();

  const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');

  await api.realTimeAnalyticsApi.startRealTimeAnalytics(service.service_id);
  await page.goto(queryAnalytics.rta.getUrlWithServices([service.service_id]));
});

pmmTest(
  'PMM-T2192 verify user is able to open query details @rta',
  async ({ mongoDbHelper, queryAnalytics }) => {
    const queryLabel = 'rta-details-view';

    await pmmTest.step('Simulate long running query', async () => {
      await mongoDbHelper.ensureCollectionHasDocuments('test', 'admin', 6);
      void mongoDbHelper.simulateLongRunningQuery({
        delayMs: Timeouts.THIRTY_SECONDS,
        queryLabel,
      });

      await expect(queryAnalytics.rta.builders.rowByQueryText(queryLabel)).toBeVisible({
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await pmmTest.step('Pause RTA and filter query list', async () => {
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
      await queryAnalytics.rta.filterQueriesByText(queryLabel);
    });

    const operationId = await queryAnalytics.rta.getOperationIdByRow('1');

    await pmmTest.step('Open query details and verify selected query data', async () => {
      await queryAnalytics.rta.openDetailsForRow('1');

      await expect(queryAnalytics.rta.elements.detailsOperationId).toHaveText(operationId);
      await expect(queryAnalytics.rta.builders.detailsPaneCodeByText(queryLabel)).toBeVisible();
      await expect(queryAnalytics.rta.buttons.detailsPreviousQuery).toBeVisible();
      await expect(queryAnalytics.rta.buttons.detailsNextQuery).toBeVisible();
    });

    await pmmTest.step('Close details pane', async () => {
      await queryAnalytics.rta.buttons.closeDetailsPane.click();
      await expect(queryAnalytics.rta.elements.detailsPane).toBeHidden();
    });
  },
);

pmmTest(
  'PMM-T2230 Verify RTA query details arrow navigation respects filters @rta',
  async ({ mongoDbHelper, page, queryAnalytics }) => {
    const filteredQueryLabel = 'rta-details-filtered';
    const queryLabels = [`${filteredQueryLabel}-1`, `${filteredQueryLabel}-2`, `${filteredQueryLabel}-3`];

    await pmmTest.step('Simulate filtered and unfiltered long running queries', async () => {
      await mongoDbHelper.ensureCollectionHasDocuments('test', 'admin', 6);

      for (const queryLabel of [...queryLabels, 'rta-details-not-filtered']) {
        void mongoDbHelper.simulateLongRunningQuery({
          delayMs: Timeouts.THIRTY_SECONDS,
          queryLabel,
        });

        // eslint-disable-next-line playwright/no-wait-for-timeout -- stagger query start time for predictable row order
        await page.waitForTimeout(500);
      }

      await expect(queryAnalytics.rta.builders.rowByQueryText(filteredQueryLabel)).toHaveCount(3, {
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await pmmTest.step('Pause RTA and filter queries by partial query text', async () => {
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
      await queryAnalytics.rta.filterQueriesByText(filteredQueryLabel);

      await expect(queryAnalytics.rta.builders.rowByQueryText(filteredQueryLabel)).toHaveCount(3);
      await expect(queryAnalytics.rta.builders.rowByQueryText('rta-details-not-filtered')).toHaveCount(0);
    });

    const firstQueryOperationId = await queryAnalytics.rta.getOperationIdByRow('1');
    const secondQueryOperationId = await queryAnalytics.rta.getOperationIdByRow('2');
    const thirdQueryOperationId = await queryAnalytics.rta.getOperationIdByRow('3');

    await pmmTest.step('Open details for the first filtered query', async () => {
      await queryAnalytics.rta.openDetailsForRow('1');

      await expect(queryAnalytics.rta.buttons.detailsPreviousQuery).toBeDisabled();
      await expect(queryAnalytics.rta.elements.detailsOperationId).toHaveText(firstQueryOperationId);
      await expect(queryAnalytics.rta.builders.detailsPaneCodeByText(filteredQueryLabel)).toBeVisible();
    });

    await pmmTest.step('Navigate forward only through filtered queries', async () => {
      await queryAnalytics.rta.buttons.detailsNextQuery.click();
      await expect(queryAnalytics.rta.elements.detailsOperationId).toHaveText(secondQueryOperationId);
      await expect(queryAnalytics.rta.builders.detailsPaneCodeByText(filteredQueryLabel)).toBeVisible();

      await queryAnalytics.rta.buttons.detailsNextQuery.click();
      await expect(queryAnalytics.rta.elements.detailsOperationId).toHaveText(thirdQueryOperationId);
      await expect(queryAnalytics.rta.builders.detailsPaneCodeByText(filteredQueryLabel)).toBeVisible();
      await expect(queryAnalytics.rta.buttons.detailsNextQuery).toBeDisabled();
    });

    await pmmTest.step('Navigate backward through filtered queries', async () => {
      await queryAnalytics.rta.buttons.detailsPreviousQuery.click();

      await expect(queryAnalytics.rta.elements.detailsOperationId).toHaveText(secondQueryOperationId);
      await expect(queryAnalytics.rta.builders.detailsPaneCodeByText(filteredQueryLabel)).toBeVisible();
    });
  },
);

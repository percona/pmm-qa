import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

let rs101ServiceId: string;
let rs102ServiceId: string;

pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
  await grafanaHelper.authorize();

  const service1 = await api.inventoryApi.getServiceDetailsByRegex('^rs101_');
  const service2 = await api.inventoryApi.getServiceDetailsByRegex('^rs102_');

  rs101ServiceId = service1.service_id;
  rs102ServiceId = service2.service_id;
});

pmmTest(
  'PMM-T2181 Verify redirect to selection page when no session exists @rta',
  async ({ api, page, queryAnalytics }) => {
    await api.realTimeAnalyticsApi.stopRealTimeAnalytics(rs101ServiceId);
    await api.realTimeAnalyticsApi.stopRealTimeAnalytics(rs102ServiceId);

    await pmmTest.step('Navigate directly to /rta/overview', async () => {
      await page.goto(queryAnalytics.rta.url);
    });

    await pmmTest.step('User is directed to selection page', async () => {
      await expect(page).toHaveURL(queryAnalytics.rtaSelectionUrl, {
        timeout: Timeouts.TEN_SECONDS,
      });
      await expect(queryAnalytics.buttons.startSessionButton).toBeVisible();
    });
  },
);

pmmTest('PMM-T2182 Verify overview loads when session exists @rta', async ({ api, page, queryAnalytics }) => {
  await api.realTimeAnalyticsApi.startRealTimeAnalytics(rs101ServiceId);

  await pmmTest.step('Navigate directly to overview', async () => {
    await page.goto(queryAnalytics.rta.url);
  });

  await pmmTest.step('Overview page loads', async () => {
    await expect(queryAnalytics.rta.elements.realTimeTable).toBeVisible();
  });

  await pmmTest.step('Cluster/Service input is visible and functional', async () => {
    await expect(queryAnalytics.rta.inputs.clusterService).toBeVisible();
    await queryAnalytics.rta.selectClusterService();
    await expect(queryAnalytics.rta.elements.realTimeTable).toBeVisible();
  });
});

pmmTest(
  'PMM-T2267 Verify RTA sessions page size is stored in the URL and restored after refresh @rta',
  async ({ mocks, page, queryAnalytics }) => {
    const { rta } = queryAnalytics;

    await pmmTest.step('Set up mocked sessions', async () => {
      await mocks.mockRealTimeAnalyticsSessions();
      await page.goto(queryAnalytics.rtaSessionsUrl);
    });

    const selectedSize = await pmmTest.step('Select a different page size', async () => {
      const initialSize = await rta.inputs.rowsLimit.textContent();
      const pageSize = initialSize === '10' ? '25' : '10';

      await rta.inputs.rowsLimit.click();
      await rta.builders.rowsPerPageOption(pageSize).click();

      return pageSize;
    });

    await pmmTest.step('Verify page size in the URL', async () => {
      await expect.poll(() => new URL(page.url()).searchParams.get('sessions.pageSize')).toBe(selectedSize);
    });

    await pmmTest.step('Reload and verify restored page size', async () => {
      await page.reload();
      await expect(rta.inputs.rowsLimit).toHaveText(selectedSize);
      await expect(rta.elements.sessionRows).toHaveCount(Number(selectedSize));
    });
  },
);

pmmTest(
  'PMM-T2522 - Verify a partly selected cluster shows as partially checked in the Real-Time Analytics service list @rta',
  async ({ api, page, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const { cluster } = await api.inventoryApi.getServiceDetailsByRegex('^rs101_');
    const { service_id: rs103ServiceId } = await api.inventoryApi.getServiceDetailsByRegex('^rs103_');

    await pmmTest.step('Stop the sessions and open the service selection', async () => {
      for (const serviceId of [rs101ServiceId, rs102ServiceId, rs103ServiceId]) {
        await api.realTimeAnalyticsApi.stopRealTimeAnalytics(serviceId);
      }

      await page.goto(queryAnalytics.rtaSelectionUrl);

      await expect(rta.inputs.clusterService).toBeVisible();
      await expect(queryAnalytics.buttons.startSessionButton).toBeVisible();
    });

    await pmmTest.step('Open the Cluster/Service list', async () => {
      await rta.inputs.clusterService.click();

      await expect(rta.builders.clusterCheckbox(cluster)).toBeVisible();
      await expect(rta.builders.serviceCheckbox(rs101ServiceId)).toBeVisible();
      await expect(rta.builders.serviceCheckbox(rs102ServiceId)).toBeVisible();
      await expect(rta.builders.serviceCheckbox(rs103ServiceId)).toBeVisible();
    });

    await pmmTest.step('Select one service and verify the cluster is partially checked', async () => {
      await rta.builders.serviceCheckbox(rs101ServiceId).click();

      await expect(rta.builders.serviceCheckbox(rs101ServiceId)).toBeChecked();
      await expect(rta.builders.clusterCheckbox(cluster)).toHaveAttribute('data-indeterminate', 'true');
      await expect(rta.builders.clusterCheckbox(cluster)).toHaveAttribute('aria-checked', 'mixed');
    });

    await pmmTest.step('Select the other services and verify the cluster is checked', async () => {
      await rta.builders.serviceCheckbox(rs102ServiceId).click();
      await rta.builders.serviceCheckbox(rs103ServiceId).click();

      await expect(rta.builders.clusterCheckbox(cluster)).toBeChecked();
      await expect(rta.builders.clusterCheckbox(cluster)).toHaveAttribute('data-indeterminate', 'false');
      await expect(rta.builders.clusterCheckbox(cluster)).not.toHaveAttribute('aria-checked');
    });

    await pmmTest.step('Clear one service and verify the cluster is partially checked again', async () => {
      await rta.builders.serviceCheckbox(rs103ServiceId).click();

      await expect(rta.builders.serviceCheckbox(rs103ServiceId)).not.toBeChecked();
      await expect(rta.builders.clusterCheckbox(cluster)).toHaveAttribute('data-indeterminate', 'true');
      await expect(rta.builders.clusterCheckbox(cluster)).toHaveAttribute('aria-checked', 'mixed');
    });

    await pmmTest.step('Clear the selection and verify the cluster is unchecked', async () => {
      await rta.builders.serviceCheckbox(rs101ServiceId).click();
      await rta.builders.serviceCheckbox(rs102ServiceId).click();

      await expect(rta.builders.clusterCheckbox(cluster)).not.toBeChecked();
      await expect(rta.builders.clusterCheckbox(cluster)).toHaveAttribute('data-indeterminate', 'false');
      await expect(rta.builders.clusterCheckbox(cluster)).not.toHaveAttribute('aria-checked');
    });
  },
);

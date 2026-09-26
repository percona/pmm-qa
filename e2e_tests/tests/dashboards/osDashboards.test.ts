import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2039 - Open the Node Summary Dashboard and verify Metrics are present and graphs are displayed @nightly  @dashboards @gssapi-nightly',
  async ({ dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.os.nodeSummary.url, {
        from: 'now-1h',
        nodeName: 'pmm-server',
        to: 'now',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.os.nodeSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.os.nodeSummary.noDataMetrics);
  },
);

pmmTest(
  'PMM-T2299 - Open the Nodes Compare Dashboard and verify Metrics are present and graphs are displayed @nightly  @dashboards @gssapi-nightly',
  async ({ dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.os.nodesCompare.url, {
        from: 'now-1h',
        refresh: '1m',
        to: 'now',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.os.nodesCompare.metrics, undefined, true);
    await dashboard.verifyAllPanelsHaveData(dashboard.os.nodesCompare.noDataMetrics);
  },
);

pmmTest(
  'PMM-T418 + PMM-T419 - Verify the pt-summary on Node Summary dashboard @nightly  @dashboards @gssapi-nightly',
  async ({ dashboard, page }) => {
    await page.goto(dashboard.os.nodeSummary.url);
    await dashboard.loadAllPanels();
    await expect(dashboard.elements.summaryPanelText).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
  },
);

pmmTest(
  'PMM-T1090 - Verify time zones and navigation between dashboards @nightly  @dashboards @gssapi-nightly',
  async ({ dashboard, leftNavigation, page, urlHelper }) => {
    const timeZone = 'Europe/London';

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.os.processesDetails.url, {
        from: 'now-45m',
        to: 'now',
      }),
    );
    await dashboard.waitForDashboardToLoad();

    await pmmTest.step(`Apply the ${timeZone} time zone`, async () => {
      await leftNavigation.elements.timePickerOpenButton.click();
      await leftNavigation.elements.changeTimeSettingsButton.click();
      await leftNavigation.inputs.timeZonePicker.fill(timeZone);
      await leftNavigation.builders.timeZoneOption(timeZone).click();
      await leftNavigation.elements.timePickerOpenButton.click();
    });

    await pmmTest.step('Navigate to the Nodes Overview dashboard through the left navigation', async () => {
      await leftNavigation.selectMenuItem('operatingsystem.overview');
      await dashboard.waitForDashboardToLoad();
    });

    await leftNavigation.elements.timePickerOpenButton.click();
    await expect(leftNavigation.builders.selectedTimeZone(timeZone)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

pmmTest(
  'PMM-T1695 - Verify that user is able to filter OS / Node Compare dashboard by Node Name @nightly  @dashboards @gssapi-nightly',
  async ({ api, dashboard, page, urlHelper }) => {
    const mergedNodes = (await api.inventoryApi.getAllNodes()).filter(
      (node) => node.node_type === 'generic' || node.node_type === 'container',
    );
    const node1 = mergedNodes[0].node_name;
    const node2 = mergedNodes[1].node_name;

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.os.nodesCompare.url, {
        from: 'now-5m',
        nodeName: node1,
        to: 'now',
      }),
    );
    await dashboard.waitForDashboardToLoad();
    await expect(dashboard.elements.panelHeaders).not.toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await expect(dashboard.elements.loadingBar).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });

    const initialNumOfPanels = await dashboard.elements.panelHeaders.filter({ visible: true }).count();

    await pmmTest.step(`Verify only ${node1} is compared`, async () => {
      await dashboard.elements.panelHeaders.first().click();
      await expect(dashboard.builders.panelByExactName(`${node2} - System Uptime`)).toBeHidden();
      await expect(dashboard.builders.panelByExactName(`${node1} - System Uptime`)).toBeVisible();
    });

    await dashboard.selectVariableValue('Node Name', node2);

    await expect
      .poll(() => dashboard.elements.panelHeaders.filter({ visible: true }).count(), {
        message: 'Number of panels should increase after adding another node for comparison',
        timeout: Timeouts.THIRTY_SECONDS,
      })
      .toBeGreaterThan(initialNumOfPanels);
    await expect(dashboard.builders.panelByExactName(`${node1} - System Uptime`)).toBeVisible();
    await expect(dashboard.builders.panelByExactName(`${node2} - System Uptime`)).toBeVisible();
  },
);

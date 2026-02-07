import { expect, test } from '@playwright/test';
import { GrafanaPanel } from '@interfaces/grafanaPanel';
import { GetService } from '@interfaces/inventory';
import { replaceWildcards } from '@helpers/metrics.helper';
import { Timeouts } from '@helpers/timeouts';
import BasePage from '@pages/base.page';
import { ValkeyDashboards, ValkeyDashboardsType } from '@valkey';
import { MysqlDashboards, MysqlDashboardsType } from '@pages/dashboards/mysql';
import Panels from '@components/dashboards/panels';

export default class Dashboards extends BasePage {
  readonly mysql: MysqlDashboardsType = MysqlDashboards;
  readonly valkey: ValkeyDashboardsType = ValkeyDashboards;
  builders = {
    panelByName: (panelName: string) =>
      this.grafanaIframe().locator(`//section[contains(@data-testid, "${panelName}")]`),
  };
  buttons = {};
  elements = {
    expandRow: this.grafanaIframe().getByLabel('Expand row'),
    gridItems: this.grafanaIframe().locator('.react-grid-item'),
    loadingBar: this.grafanaIframe().getByLabel('Panel loading bar'),
    loadingIndicator: this.grafanaIframe().getByLabel('data-testid Loading indicator', { exact: true }),
    loadingText: this.grafanaIframe().getByText('Loading plugin panel...', { exact: true }),
    noDataPanel: this.page.locator(
      '//*[(text()="No data") or (text()="NO DATA") or (text()="N/A") or (text()="-") or (text() = "No Data") or (@data-testid="data-testid Panel data error message")]',
    ),
    noDataPanelName: this.grafanaIframe().locator(
      '//*[(text()="No data") or (text()="NO DATA") or (text()="N/A") or (text()="-") or (text() = "No Data") or (@data-testid="data-testid Panel data error message")]//ancestor::section//h2',
    ),
    panelName: this.grafanaIframe().locator('//section[contains(@data-testid, "Panel header")]//h2'),
    refreshButton: this.grafanaIframe().getByLabel('Refresh', { exact: true }),
    summaryPanelText: this.grafanaIframe().locator(
      '//pre[@data-testid="pt-summary-fingerprint" and contains(text(), "Percona Toolkit MySQL Summary Report")]',
    ),
  };
  inputs = {};
  messages = {};

  readonly panels = () => Panels(this.page);

  loadAllPanels = async () => {
    const expectPanel = expect.configure({ timeout: Timeouts.ONE_MINUTE });

    // Wait for the dashboard to be visible before proceeding.
    await test.step('Wait for initial loading to finish', async () => {
      await expectPanel(this.elements.refreshButton).toBeVisible();
      await expectPanel(this.elements.loadingIndicator).toHaveCount(0);
      await expectPanel(this.elements.loadingText).toHaveCount(0);
    });

    // Expand rows if present and wait for content in each item.
    await test.step('Expand rows and load panel content', async () => {
      for (let i = 0; i < (await this.elements.gridItems.count()); i++) {
        const item = this.elements.gridItems.nth(i);

        await item.scrollIntoViewIfNeeded();

        const expandButton = item.getByLabel('Expand row');

        if (await expandButton.isVisible()) await expandButton.click();

        await expectPanel(item.locator(':scope > *')).not.toHaveCount(0);
      }
    });

    // Confirms that there are no remaining loading bars.
    await test.step('Wait for loading to finish', async () => {
      await expectPanel(this.elements.loadingBar).toHaveCount(0);
    });
  };

  verifyAllPanelsHaveData = async (noDataMetrics: string[], timeout: Timeouts = Timeouts.ONE_MINUTE) => {
    await this.loadAllPanels();

    let noDataPanels: string[] = [];
    let missingMetrics: string[] = [];
    let extraMetrics: string[] = [];

    for (let i = 0; i <= timeout; i += Timeouts.THIRTY_SECONDS) {
      noDataPanels = await this.elements.noDataPanelName.allTextContents();
      missingMetrics = Array.from(noDataPanels).filter((e) => !noDataMetrics.includes(e));
      extraMetrics = noDataMetrics.filter((e) => !noDataPanels.includes(e));

      if (missingMetrics.length == 0) break;

      //eslint-disable-next-line playwright/no-wait-for-timeout -- TODO: improve with better wait
      await this.page.waitForTimeout(Timeouts.THIRTY_SECONDS);
    }

    if (missingMetrics.length > 0) {
      for (const missingMetric of missingMetrics) {
        await this.builders.panelByName(missingMetric).screenshot({
          path: `./screenshots/missing-metric-${missingMetric.toLowerCase().replace(/[^a-z0-9-_]+/gi, '_')}.png`,
        });
      }
    }
    if (extraMetrics.length > 0) {
      for (const extraMetric of extraMetrics) {
        await this.builders.panelByName(extraMetric).screenshot({
          path: `./screenshots/extra-metric-${extraMetric.toLowerCase().replace(/[^a-z0-9-_]+/gi, '_')}.png`,
        });
      }
    }

    expect.soft(missingMetrics, `Metrics without data are: ${missingMetrics}`).toHaveLength(0);
    expect
      .soft(extraMetrics, `Metrics with data that are expected to be empty are: ${extraMetrics}`)
      .toHaveLength(0);
  };

  verifyMetricsPresent = async (expectedMetrics: GrafanaPanel[], serviceList?: GetService[]) => {
    expectedMetrics = serviceList ? replaceWildcards(expectedMetrics, serviceList) : expectedMetrics;

    const expectedMetricsNames = expectedMetrics.map((e) => e.name);

    await this.loadAllPanels();

    const availableMetrics = await this.elements.panelName.allTextContents();

    expect(availableMetrics.sort()).toEqual(expectedMetricsNames.sort());
  };

  verifyPanelValues = async (panels: GrafanaPanel[], serviceList?: GetService[]) => {
    await this.loadAllPanels();

    const panelList = serviceList ? replaceWildcards(panels, serviceList) : panels;

    for (const panel of panelList) {
      switch (panel.type) {
        case 'timeSeries':
          await this.panels().timeSeries.verifyPanelData(panel.name);
          break;
        case 'stat':
          await this.panels().stat.verifyPanelData(panel.name);
          break;
        case 'barGauge':
          await this.panels().barGauge.verifyPanelData(panel.name);
          break;
        case 'barTime':
          await this.panels().barTime.verifyPanelData(panel.name);
          break;
        case 'polyStat':
          await this.panels().polyStat.verifyPanelData(panel.name);
          break;
        case 'table':
          await this.panels().table.verifyPanelData(panel.name);
          break;
        case 'text':
          await this.panels().text.verifyPanelData(panel.name);
          break;
        case 'stateTime':
          await this.panels().stateTime.verifyPanelData(panel.name);
          break;
        case 'summary':
          await this.elements.summaryPanelText.waitFor({ state: 'visible', timeout: Timeouts.TEN_SECONDS });
          break;
        case 'unknown':
        case 'empty':
          break;
        default:
          throw new Error(`Unsupported panel: ${panel.name}`);
      }
    }
  };
}

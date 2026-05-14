import { expect, test } from '@playwright/test';
import { GrafanaPanel } from '@interfaces/grafanaPanel';
import { GetService } from '@interfaces/inventory';
import { replaceWildcards } from '@helpers/metrics.helper';
import { Timeouts } from '@helpers/timeouts';
import BasePage from '@pages/base.page';
import { ValkeyDashboards, ValkeyDashboardsType } from '@valkey';
import { MysqlDashboards, MysqlDashboardsType } from '@pages/dashboards/mysql';
import Panels from '@components/dashboards/panels';
import HomeDashboard from '@pages/dashboards/home';
import pmmTest from '@fixtures/pmmTest';

const panelNoDataMarkers = ['None', 'No data', 'NO DATA', 'No Data', 'N/A'];
const hasKnownNoDataMarker = (panelText: string) =>
  panelNoDataMarkers.some((marker) => panelText.includes(marker)) ||
  panelText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .includes('-');

export default class Dashboards extends BasePage {
  readonly home = new HomeDashboard(this.page);
  readonly mysql: MysqlDashboardsType = MysqlDashboards;
  readonly valkey: ValkeyDashboardsType = ValkeyDashboards;
  builders = {
    panelByExactName: (panelName: string) =>
      this.grafanaIframe().getByTestId(`data-testid Panel header ${panelName}`),
    panelByName: (panelName: string) =>
      this.grafanaIframe().locator(`//section[contains(@data-testid, "${panelName}")]`),
    panelHeaderByName: (panelName: string) =>
      this.builders.panelByExactName(panelName).getByTestId('header-container'),
    panelMenuIconByName: (panelName: string) => this.builders.panelHeaderByName(panelName).getByTitle('menu'),
    panelMenuItemByName: (menuItemName: string) =>
      this.grafanaIframe().getByTestId(`data-testid Panel menu item ${menuItemName}`),
  };
  buttons = {
    imageRendererDownloadImage: this.grafanaIframe().getByTestId(
      'data-testid share panel internally download image button',
    ),
    imageRendererGenerateImage: this.grafanaIframe().getByTestId(
      'data-testid share panel internally generate image button',
    ),
  };
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
    qanGrid: this.grafanaIframe().locator('.query-analytics-grid'),
    qanTableLoading: this.grafanaIframe().getByTestId('table-loading'),
    refreshButton: this.grafanaIframe().getByLabel('Refresh', { exact: true }),
    renderedImage: this.grafanaIframe().locator('[alt="panel-preview-img"]'),
    summaryPanelText: this.grafanaIframe().locator(
      '//pre[@data-testid="pt-summary-fingerprint" and contains(text(), "Percona Toolkit MySQL Summary Report")]',
    ),
  };
  inputs = {};
  messages = {};

  readonly panels = () => Panels(this.page);

  loadAllPanels = async () => {
    await this.waitForDashboardToLoad();

    const expectPanel = expect.configure({ timeout: Timeouts.ONE_MINUTE });

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

    if (this.page.url().includes('/pmm-qan/')) {
      await test.step('Wait for QAN stats to finish loading', async () => {
        await expectPanel(this.elements.qanGrid).toBeVisible();
        await expectPanel(this.elements.qanTableLoading).toHaveCount(0);
      });
    }
  };

  openPanelMenu = async (panelName: string) => {
    await pmmTest.step(`Open ${panelName} panel menu`, async () => {
      await this.builders.panelByName(panelName).scrollIntoViewIfNeeded();
      await this.builders.panelHeaderByName(panelName).hover();
      await this.builders.panelMenuIconByName(panelName).click();
    });
  };

  renderImageForPanel = async (panelName: string) => {
    await this.openPanelMenu(panelName);

    await pmmTest.step(`Hover over Share and click on generate image menu item`, async () => {
      await this.builders.panelMenuItemByName('Share').hover();
      await this.builders.panelMenuItemByName('Share link').click();
    });

    await pmmTest.step('Click on generate image button and verify that image is rendered', async () => {
      await this.buttons.imageRendererGenerateImage.click();
      await expect(this.buttons.imageRendererGenerateImage).toBeEnabled({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(this.elements.renderedImage).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
    });
  };

  verifyAllPanelsHaveData = async (noDataMetrics: string[], timeout: Timeouts = Timeouts.ONE_MINUTE) => {
    await this.loadAllPanels();

    let noDataPanels: string[] = [];
    let missingMetrics: string[] = [];

    for (let i = 0; i <= timeout; i += Timeouts.THIRTY_SECONDS) {
      noDataPanels = await this.elements.noDataPanelName.allTextContents();
      missingMetrics = Array.from(noDataPanels).filter((e) => !noDataMetrics.includes(e));

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

    expect.soft(missingMetrics, `Metrics without data are: ${missingMetrics}`).toHaveLength(0);
  };

  verifyMetricsPresent = async (expectedMetrics: GrafanaPanel[], serviceList?: GetService[]) => {
    expectedMetrics = serviceList ? replaceWildcards(expectedMetrics, serviceList) : expectedMetrics;

    const expectedMetricsNames = expectedMetrics.map((e) => e.name);

    await this.loadAllPanels();

    // eslint-disable-next-line playwright/prefer-web-first-assertions -- the order might be different
    const availableMetrics = await this.elements.panelName.allTextContents();

    expect.soft(availableMetrics).toEqual(expect.arrayContaining(expectedMetricsNames));
  };

  verifyNamedPanelsHaveData = async (panelNames: string[]) => {
    await this.loadAllPanels();

    for (const panelName of panelNames) {
      const panelText = await this.builders.panelByName(panelName).innerText();

      expect(hasKnownNoDataMarker(panelText), `Panel ${panelName} should contain real data`).toBeFalsy();
    }
  };

  verifyPanelsShowNoRealDataMarkers = async (panelNames: string[]) => {
    await this.loadAllPanels();

    for (const panelName of panelNames) {
      const panel = this.builders.panelByExactName(panelName);
      const panelText = await panel.innerText();

      expect(hasKnownNoDataMarker(panelText)).toBeTruthy();
    }
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

  waitForDashboardToLoad = async () => {
    const expectPanel = expect.configure({ timeout: Timeouts.ONE_MINUTE });

    await test.step('Wait for initial loading to finish', async () => {
      await expectPanel(this.elements.refreshButton).toBeVisible();
      await expectPanel(this.elements.loadingIndicator).toHaveCount(0);
      await expectPanel(this.elements.loadingText).toHaveCount(0);
    });
  };
}

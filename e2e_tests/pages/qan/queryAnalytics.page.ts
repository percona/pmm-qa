import { expect } from '@playwright/test';
import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';
import RealTimeAnalyticsPage from '@pages/qan/rta/realTimeAnalytics.page';
import StoredMetricsPage from '@pages/qan/storedMetrics/storedMetrics.page';

enum TabNames {
  realTime = 'Real-Time',
  storedMetrics = 'Stored metrics',
}

export default class QueryAnalyticsPage extends BasePage {
  url = 'pmm-ui/graph/d/pmm-qan';
  rta = new RealTimeAnalyticsPage(this.page);
  rtaSelectionUrl = 'pmm-ui/rta/selection';
  rtaSessionsUrl = 'pmm-ui/rta/sessions';
  rtaUrlPattern = /\/rta\//;
  storedMetrics = new StoredMetricsPage(this.page);
  storedMetricsUrlPattern = /\/pmm-qan\//;
  tabNames = TabNames;
  builders = {};
  buttons = {
    copyButton: this.grafanaIframe().getByTestId('copy-link-button'),
    realTimeTab: this.page.getByTestId('qan-header-tabs-real-time-tab'),
    startSessionButton: this.page.getByTestId('start-realtime-session'),
    storedMetricsTab: this.page.getByTestId('qan-header-tabs-historical-tab'),
  };
  elements = {
    documentationLink: this.page.getByRole('link', { name: 'Documentation' }),
    feedbackLink: this.page.getByRole('link', { name: 'Provide feedback' }),
    iframe: this.page.locator('//*[@id="grafana-iframe"]'),
    pageTitle: this.page.getByRole('heading', { name: 'Query Analytics' }),
    spinner: this.grafanaIframe().locator('//*[@data-testid="Spinner"]'),
  };
  inputs = {};
  messages = {
    copySuccess: this.grafanaIframe().getByText('Successfully copied Query Analytics link to clipboard'),
  };

  copyLink = async () => {
    await this.buttons.copyButton.click({ timeout: Timeouts.ONE_MINUTE });
    await this.messages.copySuccess.waitFor({ state: 'visible', timeout: Timeouts.TEN_SECONDS });

    return await this.page.evaluate(() => navigator.clipboard.readText());
  };

  noSpinner = async () => {
    await expect(this.elements.spinner.first()).toBeHidden({ timeout: Timeouts.THIRTY_SECONDS });
  };

  switchTab = async (tabName: TabNames) => {
    const tab = this.getTab(tabName);
    const urlPattern = tabName === this.tabNames.realTime ? this.rtaUrlPattern : this.storedMetricsUrlPattern;

    await tab.click();
    await expect(this.page).toHaveURL(urlPattern);
    await this.noSpinner();
  };

  verifyTabIsSelected = async (tabName: TabNames) => {
    const tab = this.getTab(tabName);

    await expect(tab).toHaveAttribute('aria-selected', 'true');
  };

  private getTab = (tabName: TabNames) =>
    tabName === this.tabNames.realTime ? this.buttons.realTimeTab : this.buttons.storedMetricsTab;
}

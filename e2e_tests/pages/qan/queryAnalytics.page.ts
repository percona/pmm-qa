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
  builders = {};
  buttons = {
    copyButton: this.page.getByTestId('qan-header-actions-copy-button'),
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
  messages = {};
  rta = new RealTimeAnalyticsPage(this.page);
  rtaUrlPattern = /\/rta\//;
  storedMetrics = new StoredMetricsPage(this.page);
  storedMetricsUrlPattern = /\/pmm-qan\//;
  tabNames = TabNames;

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

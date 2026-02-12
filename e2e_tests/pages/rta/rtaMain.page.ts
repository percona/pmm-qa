import { expect } from '@playwright/test';
import BasePage from '@pages/base.page';

export default class RtaMain extends BasePage {
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
    spinner: this.grafanaIframe().locator('//*[@data-testid="Spinner"]'),
  };
  inputs = {};
  messages = {};
  pageUrl = 'pmm-ui/graph/d/pmm-qan';

  noSpinner = async () => {
    await expect(this.elements.spinner.first()).toBeHidden({ timeout: 30_000 });
  };

  switchTab = async (tabName: 'Real-Time' | 'Stored metrics') => {
    const tab = tabName === 'Real-Time' ? this.buttons.realTimeTab : this.buttons.storedMetricsTab;
    const urlPattern = tabName === 'Real-Time' ? /\/rta\// : /\/pmm-qan\//;

    await tab.click();

    try {
      await this.page.waitForURL(urlPattern, { timeout: 10_000 });
    } catch {
      await tab.click();
      await this.page.waitForURL(urlPattern, { timeout: 10_000 });
    }

    await this.noSpinner();
  };

  verifyTabIsSelected = async (tabName: 'Real-Time' | 'Stored metrics') => {
    const tab = tabName === 'Real-Time' ? this.buttons.realTimeTab : this.buttons.storedMetricsTab;

    await expect(tab).toHaveAttribute('aria-selected', 'true');
  };
}

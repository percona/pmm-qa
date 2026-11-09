import { expect, Page, Locator } from '@playwright/test';

export default class SnackbarComponent {
  private elements = {
    grafanaIframe: () => this.page.frameLocator('//*[@id="grafana-iframe"]'),
    snackbarGrafana: (): Locator =>
      this.elements.grafanaIframe().locator('//div[contains(@class, "app-notifications-list")]'),
    successGrafanaMessage: (): Locator =>
      this.elements.snackbarGrafana().locator('//div[@data-testid="data-testid Alert success"]//span'),
  };

  constructor(protected page: Page) {}

  verifySuccessMessage = async (message: string) => {
    await expect(this.elements.successGrafanaMessage()).toHaveText(message);
  };
}

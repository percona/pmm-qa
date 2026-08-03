import { expect, Page } from '@playwright/test';

export default class SnackbarComponent {
  protected grafanaIframe = () => this.page.frameLocator('//*[@id="grafana-iframe"]');
  private snackbarGrafanaLocator = this.grafanaIframe().locator(
    '//div[contains(@class, "app-notifications-list")]',
  );
  private successGrafanaMessageLocator = this.snackbarGrafanaLocator.locator(
    '//div[@data-testid="data-testid Alert success"]//span',
  );

  constructor(protected page: Page) {}

  verifySuccessMessage = async (message: string) => {
    await expect(this.successGrafanaMessageLocator).toHaveText(message);
  };
}

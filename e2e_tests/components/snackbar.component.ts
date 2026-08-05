import { expect } from '@playwright/test';
import PanelComponent from '@components/dashboards/panels/panel.component';

export default class SnackbarComponent extends PanelComponent {
  private snackbarGrafanaLocator = this.grafanaIframe().locator(
    '//div[contains(@class, "app-notifications-list")]',
  );
  private successGrafanaMessageLocator = this.snackbarGrafanaLocator.locator(
    '//div[@data-testid="data-testid Alert success"]//span',
  );

  verifySuccessMessage = async (message: string) => {
    await expect(this.successGrafanaMessageLocator).toHaveText(message);
  };
}

import { Page } from '@playwright/test';
import SnackbarComponent from '@components/snackbar.component';

export default class BasePage {
  snackbar: SnackbarComponent;

  constructor(protected page: Page) {
    this.snackbar = new SnackbarComponent(this.page);
  }

  protected grafanaIframe = () => this.page.frameLocator('//*[@id="grafana-iframe"]');
}

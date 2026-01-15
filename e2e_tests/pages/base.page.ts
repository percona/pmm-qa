import { Page } from '@playwright/test';

export default class BasePage {
  constructor(protected page: Page) {}

  protected grafanaIframe = () => this.page.frameLocator('//*[@id="grafana-iframe"]');
}

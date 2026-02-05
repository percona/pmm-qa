import { Page, Locator } from '@playwright/test';

export default abstract class BasePage {
  abstract elements: Record<string, Locator>;
  abstract buttons: Record<string, Locator>;
  abstract inputs: Record<string, Locator>;
  abstract messages: Record<string, Locator>;
  abstract builders: Record<string, (...args: string[]) => Locator>;

  constructor(protected page: Page) {}

  protected grafanaIframe() {
    return this.page.frameLocator('//*[@id="grafana-iframe"]');
  }
}

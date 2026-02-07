import { Page, Locator } from '@playwright/test';

export default abstract class BasePage {
  abstract builders: Record<string, (...args: string[]) => Locator>;
  abstract buttons: Record<string, Locator>;
  abstract elements: Record<string, Locator>;
  abstract inputs: Record<string, Locator>;
  abstract messages: Record<string, Locator>;

  constructor(protected page: Page) {}

  protected grafanaIframe = () => this.page.frameLocator('//*[@id="grafana-iframe"]');
}

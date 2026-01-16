import { Page, Locator } from '@playwright/test';

export default abstract class BasePage {
  abstract builders: Record<string, (...args: string[]) => Locator>;
  abstract buttons: Record<string, Locator>;
  abstract elements: Record<string, Locator>;
  abstract inputs: Record<string, Locator>;
  abstract messages: Record<string, Locator>;

  constructor(protected page: Page) {}

  public grafanaIframe = () => this.page.frameLocator('//*[@id="grafana-iframe"]');

  newTab = async (): Promise<Page> => {
    const url = this.page.url();
    const newPage = await this.page.context().newPage();
    await newPage.goto(url);
    await newPage.locator('#grafana-iframe').waitFor({ state: 'visible' });
    this.page = newPage;
    return newPage;
  }

  switchPage = (page: Page) => {
    this.page = page;
  }
}

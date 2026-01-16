import { Page } from '@playwright/test';

export default class BasePage {
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

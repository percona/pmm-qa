import { Page } from '@playwright/test';
import { buildUrlWithParameters, BuildUrlParameters } from '@helpers/url.helper';

export default class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async open(dashboardUrl: string, params: BuildUrlParameters) {
    const url = buildUrlWithParameters(dashboardUrl, params);
    await this.page.goto(url);
  }
}

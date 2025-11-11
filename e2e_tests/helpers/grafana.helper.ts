import { Page } from '@playwright/test';

export default class GrafanaHelper {
  constructor(private page: Page) {}

  async authorize(username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin') {
    const authToken = GrafanaHelper.getToken(username, password);
    await this.page.setExtraHTTPHeaders({
      Authorization: `Basic ${authToken}`,
    });
    await this.page.reload();
    return this.page;
  }

  async unAuthorize() {
    await this.page.setExtraHTTPHeaders({});
    await this.page.reload();
  }

  static getToken(username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin') {
    return Buffer.from(`${username}:${password}`).toString('base64');
  }
}

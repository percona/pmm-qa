import { Page } from '@playwright/test';

export default class GrafanaHelper {
  constructor(private page: Page) {}

  authorize = async (username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin', baseUrl = '') => {
    const authToken = GrafanaHelper.getToken(username, password);

    await this.page.setExtraHTTPHeaders({ Authorization: `Basic ${authToken}` });
    await this.page.request.post(`${baseUrl}graph/login`, {
      data: { password, user: username },
    });
    await this.page.reload();

    return this.page;
  };

  static getToken = (username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin') =>
    Buffer.from(`${username}:${password}`).toString('base64');

  unAuthorize = async () => {
    await this.page.setExtraHTTPHeaders({});
    await this.page.reload();
  };
}

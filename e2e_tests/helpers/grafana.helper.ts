import { Page } from '@playwright/test';

export default class GrafanaHelper {
  constructor(private page: Page) {}

  authorize = async (username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin', baseUrl = '') => {
    const authToken = GrafanaHelper.getToken(username, password);

    await this.page.setExtraHTTPHeaders({ Authorization: `Basic ${authToken}` });
    await this.page.request.post(`${baseUrl}graph/login`, {
      data: { password, user: username },
    });
    await this.page.goto('');
    await this.page.reload();
    await this.page.waitForURL('pmm-ui/help');

    return this.page;
  };

  createUser = async (username: string, password: string) => {
    const authToken = GrafanaHelper.getToken();
    const response = await this.page.request.post('graph/api/admin/users', {
      data: {
        login: username,
        name: username,
        OrgId: 1,
        password: password,
      },
      headers: { Authorization: `Basic ${authToken}` },
    });

    return response;
  };

  static getAuthHeader = (username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin') => ({
    Authorization: `Basic ${this.getToken(username, password)}`,
  });

  static getToken = (username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin') =>
    Buffer.from(`${username}:${password}`).toString('base64');

  unAuthorize = async () => {
    await this.page.setExtraHTTPHeaders({});
    await this.page.reload();
  };
}

import { Page } from '@playwright/test';

export default class GrafanaHelper {
  constructor(private page: Page) { }

  async authorize(username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin', baseUrl = '') {
    const authToken = GrafanaHelper.getToken(username, password);
    await this.page.setExtraHTTPHeaders({ Authorization: `Basic ${authToken}` });
    await this.page.request.post(`${baseUrl}graph/login`, {
      data: { user: username, password },
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


  // creates non admin user
  async createUser(username: string, password: string) {
    const authToken = GrafanaHelper.getToken();
    const response = await this.page.request.post('graph/api/admin/users', {
      headers: { Authorization: `Basic ${authToken}` },
      data: {
        name: username,
        login: username,
        password: password,
        OrgId: 1
      }
    });
    return response;
  }
}

import { expect, Page } from '@playwright/test';
import { GrafanaUser, GrafanaUserSearchResponse } from '@interfaces/grafana';

export default class GrafanaHelper {
  constructor(private page: Page) {}

  authorize = async (username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin', baseUrl = '') => {
    const authToken = GrafanaHelper.getToken(username, password);

    await this.page.setExtraHTTPHeaders({ Authorization: `Basic ${authToken}` });
    await this.page.request.post(`${baseUrl}graph/login`, {
      data: { password, user: username },
    });

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

  findUserByUsername = async (username: string): Promise<GrafanaUser> => {
    const users = await this.listUsers();
    const user = users.users.find((user) => user.login === username);

    if (!user) {
      throw new Error(`User ${username} was not found`);
    }

    return user;
  };

  static getAuthHeader = (username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin') => ({
    Authorization: `Basic ${this.getToken(username, password)}`,
  });

  static getToken = (username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin') =>
    Buffer.from(`${username}:${password}`).toString('base64');

  listUsers = async () => {
    const response = await this.page.request.get('graph/api/users/search', {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    return (await response.json()) as GrafanaUserSearchResponse;
  };

  unAuthorize = async () => {
    await this.page.setExtraHTTPHeaders({});
    await this.page.goto('');
    await this.page.reload();
  };
}

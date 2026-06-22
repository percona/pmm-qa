import { expect, Page } from '@playwright/test';
import { GrafanaUser, GrafanaUserSearchResponse } from '@interfaces/grafana';

export default class GrafanaHelper {
  constructor(private page: Page) {}

  authorize = async (username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin', baseUrl = '') => {
    const authToken = GrafanaHelper.getToken(username, password);

    await this.page.setExtraHTTPHeaders({ Authorization: `Basic ${authToken}` });
    console.log(`Authorize url is: ${baseUrl}graph/login`);

    const resp = await this.page.request.post(`${baseUrl}graph/login`, {
      data: { password, user: username },
      ignoreHTTPSErrors: true,
    });

    console.log(resp.url());

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

    expect(response.status(), `Create user ${username}`).toEqual(200);

    return (await response.json()).id as number;
  };

  deleteUser = async (userId: number) => {
    const authToken = GrafanaHelper.getToken();
    const response = await this.page.request.delete(`graph/api/admin/users/${userId}`, {
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

  promoteToEditor = async (userId: number) => {
    const response = await this.page.request.patch(`graph/api/org/users/${userId}`, {
      data: { role: 'Editor' },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), 'Promote user to Editor').toEqual(200);
  };

  unAuthorize = async () => {
    await this.page.setExtraHTTPHeaders({});
    await this.page.context().clearCookies();
    await this.page.goto('', { waitUntil: 'domcontentloaded' }).catch(() => {
      /* PMM may redirect mid-load; we don't care about the cancel */
    });
  };
}

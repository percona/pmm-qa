import { expect, Page } from '@playwright/test';
import { GrafanaFolder, GrafanaUser, GrafanaUserSearchResponse } from '@interfaces/grafana';
import customDashboard from '@testdata/customDashboard.json';

export default class GrafanaHelper {
  constructor(private page: Page) {}

  authorize = async (username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin', baseUrl = '') => {
    const authToken = GrafanaHelper.getToken(username, password);

    await this.page.setExtraHTTPHeaders({ Authorization: `Basic ${authToken}` });
    await this.page.request.post(`${baseUrl}graph/login`, {
      data: { password, user: username },
      ignoreHTTPSErrors: true,
    });

    return this.page;
  };

  changePassword = async (oldPassword: string, newPassword: string) => {
    const response = await this.page.request.put('graph/api/user/password', {
      data: { confirmNew: newPassword, newPassword, oldPassword },
      headers: { Authorization: `Basic ${GrafanaHelper.getToken('admin', oldPassword)}` },
      ignoreHTTPSErrors: true,
    });

    expect(
      response.status(),
      `Failed to change user account password! Response message is ${response.statusText()}`,
    ).toEqual(200);
  };

  createCustomDashboard = async (name: string, folderId: number, tags: string[] = ['pmm-qa']) => {
    const response = await this.page.request.post('graph/api/dashboards/db/', {
      data: { dashboard: { ...customDashboard, tags, title: name }, folderId },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    return response;
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

  findOrCreateUser = async (username: string, password: string) => {
    const existingUser = (await this.listUsers()).users.find((user) => user.login === username);

    return existingUser
      ? { created: false, id: existingUser.id }
      : { created: true, id: await this.createUser(username, password) };
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

  getDashboard = async (uid: string) => {
    const response = await this.page.request.get(`graph/api/dashboards/uid/${uid}`, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(
      response.status(),
      `Get Dashboard api call for dashboard: ${uid} fails with error: ${response.statusText()}`,
    ).toEqual(200);

    return await response.json();
  };

  getFolderDetailsByName = async (folderName: string): Promise<GrafanaFolder> => {
    const response = await this.page.request.get('graph/api/folders', {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    const responseBody = ((await response.json()) as GrafanaFolder[]).find(
      (folder) => folder.title === folderName,
    );

    if (!responseBody) {
      throw new Error(`Failed to get a folder with name ${folderName}`);
    }

    return responseBody;
  };

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

  setHomeDashboard = async (uid: string) => {
    const authToken = GrafanaHelper.getToken();
    const response = await this.page.request.put('graph/api/user/preferences', {
      data: { homeDashboardUID: uid },
      headers: { Authorization: `Basic ${authToken}` },
    });

    expect(
      response.status(),
      `Failed to set home dashboard: "${uid}" dashboard. Response message is ${response.statusText()}`,
    ).toEqual(200);

    return (await response.json()).id as number;
  };

  signInAs = async (username: string, password: string): Promise<GrafanaUser> => {
    await this.unAuthorize();
    await this.authorize(username, password);

    const response = await this.page.request.get('graph/api/user', {
      headers: GrafanaHelper.getAuthHeader(username, password),
    });

    expect(response.status(), `Sign in as "${username}"`).toEqual(200);

    const user = (await response.json()) as GrafanaUser;

    expect(user.login, `The session must belong to "${username}"`).toEqual(username);

    return user;
  };

  starDashboard = async (uid: string) => {
    const authToken = GrafanaHelper.getToken();
    const response = await this.page.request.post(`graph/api/user/stars/dashboard/uid/${uid}`, {
      headers: { Authorization: `Basic ${authToken}` },
    });

    expect(
      response.status(),
      `Failed to star "${uid}" dashboard. Response message is ${response.statusText()}`,
    ).toEqual(200);

    return (await response.json()).id as number;
  };

  unAuthorize = async () => {
    await this.page.setExtraHTTPHeaders({});
    await this.page.context().clearCookies();
    // Not the PMM home page: it keeps running after goto resolves, cancels the next navigation and drops the next user's session.
    await this.page.goto('about:blank');
  };
}

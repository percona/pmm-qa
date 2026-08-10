import { expect, Page } from '@playwright/test';
import { GrafanaFolder, GrafanaUser, GrafanaUserSearchResponse } from '@interfaces/grafana';

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

  createCustomDashboard = async (
    name: string,
    folderId: number,
    customPanelName: string,
    tags: string[] = ['pmm-qa'],
  ) => {
    const body = {
      dashboard: {
        annotations: {
          list: [
            {
              builtIn: 1,
              datasource: '-- Grafana --',
              enable: true,
              hide: true,
              iconColor: 'rgba(0, 211, 255, 1)',
              name: 'Annotations & Alerts',
              type: 'dashboard',
            },
          ],
        },
        editable: true,
        panels: [
          {
            datasource: 'Metrics',
            fieldConfig: {
              defaults: {
                color: {
                  fixedColor: 'rgb(31, 120, 193)',
                  mode: 'fixed',
                },
                links: [],
                mappings: [
                  {
                    options: {
                      match: 'null',
                      result: {
                        index: 0,
                        text: 'N/A',
                      },
                    },
                    type: 'special',
                  },
                ],
                thresholds: {
                  mode: 'absolute',
                  steps: [
                    {
                      color: '#1F60C4',
                      value: null,
                    },
                    {
                      color: 'rgba(237, 129, 40, 0.89)',
                      value: 100,
                    },
                    {
                      color: '#d44a3a',
                    },
                  ],
                },
                unit: 'none',
              },
              overrides: [],
            },
            gridPos: {
              h: 5,
              w: 12,
              x: 0,
              y: 0,
            },
            id: 2,
            links: [],
            maxDataPoints: 100,
            options: {
              colorMode: 'value',
              graphMode: 'none',
              justifyMode: 'center',
              orientation: 'vertical',
              reduceOptions: {
                calcs: ['lastNotNull'],
                fields: '',
                values: false,
              },
              text: {
                titleSize: 14,
                valueSize: 24,
              },
              textMode: 'auto',
            },
            pluginVersion: '9.2.20',
            targets: [
              {
                datasource: 'Metrics',
                editorMode: 'code',
                expr: 'count by (service_type) (mysql_global_status_uptime)',
                format: 'time_series',
                hide: false,
                intervalFactor: 1,
                legendFormat: 'MySQL',
                range: true,
                refId: 'A',
              },
              {
                datasource: 'Metrics',
                editorMode: 'code',
                expr: 'count by (service_type) (mongodb_up)',
                hide: false,
                legendFormat: 'MongoDB',
                range: true,
                refId: 'B',
              },
              {
                datasource: 'Metrics',
                editorMode: 'code',
                expr: 'count by (service_type)  (group by (service_name, service_type) (pg_up))',
                hide: false,
                legendFormat: 'PostgreSQL',
                range: true,
                refId: 'C',
              },
              {
                datasource: 'Metrics',
                editorMode: 'code',
                expr: 'count by (service_type)  (group by (service_name, service_type) (proxysql_mysql_status_active_transactions))',
                hide: false,
                legendFormat: 'ProxySQL',
                range: true,
                refId: 'D',
              },
            ],
            title: customPanelName,
            type: 'stat',
          },
        ],
        schemaVersion: 26,
        style: 'dark',
        tags,
        time: {
          from: 'now-6h',
          to: 'now',
        },
        title: name,
        version: 0,
      },
      folderId,
    };
    const response = await this.page.request.post('graph/api/dashboards/db/', {
      data: body,
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    return response;
  };

  createFolder = async (folderName: string) => {
    const authToken = GrafanaHelper.getToken();
    const response = await this.page.request.post('graph/api/folders', {
      data: { title: folderName },
      headers: { Authorization: `Basic ${authToken}` },
    });

    expect(
      response.status(),
      `Failed to create "${folderName}" folder. Response message is ${response.statusText()}`,
    ).toEqual(200);

    return await response.json();
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

  getDashboard = async (uid: string) => {
    const response = await this.page.request.get(`graph/api/dashboards/uid/${uid}`, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

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
    await this.page.goto('', { waitUntil: 'domcontentloaded' }).catch(() => {
      /* PMM may redirect mid-load; we don't care about the cancel */
    });
  };
}

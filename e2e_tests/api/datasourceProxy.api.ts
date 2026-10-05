import { APIRequestContext, APIResponse, expect } from '@playwright/test';
import shell from 'shelljs';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';
import { GrafanaDatasource } from '@interfaces/grafana';

export interface ProxyUser {
  password: string;
  username: string;
}

export interface ProxyResponse {
  body: string;
  status: number;
}

export default class DatasourceProxyApi {
  constructor(private request: APIRequestContext) {}

  static countResults = (body: string): number => {
    let data: unknown;

    try {
      ({ data } = JSON.parse(body) as { data?: unknown });
    } catch {
      data = undefined;
    }

    if (Array.isArray(data)) return data.length;

    const { result } = (data ?? {}) as { result?: unknown[] };

    if (Array.isArray(result)) return result.length;

    return body.split('\n').filter((line) => line.trim()).length;
  };

  createDataSource = async (name: string, url: string): Promise<GrafanaDatasource> => {
    const response = await this.request.post(apiEndpoints.grafana.datasources, {
      data: { access: 'proxy', name, type: 'prometheus', url },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { datasource: GrafanaDatasource }).datasource;
  };

  get = async (
    path: string,
    user?: ProxyUser,
    headers: Record<string, string> = {},
  ): Promise<ProxyResponse> =>
    await DatasourceProxyApi.toProxyResponse(
      await this.request.get(path, { headers: { ...DatasourceProxyApi.authHeader(user), ...headers } }),
    );

  getRaw = (path: string, user?: ProxyUser): ProxyResponse => {
    const baseUrl = (process.env.PMM_UI_URL || 'http://localhost/').replace(/\/$/, '');
    const auth = user ? `-u '${user.username}:${user.password}'` : '';
    const { stdout } = shell.exec(`curl -sk --path-as-is ${auth} -w '\\n%{http_code}' '${baseUrl}${path}'`, {
      silent: true,
    });
    const lines = stdout.split('\n');

    return { body: lines.slice(0, -1).join('\n'), status: Number(lines.at(-1)) };
  };

  post = async (path: string, user?: ProxyUser, data?: unknown): Promise<ProxyResponse> =>
    await DatasourceProxyApi.toProxyResponse(
      await this.request.post(path, { data, headers: DatasourceProxyApi.authHeader(user) }),
    );

  private static authHeader = (user?: ProxyUser): Record<string, string> =>
    user ? GrafanaHelper.getAuthHeader(user.username, user.password) : {};

  private static toProxyResponse = async (response: APIResponse): Promise<ProxyResponse> => ({
    body: await response.text(),
    status: response.status(),
  });
}

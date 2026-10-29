import { APIRequestContext, APIResponse } from '@playwright/test';
import { ProxyUser } from '@api/datasourceProxy.api';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';
import {
  QanExampleBody,
  QanHistogramBody,
  QanLabelsBody,
  QanMetricsBody,
  QanPeriod,
  QanPlanBody,
  QanReportBody,
  QanResponse,
} from '@interfaces/qan';

const byQueryId = (queryId: string, period: QanPeriod) => ({
  ...period,
  filter_by: queryId,
  group_by: 'queryid',
});

export default class QanApi {
  constructor(private request: APIRequestContext) {}

  explainFingerprint = async (user: ProxyUser | undefined, serviceId: string, queryId: string) =>
    await this.post(apiEndpoints.qan.explainFingerprint, user, { query_id: queryId, serviceid: serviceId });

  getExample = async (user: ProxyUser | undefined, queryId: string, period: QanPeriod) =>
    await this.post<QanExampleBody>(apiEndpoints.qan.getExample, user, {
      ...byQueryId(queryId, period),
      limit: 5,
    });

  getHistogram = async (user: ProxyUser | undefined, queryId: string, period: QanPeriod) =>
    await this.post<QanHistogramBody>(apiEndpoints.qan.getHistogram, user, { ...period, queryid: queryId });

  getLabels = async (user: ProxyUser | undefined, queryId: string, period: QanPeriod) =>
    await this.post<QanLabelsBody>(apiEndpoints.qan.getLabels, user, byQueryId(queryId, period));

  getMetrics = async (user: ProxyUser | undefined, queryId: string, period: QanPeriod) =>
    await this.post<QanMetricsBody>(apiEndpoints.qan.getMetrics, user, byQueryId(queryId, period));

  getPlan = async (user: ProxyUser | undefined, queryId: string) =>
    await QanApi.toResponse<QanPlanBody>(
      await this.request.get(`${apiEndpoints.qan.query}/${queryId}/plan`, {
        headers: QanApi.authHeader(user),
      }),
    );

  /** Query ids of a service whose fingerprint contains the search text, read as Admin. */
  getQueryIds = async (serviceName: string, search: string, period: QanPeriod): Promise<string[]> => {
    const { body } = await this.post<QanReportBody>(apiEndpoints.qan.getReport, undefined, {
      ...period,
      columns: ['load', 'num_queries'],
      group_by: 'queryid',
      labels: [{ key: 'service_name', value: [serviceName] }],
      limit: 25,
      main_metric: 'load',
      offset: 0,
      order_by: '-load',
      search,
    });

    return (body.rows ?? []).flatMap(({ dimension }) => (dimension ? [dimension] : []));
  };

  static period = (hours: number): QanPeriod => {
    const to = new Date();

    return {
      period_start_from: new Date(to.getTime() - hours * 3_600_000).toISOString(),
      period_start_to: to.toISOString(),
    };
  };

  private static authHeader = (user?: ProxyUser): Record<string, string> =>
    user ? GrafanaHelper.getAuthHeader(user.username, user.password) : GrafanaHelper.getAuthHeader();

  private post = async <T = Record<string, unknown>>(
    path: string,
    user: ProxyUser | undefined,
    data: unknown,
  ): Promise<QanResponse<T>> =>
    await QanApi.toResponse<T>(await this.request.post(path, { data, headers: QanApi.authHeader(user) }));

  private static toResponse = async <T>(response: APIResponse): Promise<QanResponse<T>> => {
    const text = await response.text();
    let body = {} as T;

    try {
      body = JSON.parse(text) as T;
    } catch {
      // Keep the raw text for the assertion message.
    }

    return { body, status: response.status(), text };
  };
}

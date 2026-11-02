import { APIRequestContext } from '@playwright/test';
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
    await this.send('POST', apiEndpoints.qan.explainFingerprint, user, {
      query_id: queryId,
      serviceid: serviceId,
    });

  getExample = async (user: ProxyUser | undefined, queryId: string, period: QanPeriod) =>
    await this.send<QanExampleBody>('POST', apiEndpoints.qan.getExample, user, {
      ...byQueryId(queryId, period),
      limit: 5,
    });

  getHistogram = async (user: ProxyUser | undefined, queryId: string, period: QanPeriod) =>
    await this.send<QanHistogramBody>('POST', apiEndpoints.qan.getHistogram, user, {
      ...period,
      queryid: queryId,
    });

  getLabels = async (user: ProxyUser | undefined, queryId: string, period: QanPeriod) =>
    await this.send<QanLabelsBody>('POST', apiEndpoints.qan.getLabels, user, byQueryId(queryId, period));

  getMetrics = async (user: ProxyUser | undefined, queryId: string, period: QanPeriod) =>
    await this.send<QanMetricsBody>('POST', apiEndpoints.qan.getMetrics, user, byQueryId(queryId, period));

  getPlan = async (user: ProxyUser | undefined, queryId: string) =>
    await this.send<QanPlanBody>('GET', `${apiEndpoints.qan.query}/${queryId}/plan`, user);

  /** Query ids of a service whose fingerprint contains the search text, read as Admin. */
  getQueryIds = async (serviceName: string, search: string, period: QanPeriod): Promise<string[]> => {
    const { body } = await this.send<QanReportBody>('POST', apiEndpoints.qan.getReport, undefined, {
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

  private send = async <T = Record<string, unknown>>(
    method: 'GET' | 'POST',
    path: string,
    user: ProxyUser | undefined,
    data?: unknown,
  ): Promise<QanResponse<T>> => {
    const headers = user
      ? GrafanaHelper.getAuthHeader(user.username, user.password)
      : GrafanaHelper.getAuthHeader();
    const response = await this.request.fetch(path, { data, headers, method });
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

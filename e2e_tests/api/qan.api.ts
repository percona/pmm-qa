import { APIRequestContext } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';

export interface QanLabel {
  key: string;
  value: string[];
}

export interface QanMetricValue {
  avg: number;
  cnt: number;
  max: number;
  min: number;
  p99: number;
  sum: number;
}

export interface QanMetricsResponse {
  data: {
    metrics?: Record<string, QanMetricValue>;
  };
  status: number;
}

/**
 * Client for the QAN metrics endpoint used to cross-check ClickHouse data
 * against pg_stat_monitor output.
 */
export default class QanApi {
  constructor(private request: APIRequestContext) {}

  getMetricByFilter = async (
    filterBy: string,
    groupBy: string,
    labels: QanLabel[],
    fromTime: string,
    toTime: string,
  ): Promise<QanMetricsResponse> => {
    const response = await this.request.post(apiEndpoints.qan.getMetrics, {
      data: {
        filter_by: filterBy,
        group_by: groupBy,
        labels,
        period_start_from: fromTime,
        period_start_to: toTime,
        totals: false,
      },
      headers: GrafanaHelper.getAuthHeader(),
    });

    return { data: (await response.json()) as QanMetricsResponse['data'], status: response.status() };
  };
}

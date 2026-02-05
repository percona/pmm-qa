import { APIRequestContext, expect, Page } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import GrafanaHelper from '@helpers/grafana.helper';

export default class GrafanaApi {
  constructor(
    private readonly page: Page,
    private request: APIRequestContext,
  ) {}

  async waitForMetric(metricName: string, timeout: Timeouts = Timeouts.ONE_MINUTE) {
    let iterator = 0;

    while (true) {
      if (iterator > timeout) throw new Error(`Timed out waiting for metric data for metric: ${metricName}`);

      const metric = await this.getMetric(metricName);

      if (metric.results.A.frames[0].data.values.length !== 0) return metric.data;

      // eslint-disable-next-line playwright/no-wait-for-timeout -- TODO: Rework with proper poll or waitFor
      await this.page.waitForTimeout(Timeouts.ONE_SECOND);
      iterator += Timeouts.ONE_SECOND;
    }
  }

  async getMetric(metricName: string) {
    const headers = { Authorization: `Basic ${GrafanaHelper.getToken()}` };
    const datasource = await this.getDataSourceByName();
    const requestBody = {
      from: 'now-1m',
      to: 'now',
      queries: [
        {
          datasource: {
            type: 'prometheus',
            uid: datasource.uid,
          },
          datasourceId: datasource.uid,
          expr: metricName,
          intervalMs: 1_000,
          maxDataPoints: 100,
        },
      ],
    };
    const metric = await this.request.post('graph/api/ds/query', { data: requestBody, headers });

    expect(
      metric.status(),
      `Get datasource by name API call returned status code: ${metric.status()} with error message: ${metric.statusText()}`,
    ).toEqual(200);

    return await metric.json();
  }

  async getDataSourceByName(name = 'Metrics') {
    const headers = { Authorization: `Basic ${GrafanaHelper.getToken()}` };
    const dataSources = await this.request.get('graph/api/datasources', { headers });

    expect(
      dataSources.status(),
      `Get datasource by name API call returned status code: ${dataSources.status()} with error message: ${dataSources.statusText()}`,
    ).toEqual(200);

    return (await dataSources.json()).find((d: { name: string }) => d.name === name);
  }
}

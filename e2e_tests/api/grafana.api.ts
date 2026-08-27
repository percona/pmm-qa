import { APIRequestContext, expect, Page } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';

export default class GrafanaApi {
  constructor(
    private readonly page: Page,
    private request: APIRequestContext,
  ) {}

  createFolder = async (title: string): Promise<string> => {
    const response = await this.request.post(apiEndpoints.grafana.folders, {
      data: { title },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);

    return (await response.json()).uid as string;
  };

  deleteFolder = async (uid: string): Promise<void> => {
    await expect(async () => {
      const response = await this.request.delete(`${apiEndpoints.grafana.folders}/${uid}`, {
        headers: GrafanaHelper.getAuthHeader(),
        params: { forceDeleteRules: true },
      });

      expect(response.status()).toEqual(200);
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
  };

  getDataSourceByName = async (name = 'Metrics') => {
    const headers = { Authorization: `Basic ${GrafanaHelper.getToken()}` };
    const dataSources = await this.request.get('graph/api/datasources', { headers });

    expect(
      dataSources.status(),
      `Get datasource by name API call returned status code: ${dataSources.status()} with error message: ${dataSources.statusText()}`,
    ).toEqual(200);

    return (await dataSources.json()).find((d: { name: string }) => d.name === name);
  };

  getMetric = async (metricName: string) => {
    const headers = { Authorization: `Basic ${GrafanaHelper.getToken()}` };
    const datasource = await this.getDataSourceByName();
    const requestBody = {
      from: 'now-1m',
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
      to: 'now',
    };
    const metric = await this.request.post('graph/api/ds/query', { data: requestBody, headers });

    expect(
      metric.status(),
      `Get datasource by name API call returned status code: ${metric.status()} with error message: ${metric.statusText()}`,
    ).toEqual(200);

    return await metric.json();
  };

  waitForMetric = async (metricName: string, timeout: Timeouts = Timeouts.ONE_MINUTE) => {
    let iterator = 0;

    while (true) {
      if (iterator > timeout) throw new Error(`Timed out waiting for metric data for metric: ${metricName}`);

      const metric = await this.getMetric(metricName);

      if (metric.results.A.frames[0].data.values.length !== 0) return metric.data;

      // eslint-disable-next-line playwright/no-wait-for-timeout -- TODO: Rework with proper poll or waitFor
      await this.page.waitForTimeout(Timeouts.ONE_SECOND);
      iterator += Timeouts.ONE_SECOND;
    }
  };
}

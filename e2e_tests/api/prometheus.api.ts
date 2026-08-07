import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import { PrometheusQueryResponse, PrometheusSample } from '@interfaces/prometheus';
import apiEndpoints from '@helpers/apiEndpoints';

/**
 * Client for the VictoriaMetrics API that PMM Server proxies under
 * `/prometheus`. Only the instant query is exposed - tests read metrics the
 * same way the Explore page does, without driving the Explore UI.
 */
export default class PrometheusApi {
  constructor(private request: APIRequestContext) {}

  /**
   * Run an instant PromQL query and return the raw samples.
   *
   * @param   query   PromQL expression, e.g. `sum(pmm_ha_leader_status)`
   */
  instantQuery = async (query: string): Promise<PrometheusSample[]> => {
    const response = await this.request.get(apiEndpoints.prometheus.query, {
      headers: GrafanaHelper.getAuthHeader(),
      params: { query },
    });

    expect(
      response.status(),
      `Instant query "${query}" returned status code: ${response.status()} (${response.statusText()})`,
    ).toEqual(200);

    const body = (await response.json()) as PrometheusQueryResponse;

    expect(body.status, `Instant query "${query}" was not successful: ${JSON.stringify(body)}`).toEqual(
      'success',
    );

    return body.data.result;
  };

  /**
   * Run an instant PromQL query that is expected to produce a single scalar and
   * return its value, or `undefined` when the query matched no series.
   */
  instantQueryValue = async (query: string): Promise<number | undefined> => {
    const samples = await this.instantQuery(query);

    return samples.length > 0 ? Number(samples[0].value[1]) : undefined;
  };
}

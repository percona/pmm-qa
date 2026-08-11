import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import { GrafanaDatasource } from '@interfaces/grafana';
import { PrometheusQueryResponse, PrometheusSample } from '@interfaces/prometheus';
import apiEndpoints from '@helpers/apiEndpoints';

/**
 * Reads metrics through the Grafana datasource proxy - the route Explore takes -
 * so tests can assert on PromQL without driving Explore.
 *
 * PMM's own `/prometheus` route is deliberately avoided: it is served by vmproxy,
 * which on HA fronts a VictoriaMetrics cluster and rejects the single-node query
 * path with a 500.
 */
export default class PrometheusApi {
  private datasourceUid?: string;

  constructor(private request: APIRequestContext) {}

  /**
   * UID of the datasource Grafana queries. Looked up rather than hardcoded - it
   * is generated per deployment - then cached for this client's lifetime.
   */
  getDatasourceUid = async (): Promise<string> => {
    if (this.datasourceUid) return this.datasourceUid;

    const response = await this.request.get(apiEndpoints.prometheus.datasources, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(
      response.status(),
      `List datasources returned status code: ${response.status()} (${response.statusText()})`,
    ).toEqual(200);

    const datasources = (await response.json()) as GrafanaDatasource[];
    const metrics = datasources.find((datasource) => datasource.type === 'prometheus');

    if (!metrics) {
      throw new Error(
        'No Prometheus datasource is configured in Grafana. Available datasources: ' +
          datasources.map((datasource) => `${datasource.name} (${datasource.type})`).join(', '),
      );
    }

    this.datasourceUid = metrics.uid;

    return metrics.uid;
  };

  /** @param query PromQL expression, e.g. `sum(pmm_ha_leader_status)` */
  instantQuery = async (query: string): Promise<PrometheusSample[]> => {
    const datasourceUid = await this.getDatasourceUid();
    const response = await this.request.get(
      `${apiEndpoints.prometheus.datasourceProxy}/${datasourceUid}/api/v1/query`,
      {
        headers: GrafanaHelper.getAuthHeader(),
        params: { query },
      },
    );

    expect(
      response.status(),
      `Instant query "${query}" returned status code: ${response.status()} (${response.statusText()})` +
        `\nResponse body: ${await response.text()}`,
    ).toEqual(200);

    const body = (await response.json()) as PrometheusQueryResponse;

    expect(body.status, `Instant query "${query}" was not successful: ${JSON.stringify(body)}`).toEqual(
      'success',
    );

    return body.data.result;
  };

  /** Value of a single-series query, or `undefined` when nothing matched. */
  instantQueryValue = async (query: string): Promise<number | undefined> => {
    const samples = await this.instantQuery(query);

    return samples.length > 0 ? Number(samples[0].value[1]) : undefined;
  };
}

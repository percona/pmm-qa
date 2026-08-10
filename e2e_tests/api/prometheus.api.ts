import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import { GrafanaDatasource } from '@interfaces/grafana';
import { PrometheusQueryResponse, PrometheusSample } from '@interfaces/prometheus';
import apiEndpoints from '@helpers/apiEndpoints';

/**
 * Reads metrics through the Grafana datasource proxy - the same route the
 * Explore page takes - so tests can assert on PromQL without driving Explore.
 *
 * PMM's own `/prometheus` route is deliberately not used: it is served by
 * vmproxy, which on an HA deployment fronts an external VictoriaMetrics
 * cluster and rejects the plain single-node query path.
 */
export default class PrometheusApi {
  private datasourceUid?: string;

  constructor(private request: APIRequestContext) {}

  /**
   * UID of the Prometheus-compatible datasource Grafana queries. Resolved from
   * the datasource list because the UID is generated per deployment, and cached
   * for the lifetime of this client.
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

  /**
   * Run an instant PromQL query and return the raw samples.
   *
   * @param   query   PromQL expression, e.g. `sum(pmm_ha_leader_status)`
   */
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

  /**
   * Run an instant PromQL query that is expected to produce a single scalar and
   * return its value, or `undefined` when the query matched no series.
   */
  instantQueryValue = async (query: string): Promise<number | undefined> => {
    const samples = await this.instantQuery(query);

    return samples.length > 0 ? Number(samples[0].value[1]) : undefined;
  };
}

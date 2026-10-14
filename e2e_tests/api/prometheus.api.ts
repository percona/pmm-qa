import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import { GrafanaDatasource } from '@interfaces/grafana';
import { PrometheusQueryResponse, PrometheusSample } from '@interfaces/prometheus';
import { Timeouts } from '@helpers/timeouts';
import apiEndpoints from '@helpers/apiEndpoints';

/**
 * Metrics through the Grafana datasource proxy, the route Explore takes.
 *
 * PMM's own `/prometheus` is deliberately avoided: it is served by vmproxy,
 * which on HA fronts a VictoriaMetrics cluster and 500s on the single-node
 * query path.
 */
export default class PrometheusApi {
  private datasourceUid?: string;

  constructor(private request: APIRequestContext) {}

  /** Looked up rather than hardcoded - the UID is generated per deployment. */
  getDatasourceUid = async (): Promise<string> => {
    if (this.datasourceUid) return this.datasourceUid;

    const response = await this.request.get(apiEndpoints.grafana.datasources, {
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

  /** `undefined` when nothing matched. */
  instantQueryValue = async (query: string): Promise<number | undefined> => {
    const samples = await this.instantQuery(query);

    return samples.length > 0 ? Number(samples[0].value[1]) : undefined;
  };

  /**
   * First sample of `query` from PMM's own `/prometheus` route on `baseUrl`, or 0 when the server is down
   * or nothing matched. For polling a single-node server that may be offline; on HA use `instantQueryValue`.
   */
  queryValueOrZero = async (
    baseUrl: string,
    query: string,
    {
      headers = GrafanaHelper.getAuthHeader(),
      time,
    }: { headers?: Record<string, string>; time?: number } = {},
  ): Promise<number> => {
    const response = await this.request
      .get(new URL(apiEndpoints.prometheus.query, baseUrl).href, {
        headers,
        params: time ? { query, time: String(time) } : { query },
      })
      .catch(() => undefined);

    return response?.ok()
      ? Number((await response.json().catch(() => ({}))).data?.result?.[0]?.value[1] ?? 0)
      : 0;
  };

  /** The server clock in epoch seconds, on the same scale as `timestamp(...)`. */
  waitForServerTime = async (timeout: Timeouts = Timeouts.TWO_MINUTES): Promise<number> => {
    let serverTime = 0;

    await expect(async () => {
      serverTime = (await this.instantQueryValue('time()')) ?? 0;

      expect(serverTime, 'The metrics API must answer time()').toBeGreaterThan(0);
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout });

    return serverTime;
  };
}

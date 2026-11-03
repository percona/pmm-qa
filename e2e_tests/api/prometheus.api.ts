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
  //.metric.service_name

  getActiveClusterSyncInstance = async (): Promise<PrometheusSample> =>
    (await this.instantQuery(`percona_clustersync_mongodb_ha_active == 1`))[0];

  getActiveClusterSyncInstances = async (): Promise<PrometheusSample[]> =>
    await this.instantQuery(`percona_clustersync_mongodb_ha_active == 1`);

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

  /**
   * @param query   PromQL expression, e.g. `sum(pmm_ha_leader_status)`
   * @param params  extra query parameters, e.g. VictoriaMetrics' `nocache: '1'`
   */
  instantQuery = async (query: string, params: Record<string, string> = {}): Promise<PrometheusSample[]> => {
    const datasourceUid = await this.getDatasourceUid();
    const response = await this.request.get(
      `${apiEndpoints.prometheus.datasourceProxy}/${datasourceUid}/api/v1/query`,
      {
        headers: GrafanaHelper.getAuthHeader(),
        params: { ...params, query },
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

  /** How full a PVC is according to kubelet, as a percentage. */
  volumePercentFull = async (namespace: string, claim: string): Promise<number | undefined> => {
    const selector = `job="kubelet",namespace="${namespace}",persistentvolumeclaim="${claim}"`;

    return this.instantQueryValue(
      `max(100 * (1 - kubelet_volume_stats_available_bytes{${selector}} / kubelet_volume_stats_capacity_bytes{${selector}}))`,
    );
  };

  waitForQueryValue = async (
    baseUrl: string,
    query: string,
    {
      message,
      timeout = Timeouts.TWO_MINUTES,
      ...options
    }: { headers?: Record<string, string>; message: string; time?: number; timeout?: Timeouts },
  ) => {
    await expect
      .poll(() => this.queryValueOrZero(baseUrl, query, options), { message, timeout })
      .toBeGreaterThan(0);
  };

  /**
   * Panels pinned to a 5m step show "No data" for a series until it has a sample
   * before the last 5-minute boundary, e.g. MongoDB Router Summary Uptime.
   */
  waitForSampleBeforeFiveMinuteBoundary = async (selector: string) => {
    await expect
      .poll(
        () =>
          this.instantQueryValue(
            `min(count_over_time(${selector}[1m] offset ${Math.floor(Date.now() / 1_000) % 300}s))`,
          ),
        {
          intervals: [Timeouts.THIRTY_SECONDS],
          message: `${selector} has no sample before the last 5-minute boundary`,
          timeout: Timeouts.TEN_MINUTES,
        },
      )
      .toBeGreaterThan(0);
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

import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import PrometheusApi from '@api/prometheus.api';
import { HaNode, HaNodeRole, HaNodesResponse, HaStatusResponse } from '@interfaces/ha';
import { Timeouts } from '@helpers/timeouts';
import apiEndpoints from '@helpers/apiEndpoints';

/**
 * PMM HA cluster state, from both the HA REST API (what the sidebar badge
 * renders) and the metrics pmm-managed exports.
 *
 * `pmm_ha_leader_status` is 1 on the Raft leader and 0 on followers, and its
 * `node_id` matches the HA API's node name, so the two are directly comparable.
 */
export default class HaApi {
  static readonly leaderStatusMetric = 'pmm_ha_leader_status';
  private prometheusApi: PrometheusApi;

  constructor(private request: APIRequestContext) {
    this.prometheusApi = new PrometheusApi(request);
  }

  /**
   * The node where `pmm_ha_leader_status == 1`, or `undefined` when none or
   * several claim it - after a failover the old leader's last sample lingers
   * for a scrape.
   */
  getLeaderFromMetrics = async (): Promise<string | undefined> => {
    const samples = await this.prometheusApi.instantQuery(`${HaApi.leaderStatusMetric} == 1`);

    return samples.length === 1 ? samples[0].metric.node_id : undefined;
  };

  getLeaderNode = async (): Promise<HaNode | undefined> =>
    (await this.getNodes()).find((node) => node.role === HaNodeRole.leader);

  /**
   * `sum(pmm_ha_leader_status)` - the split-brain / missing-leader check from
   * the HA alerting rules. Anything other than 1 is a broken cluster.
   */
  getLeaderStatusSum = async (): Promise<number | undefined> =>
    await this.prometheusApi.instantQueryValue(`sum(${HaApi.leaderStatusMetric})`);

  /** Every node the HA API reports, sorted. */
  getNodeNames = async (): Promise<string[]> => (await this.getNodes()).map((node) => node.node_name).sort();

  getNodes = async (): Promise<HaNode[]> => {
    const response = await this.request.get(apiEndpoints.ha.nodes, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(
      response.status(),
      `Get HA nodes API call returned status code: ${response.status()} (${response.statusText()})`,
    ).toEqual(200);

    return ((await response.json()) as HaNodesResponse).nodes ?? [];
  };

  /**
   * Every node exporting `pmm_ha_leader_status`, sorted to compare with
   * {@link getNodeNames} - the metric should cover the cluster, not just the leader.
   */
  getNodesFromMetrics = async (): Promise<string[]> => {
    const samples = await this.prometheusApi.instantQuery(HaApi.leaderStatusMetric);

    return samples
      .map((sample) => sample.metric.node_id)
      .filter(Boolean)
      .sort();
  };

  getStatus = async (): Promise<string> => {
    const response = await this.request.get(apiEndpoints.ha.status, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(
      response.status(),
      `Get HA status API call returned status code: ${response.status()} (${response.statusText()})`,
    ).toEqual(200);

    return ((await response.json()) as HaStatusResponse).status;
  };

  /**
   * Poll until exactly one node reports leadership, and until it differs from
   * `previousLeader` when one is given.
   *
   * Metrics trail a failover by a scrape interval, and HAProxy points at the
   * active leader, so killing that pod makes the API return 5xx until it
   * re-points - both are polled through rather than failed on.
   *
   * @param   previousLeader  leader to wait away from; omit to accept any leader
   */
  waitForLeaderInMetrics = async (
    previousLeader?: string,
    timeout: Timeouts = Timeouts.FIVE_MINUTES,
  ): Promise<string> => {
    const deadline = Date.now() + timeout;
    let lastSeen: string | undefined;
    let lastError: unknown;

    while (Date.now() < deadline) {
      try {
        lastSeen = await this.getLeaderFromMetrics();

        if (lastSeen && lastSeen !== previousLeader) return lastSeen;
      } catch (error) {
        lastError = error;
      }

      await new Promise((resolve) => setTimeout(resolve, Timeouts.FIVE_SECONDS));
    }

    throw new Error(
      `No new leader was reported by "${HaApi.leaderStatusMetric}" within ${timeout}ms` +
        `${previousLeader ? ` (previous leader: ${previousLeader})` : ''}. ` +
        `Last observed leader: ${lastSeen ?? 'none'}. ` +
        `Last request error: ${lastError instanceof Error ? lastError.message : 'none'}`,
    );
  };

  /**
   * Poll `sum(pmm_ha_leader_status)` until it equals `expected`, tolerating the
   * same mid-failover 5xx as {@link waitForLeaderInMetrics}. Returns the last
   * value seen so the caller keeps the assertion and gets a normal diff.
   */
  waitForLeaderStatusSum = async (
    expected: number,
    timeout: Timeouts = Timeouts.TWO_MINUTES,
  ): Promise<number | undefined> => {
    const deadline = Date.now() + timeout;
    let lastSeen: number | undefined;

    while (Date.now() < deadline) {
      try {
        lastSeen = await this.getLeaderStatusSum();

        if (lastSeen === expected) return lastSeen;
      } catch {
        // Cluster is mid-failover; keep polling until the deadline.
      }

      await new Promise((resolve) => setTimeout(resolve, Timeouts.FIVE_SECONDS));
    }

    return lastSeen;
  };
}

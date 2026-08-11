import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import PrometheusApi from '@api/prometheus.api';
import { HaNode, HaNodeRole, HaNodesResponse, HaStatusResponse } from '@interfaces/ha';
import { Timeouts } from '@helpers/timeouts';
import apiEndpoints from '@helpers/apiEndpoints';

/**
 * PMM HA state from the HA REST API and from `pmm_ha_leader_status`, which is 1
 * on the leader and 0 on followers. Its `node_id` matches the API's node name,
 * so the two sources are directly comparable.
 */
export default class HaApi {
  static readonly leaderStatusMetric = 'pmm_ha_leader_status';
  private prometheusApi: PrometheusApi;

  constructor(private request: APIRequestContext) {
    this.prometheusApi = new PrometheusApi(request);
  }

  /** `undefined` when none or several claim it, as happens for a scrape after a failover. */
  getLeaderFromMetrics = async (): Promise<string | undefined> => {
    const samples = await this.prometheusApi.instantQuery(`${HaApi.leaderStatusMetric} == 1`);

    return samples.length === 1 ? samples[0].metric.node_id : undefined;
  };

  getLeaderNode = async (): Promise<HaNode | undefined> =>
    (await this.getNodes()).find((node) => node.role === HaNodeRole.leader);

  /** Anything other than 1 is a broken cluster: 0 is no leader, >1 is split-brain. */
  getLeaderStatusSum = async (): Promise<number | undefined> =>
    await this.prometheusApi.instantQueryValue(`sum(${HaApi.leaderStatusMetric})`);

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

  /** Sorted to compare with {@link getNodeNames}. */
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
   * Metrics trail a failover by a scrape, and HAProxy points at the active
   * leader, so killing that pod makes the API 5xx until it re-points. Both are
   * polled through rather than failed on.
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
   * Tolerates the same mid-failover 5xx as {@link waitForLeaderInMetrics}, and
   * returns the last value seen so the caller keeps the assertion.
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

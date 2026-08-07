import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import PrometheusApi from '@api/prometheus.api';
import { HaNode, HaNodeRole, HaNodesResponse, HaStatusResponse } from '@interfaces/ha';
import { Timeouts } from '@helpers/timeouts';
import apiEndpoints from '@helpers/apiEndpoints';

/**
 * PMM HA cluster state, read both from the HA REST API (what the sidebar badge
 * renders) and from the `pmm_ha_*` metrics pmm-managed exports.
 *
 * `pmm_ha_leader_status` is 1 on the Raft leader and 0 on every follower, and
 * `node_id` carries the same node name the HA API reports, so the two sources
 * are directly comparable.
 */
export default class HaApi {
  static readonly leaderStatusMetric = 'pmm_ha_leader_status';
  private prometheusApi: PrometheusApi;

  constructor(private request: APIRequestContext) {
    this.prometheusApi = new PrometheusApi(request);
  }

  /**
   * Node name of the single series where `pmm_ha_leader_status == 1`, or
   * `undefined` while no leader is exported or more than one node still claims
   * leadership (the old leader's last sample lingers for one scrape after a
   * failover).
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
   * Node names reported by `pmm_ha_leader_status`, whatever their value. Used
   * to confirm the metric covers the whole cluster and not just the leader.
   */
  getNodesFromMetrics = async (): Promise<string[]> => {
    const samples = await this.prometheusApi.instantQuery(HaApi.leaderStatusMetric);

    return samples.map((sample) => sample.metric.node_id).filter(Boolean);
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
   * Poll the metrics until exactly one node reports leadership and, when
   * `previousLeader` is given, until that node is no longer the leader.
   *
   * Metrics trail reality by a scrape interval, so a failover is only visible
   * after the next scrape of the surviving nodes - hence the polling.
   *
   * @param   previousLeader  leader to wait away from; omit to accept any leader
   * @param   timeout         how long to keep polling
   */
  waitForLeaderInMetrics = async (
    previousLeader?: string,
    timeout: Timeouts = Timeouts.FIVE_MINUTES,
  ): Promise<string> => {
    const deadline = Date.now() + timeout;
    let lastSeen: string | undefined;

    while (Date.now() < deadline) {
      lastSeen = await this.getLeaderFromMetrics();

      if (lastSeen && lastSeen !== previousLeader) return lastSeen;

      await new Promise((resolve) => setTimeout(resolve, Timeouts.FIVE_SECONDS));
    }

    throw new Error(
      `No new leader was reported by "${HaApi.leaderStatusMetric}" within ${timeout}ms` +
        `${previousLeader ? ` (previous leader: ${previousLeader})` : ''}. ` +
        `Last observed leader: ${lastSeen ?? 'none'}`,
    );
  };
}

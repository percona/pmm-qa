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
  static readonly raftTermMetric = 'pmm_ha_raft_term';
  static readonly upMetric = 'pmm_ha_up';
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

  /** Sorted node ids exporting `metric`, to compare with {@link getNodeNames}. */
  getNodesFromMetric = async (metric: string): Promise<string[]> => {
    const samples = await this.prometheusApi.instantQuery(metric);

    return samples
      .map((sample) => sample.metric.node_id)
      .filter(Boolean)
      .sort();
  };

  /** Per-node Raft term changes over `window`, sorted by node id so two calls line up. */
  getRaftTermChanges = async (window = '15m'): Promise<number[]> => {
    const samples = await this.prometheusApi.instantQuery(`changes(${HaApi.raftTermMetric}[${window}])`);

    return samples
      .sort((left, right) => left.metric.node_id.localeCompare(right.metric.node_id))
      .map((sample) => Number(sample.value[1]));
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

  /** Live nodes carrying a Raft vote; below the replica count the cluster cannot hold quorum. */
  getVoterCount = async (): Promise<number | undefined> =>
    await this.prometheusApi.instantQueryValue(`count(${HaApi.upMetric}{role="voter"})`);

  /**
   * Metrics trail a failover by a scrape, and HAProxy 5xxs until it re-points at
   * the new leader. `toPass`, not `expect.poll`, because that 5xx throws.
   *
   * @param   previousLeader  leader to wait away from; omit to accept any leader
   */
  waitForLeaderInMetrics = async (
    previousLeader?: string,
    timeout: Timeouts = Timeouts.FIVE_MINUTES,
  ): Promise<string> => {
    let leader = '';

    await expect(async () => {
      const current = (await this.getLeaderFromMetrics()) ?? '';

      expect(current, `Exactly one node must report ${HaApi.leaderStatusMetric} == 1`).not.toEqual('');
      expect(current, `Leadership must move off "${previousLeader}"`).not.toEqual(previousLeader);

      leader = current;
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout });

    return leader;
  };

  /** Throws if the sum never settles; tolerates the same mid-failover 5xx. */
  waitForLeaderStatusSum = async (
    expected: number,
    timeout: Timeouts = Timeouts.TWO_MINUTES,
  ): Promise<void> => {
    await expect(async () => {
      expect(
        await this.getLeaderStatusSum(),
        `sum(${HaApi.leaderStatusMetric}) must be ${expected} - 0 means no leader, >1 means split-brain`,
      ).toEqual(expected);
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout });
  };
}

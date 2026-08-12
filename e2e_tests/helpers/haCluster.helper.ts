import K8sHelper from '@helpers/k8s.helper';
import { Timeouts } from '@helpers/timeouts';
import apiEndpoints from '@helpers/apiEndpoints';
import { expect } from '@playwright/test';

const leaderLogLine = 'I am the leader!';
const pmmManagedLog = '/srv/logs/pmm-managed.log';
const pmmServerPort = 8_443;

export const pmmServerPodSelector = 'app.kubernetes.io/component=pmm-server';

/**
 * PMM HA leadership asked of each pod directly, so tests can assert the UI and
 * the aggregated APIs against an independent source.
 */
export default class HaClusterHelper {
  constructor(private k8sHelper: K8sHelper = new K8sHelper()) {}

  /**
   * Epoch millis of the pod's last promotion on its own clock, 0 if it never
   * led. This is history, not current state - use {@link leaderFromPods} to ask
   * who leads now.
   */
  lastPromotionTime = (podName: string): number => {
    const line = this.k8sHelper
      .execInPod(podName, `sh -c "grep -a '${leaderLogLine}' ${pmmManagedLog} | tail -1"`, { silent: true })
      .stdout.trim();
    const timestamp = /time="([^"]+)"/.exec(line)?.[1];

    return timestamp ? Date.parse(timestamp) : 0;
  };

  /** The pod answering 200 on the leader health check; followers answer 400. */
  leaderFromPods = (podNames: string[] = this.podNames()): string => {
    const leaders = podNames.filter((podName) => this.isLeader(podName));

    if (leaders.length !== 1) {
      throw new Error(
        `Expected exactly one pod to answer ${apiEndpoints.server.leaderHealthCheck} with 200, got: ${
          leaders.length ? leaders.join(', ') : 'none'
        }`,
      );
    }

    return leaders[0];
  };

  podNames = (): string[] => this.k8sHelper.getPodNames(pmmServerPodSelector).sort();

  /** Looked up by label rather than hardcoded: the name is the Helm release name. */
  statefulSetName = (): string => {
    const names = this.k8sHelper.getStatefulSetNames(pmmServerPodSelector);

    if (names.length !== 1) {
      throw new Error(
        `Expected exactly one StatefulSet matching "${pmmServerPodSelector}", got: ${
          names.length ? names.join(', ') : 'none'
        }`,
      );
    }

    return names[0];
  };

  /**
   * Waits for leadership to move, tolerating the election that {@link
   * leaderFromPods} throws through: while Raft is voting no pod answers 200,
   * and the pod being restarted cannot be `exec`ed into at all. `toPass` retries
   * on that throw - `expect.poll` would propagate it out of the callback.
   *
   * @param   previousLeader  leader to wait away from; omit to accept any leader
   */
  waitForLeaderChange = async (
    previousLeader?: string,
    timeout: Timeouts = Timeouts.FIVE_MINUTES,
  ): Promise<string> => {
    let leader = '';

    await expect(async () => {
      leader = this.leaderFromPods();

      expect(leader, `Leadership must move off "${previousLeader}"`).not.toEqual(previousLeader);
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout });

    return leader;
  };

  // Hits the pod directly rather than through HAProxy, which only ever routes
  // to whichever pod passes this same check.
  private isLeader = (podName: string): boolean =>
    this.k8sHelper
      .execInPod(
        podName,
        `curl -sk -o /dev/null -w "%{http_code}" https://127.0.0.1:${pmmServerPort}${apiEndpoints.server.leaderHealthCheck}`,
        { silent: true },
      )
      .stdout.trim() === '200';
}

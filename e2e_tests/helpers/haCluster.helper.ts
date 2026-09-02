import K8sHelper from '@helpers/k8s.helper';
import { Timeouts } from '@helpers/timeouts';
// Type-only: keeps this helper free of a runtime dependency on the api layer.
import type HaApi from '@api/ha.api';
import apiEndpoints from '@helpers/apiEndpoints';
import { HaFailoverProbe, HaStatusResponse } from '@interfaces/ha';
import { APIRequestContext, expect } from '@playwright/test';

const leaderLogLine = 'I am the leader!';
const pmmManagedLog = '/srv/logs/pmm-managed.log';
const pmmServerPort = 8_443;

export const pmmServerPodSelector = 'app.kubernetes.io/component=pmm-server';
/** The `pmm-ha` chart default. */
export const defaultReplicas = 3;

/**
 * PMM HA leadership asked of each pod directly, so tests can assert the UI and
 * the aggregated APIs against an independent source.
 */
export default class HaClusterHelper {
  constructor(private k8sHelper: K8sHelper = new K8sHelper()) {}

  /**
   * Brings the cluster back to `replicas` ready and *reachable* nodes. A run
   * killed mid-scale-down never reaches its cleanup, so the next one repairs.
   */
  ensureServing = async (haApi: HaApi, replicas: number = defaultReplicas): Promise<void> => {
    this.k8sHelper.assertReachable();

    const statefulSet = this.statefulSetName();

    if (this.k8sHelper.getStatefulSetReplicas(statefulSet) !== replicas) {
      this.k8sHelper.scaleStatefulSet(statefulSet, replicas).assertSuccess();
    }

    // `kubectl wait` fails outright on pods the StatefulSet has not recreated yet.
    // Scaling 0 -> 3 is the slow path at roughly two minutes, the pods being
    // OrderedReady, so they come up one at a time.
    await expect
      .poll(() => this.k8sHelper.getPods(pmmServerPodSelector).filter((pod) => pod.ready).length, {
        message: `The HA cluster must have ${replicas} ready pods`,
        timeout: Timeouts.FIVE_MINUTES,
      })
      .toEqual(replicas);

    await this.waitForApiServing(haApi);
  };

  /** Restarts the current leader and returns the pod that takes over, once the API serves again. */
  failoverLeader = async (haApi: HaApi, timeout: Timeouts = Timeouts.FIVE_MINUTES): Promise<string> => {
    const initialLeader = await this.waitForLeaderChange(undefined, timeout);

    this.k8sHelper.deletePod(initialLeader).assertSuccess();

    const newLeader = await this.waitForLeaderChange(initialLeader, timeout);

    await this.waitForApiServing(haApi);

    return newLeader;
  };

  /**
   * {@link failoverLeader} while polling `path` through HAProxy, which is the only way to
   * tell a brief election gap from the public URL actually going down. Reports the longest
   * unbroken stretch of 5xx or connection errors.
   */
  failoverLeaderWhileProbing = async (
    haApi: HaApi,
    request: APIRequestContext,
    path: string,
  ): Promise<HaFailoverProbe> => {
    let probing = true;
    let longestOutage = 0;
    let outageStart = 0;
    let failures = 0;
    let probes = 0;
    // Back-to-back, with no sleep between requests: a sampled probe can only ever
    // bound an outage by its own interval, so "the UI never went down" is not a
    // claim a 1s poll is entitled to make. Each request costs milliseconds, which
    // is the rate limit.
    const probe = (async () => {
      while (probing) {
        const served = await request
          .get(path, { failOnStatusCode: false, maxRedirects: 0, timeout: Timeouts.TEN_SECONDS })
          .then((response) => response.status() < 500)
          .catch(() => false);

        probes++;

        if (served) {
          outageStart = 0;
        } else {
          failures++;
          outageStart ||= Date.now();
          longestOutage = Math.max(longestOutage, Date.now() - outageStart);
        }
      }
    })();
    const newLeader = await this.failoverLeader(haApi);

    probing = false;
    await probe;

    return { failures, longestOutage, newLeader, probes };
  };

  /** How Grafana itself reaches the shared PostgreSQL, read from the pod rather than from the API under test. */
  grafanaDatabaseEnv = (podName: string): Record<string, string> => {
    const { stdout } = this.k8sHelper.execInPod(podName, 'env', { silent: true });
    const variables = stdout
      .split('\n')
      .map((line) => /^(GF_DATABASE_[A-Z_]+)=(.*)$/.exec(line))
      .filter((match) => match !== null)
      .map((match) => [match[1], match[2].trim()]);

    if (variables.length === 0) {
      throw new Error(`Pod "${podName}" exports no GF_DATABASE_* variables`);
    }

    return Object.fromEntries(variables);
  };

  /** HA status as the pod itself reports it; HAProxy would only ever answer for the leader. */
  haStatusFromPod = (podName: string): string => {
    const password = process.env.ADMIN_PASSWORD ?? 'admin';
    const { stdout } = this.k8sHelper.execInPod(
      podName,
      `curl -sk -u admin:${password} https://127.0.0.1:${pmmServerPort}${apiEndpoints.ha.status}`,
      { silent: true },
    );

    return (JSON.parse(stdout) as HaStatusResponse).status;
  };

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

  /** Looked up by label, not hardcoded: the name is the Helm release name. */
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
   * Ready pods, and even an elected leader, are not yet reachable: HAProxy has to
   * re-run its health check and re-point first.
   */
  waitForApiServing = async (haApi: HaApi, timeout: Timeouts = Timeouts.TWO_MINUTES): Promise<void> => {
    await expect(async () => {
      expect(await haApi.getStatus()).toEqual('Enabled');
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout });
  };

  /**
   * `toPass`, not `expect.poll`: {@link leaderFromPods} throws mid-election, when
   * no pod answers 200 and the restarting pod cannot be `exec`ed into at all.
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

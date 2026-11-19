import K8sHelper from '@helpers/k8s.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const clickHouseSelector = 'clickhouse.altinity.com/chi';
const qanApiLog = '/srv/logs/qan-api2.log';
const replicatedEngine = "ENGINE = Replicated('/clickhouse/databases/{uuid}', '{shard}', '{replica}')";

/** One ClickHouse server's `pmm` database: its UUID ('' when it has none) and `pmm.metrics` rows. */
export interface PmmCopy {
  pod: string;
  rows: number;
  uuid: string;
}

export default class HaClickHouseHelper {
  constructor(private k8sHelper: K8sHelper = new K8sHelper()) {}

  /** A Replicated `pmm` under a fresh UUID, the split PMM-15785 repairs. */
  createStrayPmm = (pod: string): void => {
    this.dropPmm(pod);
    this.query(pod, `CREATE DATABASE pmm ${replicatedEngine}`);
  };

  dropPmm = (pod: string): void => {
    this.query(pod, 'DROP DATABASE IF EXISTS pmm SYNC');
  };

  /** Rows written before `before`, a count new QAN data cannot move while replicas catch up. */
  metricsRowsBefore = (pod: string, before: Date): number =>
    Number(
      this.query(
        pod,
        `SELECT count() FROM pmm.metrics WHERE period_start < toDateTime(${Math.floor(before.getTime() / 1_000)})`,
      ),
    );

  pmmCopies = (pods: string[] = this.pods()): PmmCopy[] =>
    pods.map((pod) => ({
      pod,
      rows: Number(
        this.query(
          pod,
          "SELECT sum(rows) FROM system.parts WHERE database = 'pmm' AND table = 'metrics' AND active",
        ),
      ),
      uuid: this.query(pod, "SELECT toString(uuid) FROM system.databases WHERE name = 'pmm'"),
    }));

  /** The `component=pmm-db` lines qan-api2 has logged on a PMM Server pod; the log is on a PVC and keeps old runs. */
  pmmDbLog = (pmmPod: string): string[] =>
    this.k8sHelper
      .execInPod(pmmPod, `grep -a component=pmm-db ${qanApiLog}`, { silent: true })
      .stdout.split('\n')
      .filter(Boolean);

  /** Whether a `pmm-db` line after the first `since` has `message` and every `fields` value, e.g. `uuid`. */
  pmmDbLogged = (
    pmmPod: string,
    since: number,
    message: string,
    fields: Record<string, string> = {},
  ): boolean =>
    this.pmmDbLog(pmmPod)
      .slice(since)
      .some(
        (line) =>
          line.includes(message) &&
          Object.entries(fields).every(([name, value]) =>
            new RegExp(`(^|\\s)${name}=${value}(\\s|$)`).test(line),
          ),
      );

  pods = (): string[] => this.k8sHelper.getPodNames(clickHouseSelector).sort();

  query = (pod: string, query: string): string => {
    const user = this.k8sHelper.getSecretValue('pmm-secret', 'PMM_CLICKHOUSE_USER');
    const password = this.k8sHelper.getSecretValue('pmm-secret', 'PMM_CLICKHOUSE_PASSWORD');
    const result = this.k8sHelper.execInPod(
      pod,
      `clickhouse-client --user '${user}' --password '${password}' --query "${query}"`,
      { container: 'clickhouse', silent: true },
    );

    // Not assertSuccess(): its message quotes the command, password and all.
    if (result.code !== 0) {
      throw new Error(`ClickHouse query "${query}" on ${pod} failed: ${result.stderr.trim()}`);
    }

    return result.stdout.trim();
  };

  /** The leader runs the pmm database check as soon as qan-api2 starts. */
  restartQanApi = (pmmPod: string): void => {
    this.k8sHelper.execInPod(pmmPod, 'supervisorctl restart qan-api2', { silent: true }).assertSuccess();
  };

  startServer = async (pod: string): Promise<void> => {
    this.k8sHelper.scaleStatefulSet(this.statefulSet(pod), 1).assertSuccess();
    await expect(async () => {
      expect(this.query(pod, 'SELECT 1')).toEqual('1');
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
  };

  statefulSet = (pod: string): string => pod.replace(/-\d+$/, '');

  stopServer = async (pod: string): Promise<void> => {
    this.k8sHelper.scaleStatefulSet(this.statefulSet(pod), 0).assertSuccess();
    await expect
      .poll(() => this.pods(), {
        message: `ClickHouse pod "${pod}" must be gone`,
        timeout: Timeouts.FIVE_MINUTES,
      })
      .not.toContain(pod);
  };

  syncMetrics = (pod: string): void => {
    this.query(pod, 'SYSTEM SYNC REPLICA pmm.metrics');
  };

  /** @returns the one `pmm` UUID every server holds, once they all hold it */
  waitForOnePmm = async (pods: string[], timeout: Timeouts = Timeouts.TWO_MINUTES): Promise<string> => {
    let uuids: string[] = [];

    await expect(async () => {
      uuids = this.pmmCopies(pods).map((copy) => copy.uuid);

      expect(
        new Set(uuids).size,
        `Every ClickHouse server must hold the same pmm, got: ${uuids.join(', ')}`,
      ).toEqual(1);
      expect(uuids[0], 'Every ClickHouse server must hold a pmm database').not.toEqual('');
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout });

    return uuids[0];
  };
}

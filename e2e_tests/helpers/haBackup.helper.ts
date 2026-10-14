import K8sHelper from '@helpers/k8s.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const backupToolsSelector = 'app.kubernetes.io/component=backup-tools';
const backupCronJobSelector = 'app.kubernetes.io/component=backup-cronjob';
const clickHouseSelector = 'clickhouse.altinity.com/chi';
const vmInsertSelector = 'app.kubernetes.io/name=vminsert,!operator.victoriametrics.com/additional-service';
const vmInsertPort = 8_480;

export interface BackupListEntry {
  components: string[];
  id: string;
  latest: boolean;
  status: string;
}

interface JobManifest {
  metadata: { name: string; ownerReferences?: unknown };
  spec: {
    activeDeadlineSeconds?: number;
    backoffLimit?: number;
    template: { spec: { containers: { args?: string[] }[] } };
  };
}

const single = (names: string[], what: string): string => {
  if (names.length !== 1) {
    throw new Error(`Expected exactly one ${what}, got: ${names.length ? names.join(', ') : 'none'}`);
  }

  return names[0];
};

/**
 * `pmm-backup.sh` as the chart ships it (charts/pmm-ha/docs/pmm-backup.md), and
 * direct access to the stores it backs up, so a restore can be judged by the data
 * rather than by the tool's own report.
 */
export default class HaBackupHelper {
  constructor(private k8sHelper: K8sHelper = new K8sHelper()) {}

  /** Throws on a cluster installed without `centralBackupStorage.enabled`, rather than skipping. */
  backupToolsDeployment = (): string =>
    single(
      this.k8sHelper.getNames('deployment', backupToolsSelector),
      `backup-tools Deployment ("${backupToolsSelector}") - is centralBackupStorage enabled?`,
    );

  /** As `clickhouse-client` in the first replica, the pod `pmm-backup.sh` restores into. */
  clickHouseQuery = (query: string): string => {
    const pod = this.k8sHelper.getPodNames(clickHouseSelector).sort()[0];
    const user = this.k8sHelper.getSecretValue('pmm-secret', 'PMM_CLICKHOUSE_USER');
    const password = this.k8sHelper.getSecretValue('pmm-secret', 'PMM_CLICKHOUSE_PASSWORD');
    const result = this.k8sHelper.execInPod(
      pod,
      `clickhouse-client --user '${user}' --password '${password}' --query "${query}"`,
      { container: 'clickhouse', silent: true },
    );

    // Not assertSuccess(): its message quotes the command, password and all.
    if (result.code !== 0) throw new Error(`ClickHouse query "${query}" failed: ${result.stderr.trim()}`);

    return result.stdout.trim();
  };

  /** Bypasses vmauth and the PMM scrape path, so the samples come from nothing under test. */
  importMetric = (podName: string, sample: string): void => {
    const service = single(this.k8sHelper.getNames('service', vmInsertSelector), 'vminsert Service');

    this.k8sHelper
      .execInPod(
        podName,
        `curl -sf --data-binary '${sample}' http://${service}:${vmInsertPort}/insert/0/prometheus/api/v1/import/prometheus`,
        { silent: true },
      )
      .assertSuccess();
  };

  listBackups = (): BackupListEntry[] =>
    this.k8sHelper
      .execInPod(`deployment/${this.backupToolsDeployment()}`, 'pmm-backup.sh list', { silent: true })
      .assertSuccess()
      .stdout.split('\n')
      .map((line) => /^\s+(backup_\S+)\s+(\S+)\s+(\S+)(\s+\*latest)?\s*$/.exec(line))
      .filter((match) => match !== null)
      .map(([, id, status, components, latest]) => ({
        components: components.split(','),
        id,
        latest: Boolean(latest),
        status,
      }));

  /** The CronJob's jobTemplate verbatim - the documented ad-hoc backup. */
  runBackupJob = async (name: string): Promise<void> => {
    this.k8sHelper.exec(`create job ${name} --from=cronjob/${this.cronJobName()}`).assertSuccess();
    await this.waitForJob(name, Timeouts.THIRTY_MINUTES);
  };

  /**
   * The documented clone-and-swap: only `args` change, because `command` carries
   * the tool bootstrap. No retry, no deadline and no owner, so neither a second
   * attempt nor the CronJob's history limits touch a restore half way through.
   */
  runRestoreJob = async (name: string, backupId: string): Promise<void> => {
    const job = JSON.parse(
      this.k8sHelper
        .execSilent(`create job ${name} --from=cronjob/${this.cronJobName()} --dry-run=client --output=json`)
        .assertSuccess().stdout,
    ) as JobManifest;

    job.spec.template.spec.containers[0].args = ['restore', '--backup-id', backupId, '--yes'];
    job.spec.backoffLimit = 0;
    delete job.spec.activeDeadlineSeconds;
    delete job.metadata.ownerReferences;

    this.k8sHelper.apply(job).assertSuccess();
    await this.waitForJob(name, Timeouts.SIXTY_MINUTES);
  };

  srvFiles = (podName: string): string[] =>
    this.k8sHelper.execInPod(podName, 'ls -A /srv', { silent: true }).assertSuccess().getStdOutLines();

  touchSrvFile = (podName: string, fileName: string): void => {
    this.k8sHelper.execInPod(podName, `touch /srv/${fileName}`, { silent: true }).assertSuccess();
  };

  waitForJob = async (name: string, timeout: Timeouts): Promise<void> => {
    let state = '';

    await expect(async () => {
      state = this.k8sHelper.getJobState(name);

      expect(state, `Job "${name}" must finish`).not.toEqual('Running');
    }).toPass({ intervals: [Timeouts.THIRTY_SECONDS], timeout });

    expect(
      state,
      `Job "${name}" failed:\n${this.k8sHelper.execSilent(`logs job/${name} --tail=80`).stdout}`,
    ).toEqual('Complete');
  };

  private cronJobName = (): string =>
    single(this.k8sHelper.getNames('cronjob', backupCronJobSelector), 'backup CronJob');
}

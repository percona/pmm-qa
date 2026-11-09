import K8sHelper from '@helpers/k8s.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';
// Type-only: keeps this helper free of a runtime dependency on the api layer.
import type Api from '@api/api';

const backupToolsSelector = 'app.kubernetes.io/component=backup-tools';
const backupCronJobSelector = 'app.kubernetes.io/component=backup-cronjob';
const clickHouseSelector = 'clickhouse.altinity.com/chi';
const vmInsertSelector = 'app.kubernetes.io/name=vminsert,!operator.victoriametrics.com/additional-service';
const vmInsertPort = 8_480;
const markerMetric = 'pmm_e2e_backup_marker';

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

export default class HaBackupHelper {
  constructor(private k8sHelper: K8sHelper = new K8sHelper()) {}

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

  cronJobName = (): string =>
    single(this.k8sHelper.getNames('cronjob', backupCronJobSelector), 'backup CronJob');

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

  /** Every pod's, retries included; empty when the Job does not exist. */
  jobLogs = (name: string): string =>
    this.k8sHelper.execSilent(`logs --selector=job-name=${name} --all-containers --prefix --tail=-1`).stdout;

  latestBackup = (): BackupListEntry => {
    const latest = this.listBackups().find((backup) => backup.latest);

    if (!latest) throw new Error('`pmm-backup.sh list` shows no latest backup, or its format changed');

    return latest;
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

  removeSrvFiles = (podName: string, fileNames: string[]): void => {
    this.k8sHelper.execInPod(podName, `rm -f ${fileNames.map((fileName) => `/srv/${fileName}`).join(' ')}`, {
      silent: true,
    });
  };

  runBackupJob = async (name: string): Promise<void> => {
    this.k8sHelper.exec(`create job ${name} --from=cronjob/${this.cronJobName()}`).assertSuccess();
    await this.waitForJob(name, Timeouts.THIRTY_MINUTES);
  };

  /** Only `args` change: `command` carries the tool bootstrap. */
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
}

/** One marker per phase in every store a restore rewinds, so `found()` shows which phases came back. */
export class RestoreMarkers {
  readonly table: string;

  constructor(
    private api: Api,
    private backupHelper: HaBackupHelper,
    private podNames: string[],
    private run: number,
    private phases: string[] = ['before', 'after'],
  ) {
    // In PMM's own Replicated database, so the marker takes the restore path QAN data takes.
    this.table = `pmm.pmm_e2e_backup_${run}`;
  }

  createTable = (): void => {
    this.backupHelper.clickHouseQuery(
      `CREATE TABLE ${this.table} (marker String) ENGINE = ReplicatedMergeTree ORDER BY marker`,
    );
  };

  everywhere = (expected: string[]): Record<string, string[]> => ({
    clickhouse: expected,
    postgresql: expected,
    ...Object.fromEntries(this.podNames.map((podName) => [`srv on ${podName}`, expected])),
    victoriametrics: expected,
  });

  found = async (): Promise<Record<string, string[]>> => ({
    clickhouse: this.present(
      this.backupHelper.clickHouseQuery(`SELECT marker FROM ${this.table}`).split('\n'),
    ),
    postgresql: this.present((await this.api.grafanaApi.getFolders()).map((folder) => folder.title)),
    ...Object.fromEntries(
      this.podNames.map((podName) => [
        `srv on ${podName}`,
        this.present(this.backupHelper.srvFiles(podName)),
      ]),
    ),
    victoriametrics: this.present(
      (
        await this.api.prometheusApi.instantQuery(`last_over_time(${markerMetric}{run="${this.run}"}[1h])`, {
          nocache: '1',
        })
      ).map((sample) => sample.metric.marker),
    ),
  });

  name = (phase: string): string => `pmm-e2e-${phase}-backup-${this.run}`;

  present = (found: string[]): string[] => this.phases.filter((phase) => found.includes(this.name(phase)));

  remove = async (): Promise<void> => {
    for (const folder of await this.api.grafanaApi.getFolders()) {
      if (this.present([folder.title]).length) await this.api.grafanaApi.deleteFolder(folder.uid);
    }

    for (const podName of this.podNames) {
      this.backupHelper.removeSrvFiles(
        podName,
        this.phases.map((phase) => this.name(phase)),
      );
    }

    this.backupHelper.clickHouseQuery(`DROP TABLE IF EXISTS ${this.table} SYNC`);
  };

  write = async (phase: string): Promise<void> => {
    await this.api.grafanaApi.createFolder(this.name(phase));
    this.backupHelper.clickHouseQuery(`INSERT INTO ${this.table} VALUES ('${this.name(phase)}')`);
    this.backupHelper.importMetric(
      this.podNames[0],
      `${markerMetric}{run="${this.run}",marker="${this.name(phase)}"} 1`,
    );

    for (const podName of this.podNames) this.backupHelper.touchSrvFile(podName, this.name(phase));

    await expect
      .poll(async () => (await this.found()).victoriametrics, { timeout: Timeouts.TWO_MINUTES })
      .toContain(phase);
  };
}

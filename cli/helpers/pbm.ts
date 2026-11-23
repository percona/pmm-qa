import { expect, test } from '@playwright/test';
import * as cli from '@helpers/cli-helper';
import { runOnPrimary } from '@helpers/mongo';
import { getPmmAdminVersion } from '@helpers/pmm-admin';
import { versionBelow } from '@helpers/versionGates';

export const exporterPassword = 'mypass';
export const exporterPath = '/usr/local/percona/pmm/exporters/mongodb_exporter';
export const baselineVersion = '3.10.0';
export const baselineExporterPath = `/tmp/mongodb_exporter-${baselineVersion}`;
export const agentLogPath = '/var/log/pmm-agent.log';
export const mongoRootUri = 'mongodb://root:root@localhost:27017/?authSource=admin&directConnection=true';

// The PBM metrics 3.10.0 already has: their series and values must not change.
export const existingPbmMetrics = [
  'mongodb_pbm_agent_status',
  'mongodb_pbm_backup_size_bytes',
  'mongodb_pbm_backup_last_transition_ts',
  'mongodb_pbm_backup_duration_seconds',
  'mongodb_pbm_cluster_backup_configured',
  'mongodb_pbm_cluster_pitr_backup_enabled',
];

export interface Series {
  name: string;
  labels: Record<string, string>;
  value: number;
}

const samplePattern = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+(\S+)$/;
const labelPattern = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g;

export const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

/**
 * Parse the samples of an exporter scrape whose metric name starts with a prefix
 *
 * @param   metrics   text of the scrape
 * @param   prefix    metric name prefix to keep
 */
export function parseSeries(metrics: string, prefix = 'mongodb_pbm_'): Series[] {
  const series: Series[] = [];

  for (const line of metrics.split('\n')) {
    if (!line.startsWith(prefix)) continue;

    const match = line.match(samplePattern);
    if (!match) continue;

    const labels: Record<string, string> = {};
    for (const [, key, value] of (match[2] ?? '').matchAll(labelPattern)) {
      labels[key] = value;
    }
    series.push({
      name: match[1],
      labels,
      value: Number(match[3]),
    });
  }

  return series;
}

export const seriesText = (series: Series): string => {
  const labels = Object.entries(series.labels).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}="${value}"`);

  return `${series.name}${labels.length ? `{${labels.join(',')}}` : ''} ${series.value}`;
};

export const seriesTexts = (series: Series[]): string[] => series.map(seriesText).sort();

export function selectSeries(series: Series[], name: string, labels: Record<string, string> = {}): Series[] {
  return series.filter((item) => item.name === name && Object.entries(labels).every(([key, value]) => item.labels[key] === value));
}

/**
 * Value of the only series with a name and labels, undefined when there is none
 */
export function seriesValue(series: Series[], name: string, labels: Record<string, string> = {}): number | undefined {
  const found = selectSeries(series, name, labels);
  expect(found.length, `${name} ${JSON.stringify(labels)} has ${found.length} series:\n${seriesTexts(found).join('\n')}`).toBeLessThanOrEqual(1);

  return found[0]?.value;
}

/**
 * The series without their self label, which differs between the exporters of a cluster
 */
export const ignoreSelf = (series: Series[]): Series[] => series.map((item) => ({
  ...item,
  labels: Object.fromEntries(Object.entries(item.labels).filter(([key]) => key !== 'self')),
}));

export const onlyExisting = (series: Series[]): Series[] => series.filter((item) => existingPbmMetrics.includes(item.name));

/**
 * PBM series of a service's mongodb_exporter, scraped through pmm-admin's listen port. Only the PBM series and mongodb_up
 * are kept, as a scrape is large and a test repeats it.
 *
 * @param   container   docker container running pmm-agent
 * @param   service     name of the MongoDB service, or a part of it
 * @param   prefix      metric name prefix to keep, mongodb_up to read the exporter's connection state
 */
export async function scrapePbm(container: string, service: string = container, prefix = 'mongodb_pbm_'): Promise<Series[]> {
  const port = await exporterPort(container, service);
  const scrape = '/tmp/pbm-metrics-scrape.txt';
  const output = await cli.exec(
    `docker exec ${container} sh -c 'curl -sf -u pmm:${exporterPassword} http://127.0.0.1:${port}/metrics -o ${scrape} && grep -E "^(mongodb_pbm_|mongodb_up)" ${scrape}; test $? -le 1'`,
  );
  await output.assertSuccess();

  return parseSeries(output.stdout, prefix);
}

export async function exporterPort(container: string, serviceName: string): Promise<number> {
  const list = JSON.parse((await cli.exec(`docker exec ${container} pmm-admin list --json`)).stdout) as {
    service: { service_id: string, service_name: string }[],
    agent: { agent_type: string, service_id: string, port?: number }[],
  };
  const service = list.service.find((item) => item.service_name.includes(serviceName));
  const exporter = list.agent.find((agent) => agent.agent_type === 'AGENT_TYPE_MONGODB_EXPORTER' && agent.service_id === service?.service_id);
  expect(exporter?.port, `mongodb_exporter of service ${serviceName} has no listen port`).toBeTruthy();

  return exporter?.port ?? 0;
}

export interface SpawnedScrape {
  scrapes: string[];
  log: string;
}

/**
 * Run a second mongodb_exporter binary with the flags and the URI of the exporter pmm-agent runs for a service,
 * scrape it and return what it served and logged, so two builds can be compared on the same node.
 *
 * @param   container   docker container running pmm-agent
 * @param   service     name of the MongoDB service, or a part of it
 * @param   binary      path of the mongodb_exporter binary in the container
 * @param   options     number of scrapes, and credentials to use instead of the service's
 */
export async function spawnScrape(
  container: string,
  service: string,
  binary: string,
  options: { scrapes?: number, user?: string, password?: string } = {},
): Promise<SpawnedScrape> {
  const port = await exporterPort(container, service);
  const credentials = options.user ? `-e EXPORTER_USER=${options.user} -e EXPORTER_PASSWORD=${options.password}` : '';

  await (await cli.exec(`docker cp ./test-data/spawn-exporter-scrape.sh ${container}:/tmp/spawn-exporter-scrape.sh`)).assertSuccess();
  const output = await cli.exec(`docker exec ${credentials} ${container} bash /tmp/spawn-exporter-scrape.sh ${binary} ${port} ${options.scrapes ?? 1}`);
  await output.assertSuccess();

  const [scrapeText, log] = output.stdout.split('---LOG---\n');
  const scrapes = scrapeText.split(/^---SCRAPE \d+---$/m).slice(1);

  return { scrapes, log: log ?? '' };
}

/**
 * Put the 3.10.0 mongodb_exporter into containers, downloading it into the first one only when no run has before.
 * The path is the one the exporter size and memory test caches it at.
 */
export async function ensureBaselineExporter(containers: string[]) {
  const [first, ...others] = containers;
  const cached = await cli.exec(`docker exec ${first} test -s ${baselineExporterPath}`);

  if (cached.code !== 0) {
    const download = await cli.exec(
      `docker exec ${first} sh -c 'curl -fsSL --retry 3 --connect-timeout 30 `
      + `https://downloads.percona.com/downloads/pmm3/${baselineVersion}/binary/tarball/pmm-client-${baselineVersion}-$(uname -m).tar.gz `
      + `| tar -xzO --wildcards "*/bin/mongodb_exporter" > ${baselineExporterPath}.part && chmod 0755 ${baselineExporterPath}.part && mv ${baselineExporterPath}.part ${baselineExporterPath}'`,
    );
    await download.assertSuccess();
  }

  for (const container of others) {
    const present = await cli.exec(`docker exec ${container} test -s ${baselineExporterPath}`);

    if (present.code !== 0) {
      await (await cli.exec(`docker cp ${first}:${baselineExporterPath} - | docker cp - ${container}:/tmp/`)).assertSuccess();
    }
  }
}

/**
 * Skip every test of the describe block the call is made in when the pmm-client is older than a version
 */
export async function skipBelowClient(container: string, minVersion: string) {
  test.skip(versionBelow(await getPmmAdminVersion(container), minVersion), `Requires pmm-client ${minVersion}+`);
}

export const pbm = async (container: string, args: string) => cli.exec(`docker exec ${container} pbm ${args}`);

export async function pbmConfigValue(container: string, key: string): Promise<string> {
  const output = await pbm(container, `config ${key}`);
  const value = output.stdout.match(/=(.*)\]/)?.[1];
  expect(value, `no value of ${key} in: ${output.stdout}`).toBeDefined();

  return value ?? '';
}

export async function pbmJson<T>(container: string, args: string): Promise<T> {
  const output = await pbm(container, `${args} -o json`);
  await output.assertSuccess();

  return JSON.parse(output.stdout) as T;
}

export interface PbmStatus {
  backups: {
    snapshot?: { name: string, status: string, type: string, size?: number }[],
    pitrChunks: { pitrChunks?: { range: { start: number, end: number } }[] },
  };
  cluster: { rs: string, nodes: { host: string, agent: string, role: string, ok: boolean }[] }[];
  pitr: { conf: boolean, run: boolean };
  running: { type?: string, name?: string, status?: string };
}

export const pbmStatus = async (container: string) => pbmJson<PbmStatus>(container, 'status');

/**
 * End of the newest PITR range in pbm list, in seconds since epoch; undefined when there is none
 */
export async function pitrRangeEnd(container: string): Promise<number | undefined> {
  const list = await pbmJson<{ pitr: { on: boolean, ranges?: { range: { start: number, end: number } }[] } }>(container, 'list');
  const ends = (list.pitr.ranges ?? []).map((item) => item.range.end);

  return ends.length ? Math.max(...ends) : undefined;
}

export const externalPbmContainer = 'pbm-external';

let externalPbm: boolean | undefined;

/**
 * Whether PBM runs in the pbm-external container of pmm-framework's EXTERNAL_PBM=true, with a pbm-agent@<member> unit for each member
 * there and the members' own pbm-agent masked
 */
export async function isExternalPbm(): Promise<boolean> {
  if (externalPbm === undefined) {
    externalPbm = (await cli.exec(`docker ps -q -f 'name=^${externalPbmContainer}$'`)).stdout.trim() !== '';
  }

  return externalPbm;
}

/**
 * The container PBM's package is installed in for a member: the pbm-external container, or the member itself
 */
export async function pbmPackageHost(member: string): Promise<string> {
  return (await isExternalPbm()) ? externalPbmContainer : member;
}

export async function setAgents(containers: string[], action: 'start' | 'stop' | 'kill') {
  const external = await isExternalPbm();

  for (const container of containers) {
    // Only the main process: signalling the rest of the unit's cgroup fails with an I/O error on some Docker hosts, Docker Desktop among them.
    const command = action === 'kill' ? 'systemctl kill --kill-whom=main --signal=SIGKILL' : `systemctl ${action}`;
    const output = await cli.exec(
      external
        ? `docker exec ${externalPbmContainer} ${command} pbm-agent@${container}`
        : `docker exec ${container} ${command} pbm-agent`,
    );

    // A killed unit is failed, and stopping a failed one is not an error worth failing a cleanup for.
    if (action !== 'stop') await output.assertSuccess();
  }
}

/**
 * Restart mongod on the members and wait for the first one to be primary again. A physical backup that was cut short by killing
 * pbm-agent leaves its backup cursor open, which only a restart closes, and until then the next physical backup fails on that member.
 */
export async function restartMongod(containers: string[]) {
  for (const container of containers) {
    await (await cli.exec(`docker exec ${container} systemctl restart mongod`)).assertSuccess();
  }
  await runOnPrimary(containers[0], mongoRootUri, 'db.hello().isWritablePrimary');
}

/**
 * Wait until the PBM status lists every node of every replica set with its agent running and healthy
 */
export async function expectAgentsOk(container: string, timeout = 120_000) {
  await expect(async () => {
    const status = await pbmStatus(container);
    const nodes = status.cluster.flatMap((replset) => replset.nodes);

    expect(nodes.length, 'pbm status lists no nodes').toBeGreaterThan(0);
    expect(nodes.filter((node) => !node.ok).map((node) => node.host), 'nodes whose pbm-agent is not OK').toEqual([]);
  }).toPass({ intervals: [3_000], timeout });
}

export interface StartedOperation {
  name: string;
  output: string;
}

/**
 * Start a PBM backup or restore and return its name. The CLI gives up waiting for the agents' first answer after 30 seconds,
 * which a physical backup can take longer than, but the operation goes on, so its error is ignored once the name is known.
 */
export async function startOperation(container: string, args: string): Promise<StartedOperation> {
  let started: StartedOperation | undefined;

  await expect(async () => {
    const output = await pbm(container, args);
    const text = `${output.stdout}${output.stderr.text}`;
    const name = text.match(/Starting (?:backup|restore) '?([^'\s]+)/)?.[1];

    // Another operation, such as the resync a configuration change starts, can still hold PBM's lock.
    expect(name, `pbm ${args} did not start an operation: ${text}`).toBeTruthy();
    started = { name: name ?? '', output: text };
  }).toPass({ intervals: [3_000], timeout: 120_000 });

  return started as StartedOperation;
}

export async function countBackupRecords(container: string, filter: string): Promise<number> {
  const output = await cli.exec(`docker exec ${container} mongo "${mongoRootUri}" --quiet --eval 'db.getSiblingDB("admin").pbmBackups.countDocuments(${filter})'`);
  await output.assertSuccess();

  return Number(output.stdout.trim());
}

export async function backupStatus(container: string, name: string): Promise<string> {
  const backup = await pbmJson<{ status: string }>(container, `describe-backup ${name}`);

  return backup.status;
}

/**
 * Wait until a backup has a status. A backup that ends in error stops the wait, and a failure carries what PBM says about it.
 */
export async function expectBackupStatus(container: string, name: string, status: 'done' | 'error', timeout = 300_000) {
  const deadline = Date.now() + timeout;
  let current = 'not found';
  let detail = '';

  do {
    const output = await pbm(container, `describe-backup ${name} -o json`);

    if (output.code === 0) {
      const meta = JSON.parse(output.stdout) as { status: string, error?: string };

      current = meta.status;
      detail = meta.error ?? '';
    } else {
      current = 'not found';
      detail = `${output.stdout}${output.stderr.text}`.trim();
    }
    if (current === status || current === 'error') break;
    await sleep(5_000);
  } while (Date.now() < deadline);

  if (current !== status) {
    const logs = await pbm(container, 'logs --tail=40');

    expect(current, `status of backup ${name}: ${detail}\n${logs.stdout}`).toEqual(status);
  }
}

/**
 * Take a backup and wait until it is done
 *
 * @param   container   docker container to run pbm in
 * @param   type        backup type
 * @return  name of the backup
 */
export async function takeBackup(container: string, type: 'logical' | 'physical' = 'logical'): Promise<string> {
  const { name } = await startOperation(container, `backup --type=${type}`);
  await expectBackupStatus(container, name, 'done', type === 'physical' ? 600_000 : 300_000);

  return name;
}

export interface RestoreInfo {
  name: string;
  backup: string;
  type: string;
  status: string;
  start: string;
  finish: string;
}

export const describeRestore = async (container: string, name: string) => pbmJson<RestoreInfo>(container, `describe-restore ${name}`);

export async function expectRestoreStatus(container: string, name: string, status: 'done' | 'error', timeout = 300_000) {
  await expect(async () => {
    expect((await describeRestore(container, name)).status, `status of restore ${name}`).toEqual(status);
  }).toPass({ intervals: [2_000], timeout });
}

export const pbmStorageBucket = async (container: string) => pbmConfigValue(container, 'storage.s3.bucket');

const resyncOutcome = /^(\S+Z) (?:I .*\[resync\] succeed|E .*\[resync\] resync:)/;

/**
 * Wait until a resync has ended since a time, whether it succeeded or failed, which PBM's log tells and its status does not:
 * a restore that was interrupted by stopping its agents stays listed as running there for good.
 */
async function expectResyncEnded(container: string, since: number) {
  await expect(async () => {
    const logs = await pbm(container, 'logs --event=resync --tail=30');
    const ended = logs.stdout.split('\n').some((line) => {
      const logged = line.match(resyncOutcome)?.[1];

      return logged !== undefined && Date.parse(logged) >= since;
    });

    expect(ended, 'no resync has ended since it was requested').toBeTruthy();
  }).toPass({ intervals: [2_000], timeout: 120_000 });
}

/**
 * Resync the PBM metadata with the storage, which drops the records of backups that are not in it, such as failed ones.
 * Waiting with the CLI is not an option: it waits for good when the resync ended before it began to watch.
 */
export async function resync(container: string) {
  const startedAt = Date.now() - 2_000;

  await expect(async () => {
    await (await pbm(container, 'config --force-resync')).assertSuccess();
  }).toPass({ intervals: [3_000], timeout: 120_000 });
  await expectResyncEnded(container, startedAt);
}

/**
 * Point the PBM storage at a bucket that does not exist, which makes every backup fail at once
 */
export async function breakStorage(container: string) {
  const startedAt = Date.now() - 2_000;

  await (await pbm(container, 'config --set storage.s3.bucket=pbm-metrics-missing-bucket')).assertSuccess();
  await expectResyncEnded(container, startedAt);
}

/**
 * Point the PBM storage back at its bucket and resync
 */
export async function fixStorage(container: string, bucket: string) {
  const startedAt = Date.now() - 2_000;

  await (await pbm(container, `config --set storage.s3.bucket=${bucket}`)).assertSuccess();
  await expectResyncEnded(container, startedAt);
  await resync(container);
  await expectAgentsOk(container);
}

export const pauseStorage = async () => (await cli.exec('docker pause minio')).assertSuccess();

/**
 * Delete the restore history PBM keeps in the storage and imports into pbmRestores on a resync, which only a
 * physical restore leaves there. The storage is the framework's MinIO, which keeps its objects as files.
 */
export async function removeStoredRestores(container: string, bucket: string) {
  const prefix = await pbmConfigValue(container, 'storage.s3.prefix');

  await (await cli.exec(`docker exec minio rm -rf /backups/${bucket}/${prefix}/.pbm.restore`)).assertSuccess();
}

export const unpauseStorage = async () => cli.exec('docker unpause minio');

export async function logLineCount(container: string): Promise<number> {
  const output = await cli.exec(`docker exec ${container} wc -l ${agentLogPath}`);

  return Number(output.stdout.trim().split(' ')[0]);
}

/**
 * Lines pmm-agent has logged in a container since logLineCount returned a number
 */
export async function logSince(container: string, mark: number): Promise<string> {
  return (await cli.exec(`docker exec ${container} tail -n +${mark + 1} ${agentLogPath}`)).stdout;
}

/**
 * Lines of an exporter log that come from the PBM collector at warning level or above
 */
export const pbmLogProblems = (log: string): string[] => log.split('\n').filter((line) => /collector=pbm/.test(line) && /level=(WARN|ERROR)/.test(line));

async function expectExporterUp(container: string, service: string, timeout: number) {
  await expect(async () => {
    const series = await scrapePbm(container, service, 'mongodb_up');

    expect(seriesValue(series, 'mongodb_up'), `mongodb_up of ${service}`).toEqual(1);
  }).toPass({ intervals: [5_000], timeout });
}

/**
 * Wait until a service's exporter reports mongodb_up 1 again, restarting pmm-agent once when it does not recover by itself.
 * The exporter is found by service name as scrapePbm does: another service on the same host can match a text lookup first.
 */
export async function recoverExporter(container: string, service: string = container) {
  try {
    await expectExporterUp(container, service, 60_000);
  } catch {
    await (await cli.exec(`docker exec ${container} systemctl restart pmm-agent`)).assertSuccess();
    await expectExporterUp(container, service, 120_000);
  }
}

/**
 * Start a script that inserts a document into a collection every second for 30 minutes, so oplog keeps flowing
 *
 * @param   container   docker container to run the script in
 * @param   uri         connection string of a primary
 */
export async function startWriter(container: string, uri: string) {
  await (await cli.exec(`docker cp ./test-data/pbm-writer.js ${container}:/tmp/pbm-writer.js`)).assertSuccess();
  await (await cli.exec(`docker exec -d ${container} sh -c 'echo $$ > /tmp/pbm-writer.pid && exec mongo "${uri}" --quiet /tmp/pbm-writer.js'`)).assertSuccess();
}

export async function stopWriter(container: string) {
  await cli.exec(`docker exec ${container} sh -c 'kill $(cat /tmp/pbm-writer.pid) 2>/dev/null; rm -f /tmp/pbm-writer.pid; true'`);
}

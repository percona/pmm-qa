import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import { expectMongoUp } from '@helpers/mongo';
import { versionBelow } from '@helpers/versionGates';

const containerName = 'rs102';
const agentPassword = 'mypass';
const exporterPath = '/usr/local/percona/pmm/exporters/mongodb_exporter';
const baselineVersion = '3.10.0';
const baselineExporter = `/tmp/mongodb_exporter-${baselineVersion}`;
const currentExporterBackup = '/tmp/mongodb_exporter-under-test';
const minFixVersion = '3.11.0';
const megabyte = 1_000_000;
// Two runs of the same binary differ by up to about 6%; the fix measured 33% (46 to 31 MiB).
const requiredMemoryRatio = 0.85;

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

const fileSize = async (path: string) => {
  const output = await cli.exec(`docker exec ${containerName} stat -c %s ${path}`);
  await output.assertSuccess();

  return Number(output.stdout.trim());
};

const restartAgentAndWaitForExporter = async () => {
  await (await cli.exec(`docker exec ${containerName} systemctl restart pmm-agent`)).assertSuccess();
  await expectMongoUp(containerName, containerName, agentPassword);
};

// One scrape of the exporter itself: through PMM Server the _hr and _lr jobs would report the same process twice.
const exporterRss = async () => {
  const metrics = await cli.getMetrics(containerName, 'pmm', agentPassword, containerName);
  const value = metrics.match(/^process_resident_memory_bytes\s+(\S+)$/m)?.[1];
  expect(value, 'process_resident_memory_bytes is missing from the mongodb_exporter metrics').toBeTruthy();

  return Number(value);
};

const settledExporterRss = async () => {
  await restartAgentAndWaitForExporter();
  await sleep(30_000);
  const samples: number[] = [];

  for (let i = 0; i < 3; i++) {
    samples.push(await exporterRss());
    await sleep(10_000);
  }

  return samples.sort((a, b) => a - b)[1];
};

const mb = (bytes: number) => (bytes / megabyte).toFixed(1);
const mib = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

const restoreExporterUnderTest = async () => {
  const backedUp = await cli.exec(`docker exec ${containerName} test -f ${currentExporterBackup}`);

  if (backedUp.code === 0) {
    await cli.exec(`docker exec ${containerName} sh -c 'systemctl stop pmm-agent; install -m 0755 ${currentExporterBackup} ${exporterPath} && rm -f ${currentExporterBackup}; systemctl start pmm-agent'`);
    await expectMongoUp(containerName, containerName, agentPassword);
  }
};

test.describe('mongodb_exporter binary size and memory against 3.10.0 (PMM-15355)', { tag: '@exporter-footprint' }, () => {
  let baselineSize: number;

  test.beforeAll(async () => {
    test.setTimeout(10 * 60_000);
    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'PSMDB rs102 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=pss');

    const version: string = JSON.parse((await cli.exec(`docker exec ${containerName} pmm-admin --version --json`)).stdout).Version;
    // A development build carries a suffix (3.11.0-v3-<sha>) and can have the change before the release does.
    test.skip(/^\d+\.\d+\.\d+$/.test(version) && versionBelow(version, minFixVersion), `Requires pmm-client ${minFixVersion}+`);

    // A failed test restarts the worker and runs this hook again, so keep the download.
    const cached = await cli.exec(`docker exec ${containerName} test -s ${baselineExporter}`);

    if (cached.code !== 0) {
      const download = await cli.exec(
        `docker exec ${containerName} sh -c 'curl -fsSL --retry 3 --connect-timeout 30 `
        + `https://downloads.percona.com/downloads/pmm3/${baselineVersion}/binary/tarball/pmm-client-${baselineVersion}-$(uname -m).tar.gz `
        + `| tar -xzO --wildcards "*/bin/mongodb_exporter" > ${baselineExporter}.part && chmod 0755 ${baselineExporter}.part && mv ${baselineExporter}.part ${baselineExporter}'`,
      );
      await download.assertSuccess();
    }

    baselineSize = await fileSize(baselineExporter);
    expect(baselineSize, `The ${baselineVersion} mongodb_exporter was not extracted`).toBeGreaterThan(0);
  });

  test.afterAll(async () => {
    test.setTimeout(5 * 60_000);
    await restoreExporterUnderTest();
  });

  test('PMM-15355 - Verify mongodb_exporter is about 18 MB, less than half the size it was in 3.10.0', async ({}) => {
    const size = await fileSize(exporterPath);
    const message = `${exporterPath} is ${mb(size)} MB, expected about 18 MB (${baselineVersion}'s is ${mb(baselineSize)} MB)`;

    expect(size, message).toBeGreaterThan(14 * megabyte);
    expect(size, message).toBeLessThan(22 * megabyte);
    expect(size, message).toBeLessThan(baselineSize);
  });

  test('PMM-15355 - Verify mongodb_exporter uses at least 15% less memory after a client restart than it did in 3.10.0 on the same node', async ({}) => {
    test.setTimeout(10 * 60_000);

    await (await cli.exec(`docker exec ${containerName} cp -p ${exporterPath} ${currentExporterBackup}`)).assertSuccess();
    const currentRss = await settledExporterRss();

    await (await cli.exec(
      `docker exec ${containerName} sh -c 'systemctl stop pmm-agent && install -m 0755 ${baselineExporter} ${exporterPath}'`,
    )).assertSuccess();
    const baselineRss = await settledExporterRss();

    await restoreExporterUnderTest();

    const summary = `${mib(currentRss)} MiB, ${baselineVersion}: ${mib(baselineRss)} MiB`;
    console.log(`mongodb_exporter RSS: ${summary}`);
    test.info().annotations.push({ type: 'mongodb_exporter RSS', description: summary });
    expect(
      currentRss,
      `mongodb_exporter RSS is ${mib(currentRss)} MiB after a restart, ${baselineVersion}'s is ${mib(baselineRss)} MiB`,
    ).toBeLessThan(baselineRss * requiredMemoryRatio);
  });
});

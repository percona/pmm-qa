import { test, expect } from '@playwright/test';
import * as cli from '@helpers/cli-helper';

test.describe('Percona Server MongoDB (PSMDB) CLI tests', { tag: '@psmdb-shard' }, async () => {
  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps | grep rscfg01 | awk \'{print $NF}\'');
    await result.outContains('rscfg01', 'PSMDB rscfg01 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=shards');
    const result1 = await cli.exec('sudo pmm-admin status');
    await result1.outContains('Running', 'pmm-client is not installed/connected locally, please run pmm3-client-setup script');
  });

  test('@PMM-T1539 Verify that MongoDB exporter shows version for mongos instance', async ({}) => {
    const edition = 'Community';
    const containerName = (await cli.exec('docker ps --format "table {{.ID}}\\t{{.Image}}\\t{{.Names}}" | grep \'rscfg01\' | awk -F " " \'{print $3}\'')).getStdOutLines();
    const version = (await cli.exec(`docker exec ${containerName} mongod --version | awk 'NR==1 {print $3;exit}' | cut -c2-`)).getStdOutLines();
    const serviceId = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep "rscfg01" | awk -F " " '{print $4}'`)).getStdOutLines();
    const port = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep "mongodb_exporter.*${serviceId}" | awk -F " " '{print $6}'`)).getStdOutLines();
    const output = (await cli.exec(`docker exec ${containerName} curl --silent -u pmm:mypass localhost:${port}/metrics | grep -o "mongodb_version_info{.*}"`)).getStdOutLines();
    const actualExactVersion = output[0].match(/(?<=mongodb=").*?(?=")/);
    const actualEdition = output[0].match(/(?<=edition=").*?(?=")/);
    expect(actualExactVersion, `Scraped metrics must contain ${version[0]}!`).toContain(version[0]);
    expect(actualEdition, `Scraped metrics must contain ${edition}!`).toContain(edition);
  });

  //
  test.skip('PMM-T1853 Collect Data about Sharded collections in MongoDB', async ({}) => {
    const expectedValue = 'mongodb_shards_collection_chunks_count';
    await expect(async () => {
      const metrics = await cli.getMetrics('rs101', 'pmm', 'mypass', 'rs101');
      expect(metrics, `Scraped metrics must contain ${expectedValue}!`).toContain(expectedValue);
    }).toPass({
      intervals: [2_000],
      timeout: 60_000,
    });
  });
});

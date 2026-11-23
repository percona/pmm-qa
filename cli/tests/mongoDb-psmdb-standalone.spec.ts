import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import { expectMongoUp } from '@helpers/mongo';
import * as pbm from '@helpers/pbm';

const containerName = 'psmdb-standalone';

test.describe('Percona Server MongoDB (PSMDB) standalone without PBM CLI tests', { tag: '@standalone-psmdb' }, () => {
  test.use({ pmmClientContainer: containerName });

  test.beforeAll(async ({}) => {
    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'PSMDB standalone container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=standalone_no_pbm');
  });

  test('PMM-15232 - Verify a standalone without PBM serves only mongodb_pbm_cluster_backup_configured 0 and its exporter logs nothing about PBM', async ({}) => {
    await expectMongoUp(containerName, containerName, pbm.exporterPassword);

    const spawned = await pbm.spawnScrape(containerName, containerName, pbm.exporterPath, { scrapes: 3 });
    for (const scrape of spawned.scrapes) {
      expect(pbm.seriesTexts(pbm.parseSeries(scrape)), 'PBM series of a second exporter').toEqual(['mongodb_pbm_cluster_backup_configured 0']);
    }
    for (let i = 0; i < 3; i++) {
      expect(pbm.seriesTexts(await pbm.scrapePbm(containerName)), 'PBM series of the exporter pmm-agent runs').toEqual(['mongodb_pbm_cluster_backup_configured 0']);
    }

    expect(spawned.log, 'a second exporter logs about PBM').not.toMatch(/pbm/i);
    // With --client-debug pmm-agent also logs the messages of PMM Server, which ask for the PBM version and start the exporter with --collector.pbm.
    const logged = await cli.exec(`docker exec ${containerName} grep -iE 'collector=pbm|pbm_collector' ${pbm.agentLogPath}`);
    expect(logged.stdout.trim().split('\n').filter(Boolean).slice(0, 10), `first lines of the exporter in ${pbm.agentLogPath} that mention PBM`).toEqual([]);
  });
});

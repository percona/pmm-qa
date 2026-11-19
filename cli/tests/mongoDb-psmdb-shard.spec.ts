import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import { mongoEval } from '@helpers/mongo';
import * as pbm from '@helpers/pbm';

test.describe('Percona Server MongoDB (PSMDB) CLI tests', { tag: '@shard-psmdb' }, () => {
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

test.describe('Percona Server MongoDB (PSMDB) PBM metrics in a sharded cluster', { tag: '@pbm-metrics-shard' }, () => {
  test.use({ pmmClientContainer: 'rscfg01' });

  const pbmHost = 'rscfg01';
  const shards = { rs1: ['rs101', 'rs102', 'rs103'], rs2: ['rs201', 'rs202', 'rs203'] };
  const configServers = ['rscfg01', 'rscfg02', 'rscfg03'];
  const dataMembers = [...shards.rs1, ...shards.rs2, ...configServers];
  const agents = dataMembers;
  const views = [
    { name: 'mongos', container: 'mongos' },
    { name: 'a shard member', container: 'rs101' },
    { name: 'a config server member', container: 'rscfg01' },
  ];
  const rootUri = 'mongodb://root:root@127.0.0.1:27017/admin';
  const versionMetric = 'mongodb_pbm_agent_version_info';
  const recoveryPointMetric = 'mongodb_pbm_cluster_pitr_recovery_point_ts';
  const lastWriteMetric = 'mongodb_pbm_pitr_last_write_ts';
  const restoreStatusMetric = 'mongodb_pbm_restore_status';

  const everyView = async (check: (view: { name: string, container: string }) => Promise<void>) => {
    for (const view of views) {
      await check(view);
    }
  };

  const withoutVersions = (series: pbm.Series[]) => series.filter((item) => item.name !== versionMetric);

  test.beforeAll(async ({}) => {
    test.setTimeout(15 * 60_000);
    const result = await cli.exec(`docker ps | grep ${pbmHost} | awk '{print $NF}'`);
    await result.outContains(pbmHost, 'PSMDB rscfg01 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=sharding');
    await pbm.skipBelowClient(pbmHost, '3.11.0');
    await pbm.setAgents(agents, 'start');
    await pbm.expectAgentsOk(pbmHost);
    await pbm.takeBackup(pbmHost);
  });

  test('PMM-15232 - Verify the PBM metrics are the same through mongos, a shard member and a config server member, but for the agent versions', async ({}) => {
    test.setTimeout(10 * 60_000);

    await expect(async () => {
      const [reference, ...others] = await Promise.all(views.map(async (view) => pbm.seriesTexts(pbm.ignoreSelf(withoutVersions(await pbm.scrapePbm(view.container))))));

      expect(reference.filter((text) => text.startsWith('mongodb_pbm_agent_status')), 'agent status series through mongos').toHaveLength(agents.length);
      expect(reference.some((text) => text.startsWith('mongodb_pbm_backup_size_bytes')), 'backup series through mongos').toBeTruthy();
      for (const [index, series] of others.entries()) {
        expect(series, `PBM series through ${views[index + 1].name} and through ${views[0].name}`).toEqual(reference);
      }
    }).toPass({ intervals: [5_000], timeout: 180_000 });
  });

  test('PMM-15222 - Verify mongos lists the agent version of every member with self 0 while a member lists only its own', async ({}) => {
    const own: string[] = [];

    for (const member of dataMembers) {
      await expect(async () => {
        const versions = pbm.selectSeries(await pbm.scrapePbm(member), versionMetric);

        expect(versions.map((item) => item.labels.self), `${member}: agent version series`).toEqual(['1']);
        expect(versions[0].labels.host).toEqual(`${member}:27017`);
        own.push(...pbm.seriesTexts(pbm.ignoreSelf(versions)));
      }).toPass({ intervals: [5_000], timeout: 120_000 });
    }

    await expect(async () => {
      const versions = pbm.selectSeries(await pbm.scrapePbm('mongos'), versionMetric);

      expect(versions.map((item) => item.labels.self), 'self labels of the agent versions through mongos').toEqual(agents.map(() => '0'));
      expect(pbm.seriesTexts(pbm.ignoreSelf(versions)), 'agent versions through mongos').toEqual(own.sort());
    }).toPass({ intervals: [5_000], timeout: 120_000 });
  });

  test.describe('PITR', () => {
    test.describe.configure({ mode: 'serial' });

    const database = 'pbm_metrics_test';
    let oplogSpan: string;

    const lastWrites = async (container: string) => {
      const series = await pbm.scrapePbm(container);

      return {
        cluster: pbm.seriesValue(series, recoveryPointMetric),
        rs1: pbm.seriesValue(series, lastWriteMetric, { replica_set: 'rs1' }),
        rs2: pbm.seriesValue(series, lastWriteMetric, { replica_set: 'rs2' }),
        rscfg: pbm.seriesValue(series, lastWriteMetric, { replica_set: 'rscfg' }),
      };
    };

    test.beforeAll(async ({}) => {
      test.setTimeout(10 * 60_000);
      oplogSpan = await pbm.pbmConfigValue(pbmHost, 'pitr.oplogSpanMin');
      await (await cli.exec(mongoEval('mongos', rootUri, `sh.enableSharding("${database}"); sh.shardCollection("${database}.data", { _id: "hashed" })`))).assertSuccess();
      await (await pbm.pbm(pbmHost, 'config --set pitr.enabled=true --set pitr.oplogSpanMin=1')).assertSuccess();
      await pbm.startWriter('mongos', rootUri);
    });

    test.afterAll(async ({}) => {
      test.setTimeout(10 * 60_000);
      await pbm.setAgents(agents, 'start');
      await pbm.stopWriter('mongos');
      await pbm.pbm(pbmHost, `config --set pitr.enabled=false --set pitr.oplogSpanMin=${oplogSpan}`);
      await pbm.pbm(pbmHost, 'delete-pitr --all --force --wait');
      await cli.exec(mongoEval('mongos', rootUri, `db.getSiblingDB("${database}").dropDatabase()`));
    });

    test('PMM-15207 - Verify the cluster recovery point and the last write of every replica set are the same through mongos, a shard member and a config server member', async ({}) => {
      test.setTimeout(15 * 60_000);

      await everyView(async (view) => {
        await expect(async () => {
          const end = await pbm.pitrRangeEnd(pbmHost);
          const writes = await lastWrites(view.container);

          expect(end, 'pbm list shows no PITR range yet').toBeDefined();
          expect(writes.cluster, `${recoveryPointMetric} through ${view.name}`).toEqual(end);
          expect(Math.min(writes.rs1 ?? 0, writes.rs2 ?? 0, writes.rscfg ?? 0), `oldest ${lastWriteMetric} through ${view.name}`).toEqual(end);
        }).toPass({ intervals: [3_000], timeout: 8 * 60_000 });
      });
    });

    test('PMM-15207 - Verify the cluster recovery point stops at the last write of a shard whose pbm-agents are stopped while the other replica sets advance', async ({}) => {
      test.setTimeout(15 * 60_000);
      await pbm.setAgents(shards.rs2, 'stop');

      try {
        const stopped = (await lastWrites('mongos')).rs2 as number;

        await everyView(async (view) => {
          await expect(async () => {
            const writes = await lastWrites(view.container);

            expect(writes.rs2, `${lastWriteMetric} of the stopped shard through ${view.name}`).toEqual(stopped);
            expect(writes.rs1, `${lastWriteMetric} of rs1 through ${view.name}`).toBeGreaterThan(stopped);
            expect(writes.rscfg, `${lastWriteMetric} of rscfg through ${view.name}`).toBeGreaterThan(stopped);
            expect(writes.cluster, `${recoveryPointMetric} through ${view.name}`).toEqual(stopped);
          }).toPass({ intervals: [5_000], timeout: 6 * 60_000 });
        });
        // PBM can end the range one second before the chunk's last write.
        const end = await pbm.pitrRangeEnd(pbmHost);

        expect(end, 'end of the PITR range in pbm list').toBeGreaterThanOrEqual(stopped - 1);
        expect(end, 'end of the PITR range in pbm list').toBeLessThanOrEqual(stopped);
      } finally {
        await pbm.setAgents(shards.rs2, 'start');
      }
    });
  });

  test('PMM-15220 - Verify a logical restore shows 1 and then 3 through mongos, a shard member and a config server member', async ({}) => {
    test.setTimeout(20 * 60_000);
    await pbm.expectAgentsOk(pbmHost);
    const backup = await pbm.takeBackup(pbmHost);
    const seen = new Map<string, Set<number | undefined>>(views.map((view) => [view.name, new Set()]));
    let restore: pbm.StartedOperation | undefined;

    await expect(async () => {
      restore = await pbm.startOperation(pbmHost, `restore ${backup}`);
    }).toPass({ intervals: [3_000], timeout: 120_000 });
    const name = restore?.name ?? '';
    const finished = async () => (await pbm.describeRestore(pbmHost, name).catch(() => undefined))?.status === 'done';

    for (let attempt = 0; attempt < 300 && !(await finished()); attempt++) {
      for (const view of views) {
        seen.get(view.name)?.add(await pbm.scrapePbm(view.container).then((series) => pbm.seriesValue(series, restoreStatusMetric), () => undefined));
      }
    }
    for (const view of views) {
      expect(seen.get(view.name)?.has(1), `${restoreStatusMetric} seen through ${view.name} while the restore ran: ${[...(seen.get(view.name) ?? [])].join(', ')}`).toBeTruthy();
      await pbm.recoverExporter(view.container);
    }

    await everyView(async (view) => {
      await expect(async () => {
        const series = await pbm.scrapePbm(view.container);

        expect(pbm.seriesValue(series, restoreStatusMetric), `${restoreStatusMetric} through ${view.name}`).toEqual(3);
        expect(pbm.selectSeries(series, 'mongodb_pbm_restore_last_transition_ts', { name, backup, type: 'logical', status: 'done' }), `restore through ${view.name}`).toHaveLength(1);
      }).toPass({ intervals: [3_000], timeout: 180_000 });
    });
  });

  test('PMM-15232 - Verify the PBM metrics of shard members are the same as in 3.10.0 and the scrape succeeds with the config servers down', async ({}) => {
    test.setTimeout(15 * 60_000);
    await pbm.ensureBaselineExporter(['rs101', 'rs201']);

    try {
      for (const server of configServers) {
        await (await cli.exec(`docker exec ${server} systemctl stop mongod`)).assertSuccess();
      }

      for (const container of ['rs101', 'rs201']) {
        const baseline = await pbm.spawnScrape(container, container, pbm.baselineExporterPath);
        const current = await pbm.spawnScrape(container, container, pbm.exporterPath);

        for (const run of [baseline, current]) {
          expect(pbm.seriesValue(pbm.parseSeries(run.scrapes[0], 'mongodb_up'), 'mongodb_up'), `mongodb_up through ${container}`).toEqual(1);
          expect(run.log, `a log line of ${container}'s exporter contains the password`).not.toContain('pmmpass');
        }
        expect(pbm.seriesTexts(pbm.parseSeries(current.scrapes[0])), `PBM series through ${container}`).toEqual(pbm.seriesTexts(pbm.parseSeries(baseline.scrapes[0])));
      }
    } finally {
      for (const server of configServers) {
        await cli.exec(`docker exec ${server} systemctl start mongod`);
      }
      await expect(async () => {
        const hello = await cli.exec(`docker exec ${pbmHost} mongo "${rootUri}" --quiet --eval 'db.hello().isWritablePrimary || db.hello().secondary'`);

        expect(hello.stdout.trim()).toEqual('true');
      }).toPass({ intervals: [5_000], timeout: 180_000 });
      await pbm.expectAgentsOk(pbmHost);
    }
  });
});

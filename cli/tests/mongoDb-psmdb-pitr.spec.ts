import { setTimeout as sleep } from 'node:timers/promises';
import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import { runOnPrimary } from '@helpers/mongo';
import * as pbm from '@helpers/pbm';
import { mongoConnection } from '@helpers/constants';

const containerName = 'rs101';
const members = ['rs101', 'rs102', 'rs103'];
// The member PBM runs a backup on and the leader of the others is not fixed, so only the primary's pbm is used.
const pbmHost = 'rs101';
let bucket: string;

test.use({ pmmClientContainer: containerName });

test.beforeAll(async ({}) => {
  const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
  await result.outContains(containerName, 'PSMDB rs101 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=pss');
  await pbm.skipBelowClient(containerName, '3.11.0');
  bucket = await pbm.pbmConfigValue(pbmHost, 'storage.s3.bucket');
  await pbm.setExternalCron(pbmHost, 'stop');
});

test.afterAll(async ({}) => {
  await pbm.setExternalCron(pbmHost, 'start');
});

test.describe('Percona Server MongoDB (PSMDB) PBM PITR freshness metrics', { tag: ['@psmdb', '@pbm-external'] }, () => {
  const replsetName = 'rs';
  const recoveryPointMetric = 'mongodb_pbm_cluster_pitr_recovery_point_ts';
  const lastWriteMetric = 'mongodb_pbm_pitr_last_write_ts';
  const writerUri = `mongodb://${mongoConnection.username}:${mongoConnection.password}@rs101:27017/?replicaSet=rs`;
  let oplogSpan: string;
  let enabledAt: number;

  const recoveryPoint = async (member: string) => {
    const series = await pbm.scrapePbm(member);

    return {
      cluster: pbm.seriesValue(series, recoveryPointMetric),
      replset: pbm.seriesValue(series, lastWriteMetric, { replica_set: replsetName }),
    };
  };

  test.beforeAll(async ({}) => {
    test.setTimeout(10 * 60_000);
    await pbm.setAgents(members, 'start');
    await pbm.unpauseStorage();
    await pbm.fixStorage(pbmHost, bucket);
    await pbm.takeBackup(pbmHost);
    oplogSpan = await pbm.pbmConfigValue(pbmHost, 'pitr.oplogSpanMin');
    await pbm.pbm(pbmHost, 'delete-pitr --all --force --wait');
    enabledAt = Math.floor(Date.now() / 1000);
    await (await pbm.pbm(pbmHost, `config --set pitr.enabled=true --set pitr.oplogSpanMin=${pbm.pitrSpanSeconds / 60}`)).assertSuccess();
    await pbm.startWriter(pbmHost, writerUri);
  });

  test.afterAll(async ({}) => {
    test.setTimeout(10 * 60_000);
    await pbm.setAgents(members, 'start');
    await pbm.stopWriter(pbmHost);
    await pbm.pbm(pbmHost, `config --set pitr.enabled=false --set pitr.oplogSpanMin=${oplogSpan}`);
    await pbm.pbm(pbmHost, 'delete-pitr --all --force --wait');
    await runOnPrimary(pbmHost, pbm.mongoRootUri, 'db.getSiblingDB("pbm_metrics_test").dropDatabase()');
  });

  test('PMM-T2837 - Verify the PITR recovery point equals the end of the PITR range in pbm list and advances with each oplog chunk', async ({}) => {
    test.setTimeout(6 * 60_000);
    for (const member of members) {
      await expect(async () => {
        const end = await pbm.pitrRangeEnd(pbmHost);
        const metrics = await recoveryPoint(member);

        expect(end, 'pbm list shows no PITR range yet').toBeDefined();
        expect(metrics, `${recoveryPointMetric} and ${lastWriteMetric} on ${member}`).toEqual({ cluster: end, replset: end });
      }).toPass({ intervals: [3_000], timeout: 6 * 60_000 });
    }

    await expect(async () => {
      expect((await recoveryPoint(pbmHost)).cluster, 'recovery point of the PITR that was just enabled').toBeGreaterThan(enabledAt);
    }).toPass({ intervals: [3_000], timeout: 6 * 60_000 });

    const first = (await recoveryPoint(pbmHost)).cluster ?? 0;
    let next = first;

    await expect(async () => {
      next = (await recoveryPoint(pbmHost)).cluster ?? 0;
      expect(next).toBeGreaterThan(first);
    }).toPass({ intervals: [3_000], timeout: 150_000 });
    expect(next - first, `PITR recovery points ${first}, ${next}`).toBeGreaterThanOrEqual(pbm.pitrSpanSeconds / 2);
    expect(next - first, `PITR recovery points ${first}, ${next}`).toBeLessThanOrEqual(pbm.pitrSpanSeconds * 1.5);
  });

  test('PMM-T2838 - Verify the PITR metrics stop advancing without pbm-agents and catch up when they are started', async ({}) => {
    test.setTimeout(10 * 60_000);
    await pbm.setAgents(members, 'stop');

    try {
      const frozen = (await recoveryPoint(pbmHost)).cluster as number;
      const lagAtStart = Date.now() / 1000 - frozen;

      for (let waited = 0; waited < 2 * pbm.pitrSpanSeconds; waited += 5) {
        await sleep(5_000);
        expect(await recoveryPoint(pbmHost), 'PITR metrics move with every pbm-agent stopped').toEqual({ cluster: frozen, replset: frozen });
      }
      expect(Date.now() / 1000 - frozen, 'time() - recovery point grows').toBeGreaterThan(lagAtStart + pbm.pitrSpanSeconds);

      await pbm.setAgents(members, 'start');
      await expect(async () => {
        const end = await pbm.pitrRangeEnd(pbmHost);

        expect(end, 'PITR range end').toBeGreaterThan(frozen);
        expect(await recoveryPoint(pbmHost)).toEqual({ cluster: end, replset: end });
      }).toPass({ intervals: [5_000], timeout: 6 * 60_000 });
    } finally {
      await pbm.setAgents(members, 'start');
    }
  });

  test('PMM-T2839 - Verify the PITR recovery point pauses during a logical backup and continues afterwards', async ({}) => {
    test.setTimeout(10 * 60_000);
    await pbm.expectAgentsOk(pbmHost);

    const backup = await pbm.startOperation(pbmHost, 'backup');
    const during: (number | undefined)[] = [];
    await expect(async () => {
      during.push((await recoveryPoint(pbmHost)).cluster);
      expect(await pbm.backupStatus(pbmHost, backup), 'the backup is still running').toEqual('done');
    }).toPass({ intervals: [1_000], timeout: 5 * 60_000 });

    expect(new Set(during.slice(0, -1)).size, `recovery points while the backup ran: ${during.join(', ')}`).toBeLessThanOrEqual(1);
    const paused = during[0] as number;

    await expect(async () => {
      expect((await recoveryPoint(pbmHost)).cluster, 'recovery point after the backup').toBeGreaterThan(paused);
    }).toPass({ intervals: [5_000], timeout: 5 * 60_000 });
    await expect(async () => {
      const end = await pbm.pitrRangeEnd(pbmHost);

      expect(await recoveryPoint(pbmHost)).toEqual({ cluster: end, replset: end });
    }).toPass({ intervals: [3_000], timeout: 3 * 60_000 });
  });

  test('PMM-T2840 - Verify both PITR metrics disappear when PITR is disabled while pbm list still shows the chunks', async ({}) => {
    test.setTimeout(10 * 60_000);
    await (await pbm.pbm(pbmHost, 'config --set pitr.enabled=false')).assertSuccess();

    for (const member of members) {
      await expect(async () => {
        const series = await pbm.scrapePbm(member);

        expect(pbm.selectSeries(series, recoveryPointMetric), `${recoveryPointMetric} on ${member}`).toHaveLength(0);
        expect(pbm.selectSeries(series, lastWriteMetric), `${lastWriteMetric} on ${member}`).toHaveLength(0);
        expect(pbm.seriesValue(series, 'mongodb_pbm_cluster_pitr_backup_enabled')).toEqual(0);
      }).toPass({ intervals: [5_000], timeout: 120_000 });
    }
    expect(await pbm.pitrRangeEnd(pbmHost), 'pbm list still shows the PITR chunks').toBeDefined();
  });
});

test.describe('Percona Server MongoDB (PSMDB) PBM restore metrics', { tag: ['@psmdb', '@pbm-external'] }, () => {
  test.describe('restores', () => {
    test.describe.configure({ mode: 'serial' });

    const restoreStatusMetric = 'mongodb_pbm_restore_status';
    let backupName: string;

    const restoreSeries = (series: pbm.Series[], name?: string) => series.filter(
      (item) => item.name.startsWith('mongodb_pbm_restore_') && item.name !== restoreStatusMetric && (!name || item.labels.name === name),
    );

    // The exporter cannot scrape while a restore replaces the users it logs in as.
    const restoreStatus = async (member: string) => pbm.seriesValue(await pbm.scrapePbm(member), restoreStatusMetric);

    const expectRestoreStatusOnEveryMember = async (expected: number, timeout = 180_000) => {
      for (const member of members) {
        await expect(async () => {
          expect(await restoreStatus(member), `${restoreStatusMetric} on ${member}`).toEqual(expected);
        }).toPass({ intervals: [3_000], timeout });
      }
    };

    test.beforeAll(async ({}) => {
      test.setTimeout(10 * 60_000);
      await pbm.setAgents(members, 'start');
      await pbm.unpauseStorage();
      await pbm.removeStoredRestores(pbmHost, bucket);
      await pbm.fixStorage(pbmHost, bucket);
      backupName = await pbm.takeBackup(pbmHost);
    });

    test.afterAll(async ({}) => {
      test.setTimeout(10 * 60_000);
      await pbm.setAgents(members, 'start');
      for (const member of members) {
        await pbm.recoverExporter(member);
      }
    });

    test('PMM-T2841 - Verify restore_status is 0 and there are no restore series before any restore', async ({}) => {
      for (const member of members) {
        await expect(async () => {
          const series = await pbm.scrapePbm(member);

          expect(pbm.seriesValue(series, restoreStatusMetric), `${restoreStatusMetric} on ${member}`).toEqual(0);
          expect(pbm.seriesTexts(restoreSeries(series)), `restore series on ${member}`).toEqual([]);
        }).toPass({ intervals: [3_000], timeout: 120_000 });
      }
    });

    test('PMM-T2842 - Verify a logical restore shows 1 while it runs and 3 when it is done, with its labels and duration', async ({}) => {
      const restore = await pbm.startOperation(pbmHost, `restore ${backupName}`);
      const seen = new Set<number | undefined>();
      const finished = async () => (await pbm.describeRestore(pbmHost, restore).catch(() => undefined))?.status === 'done';

      for (let attempt = 0; attempt < 600 && !(await finished()); attempt++) {
        seen.add(await restoreStatus(members[attempt % members.length]).catch(() => undefined));
      }
      expect(seen.has(1), `${restoreStatusMetric} values seen while the restore ran: ${[...seen].join(', ')}`).toBeTruthy();

      for (const member of members) {
        await pbm.recoverExporter(member);
      }
      const info = await pbm.describeRestore(pbmHost, restore);
      const duration = (Date.parse(info.finish) - Date.parse(info.start)) / 1000;
      const labels = {
        name: restore,
        backup: backupName,
        type: 'logical',
        status: 'done',
      };

      for (const member of members) {
        await expect(async () => {
          const series = await pbm.scrapePbm(member);

          expect(pbm.seriesValue(series, restoreStatusMetric), `${restoreStatusMetric} on ${member}`).toEqual(3);
          expect(pbm.selectSeries(series, 'mongodb_pbm_restore_last_transition_ts', labels), `last transition of ${restore} on ${member}`).toHaveLength(1);
          const [seconds] = pbm.selectSeries(series, 'mongodb_pbm_restore_duration_seconds', labels);
          expect(seconds?.value, `duration of ${restore} on ${member}`).toBeGreaterThanOrEqual(duration - 1);
          expect(seconds?.value, `duration of ${restore} on ${member}`).toBeLessThanOrEqual(duration + 1);
        }).toPass({ intervals: [3_000], timeout: 120_000 });
      }
    });

    test('PMM-T2843 - Verify a restore interrupted by stopping every pbm-agent shows 2 before the agents are started', async ({}) => {
      try {
        const restore = await pbm.startOperation(pbmHost, `restore ${backupName}`);
        await pbm.setAgents(members, 'kill');

        await expectRestoreStatusOnEveryMember(2);
        expect((await pbm.describeRestore(pbmHost, restore)).status, 'the interrupted restore is not done').not.toEqual('done');
      } finally {
        await pbm.setAgents(members, 'start');
        await pbm.expectAgentsOk(pbmHost);
        for (const member of members) {
          await pbm.recoverExporter(member);
        }
      }
    });

    test('PMM-T2844 - Verify a restore PBM reports as failed shows 2 and status error', async ({}) => {
      test.setTimeout(15 * 60_000);
      const prefix = await pbm.pbmConfigValue(pbmHost, 'storage.s3.prefix');
      const backupDir = `/backups/${bucket}/${prefix}/${backupName}/rs`;
      const files = (await cli.exec(`docker exec minio ls ${backupDir}`)).getStdOutLines();
      const dataFile = files.find((file) => file.endsWith('.s2') && !file.startsWith('admin.'));
      expect(dataFile, `no collection file of ${backupName} in ${files.join(', ')}`).toBeTruthy();

      let restore = '';
      try {
        await (await cli.exec(`docker exec minio mv ${backupDir}/${dataFile} ${backupDir}/${dataFile}.moved`)).assertSuccess();
        restore = await pbm.startOperation(pbmHost, `restore ${backupName}`);
        await pbm.expectRestoreStatus(pbmHost, restore, 'error');
      } finally {
        await cli.exec(`docker exec minio mv ${backupDir}/${dataFile}.moved ${backupDir}/${dataFile}`);
        for (const member of members) {
          await pbm.recoverExporter(member);
        }
      }

      const labels = {
        name: restore,
        backup: backupName,
        type: 'logical',
        status: 'error',
      };

      for (const member of members) {
        await expect(async () => {
          const series = await pbm.scrapePbm(member);

          expect(pbm.seriesValue(series, restoreStatusMetric), `${restoreStatusMetric} on ${member}`).toEqual(2);
          expect(pbm.selectSeries(series, 'mongodb_pbm_restore_last_transition_ts', labels), `failed restore on ${member}`).toHaveLength(1);
        }).toPass({ intervals: [3_000], timeout: 120_000 });
      }
    });

    test('PMM-T2845 - Verify only the 10 most recent restores have series after 11 restores and the status follows the latest', async ({}) => {
      test.setTimeout(30 * 60_000);
      const names: string[] = [];

      for (let i = 0; i < 11; i++) {
        const restore = await pbm.startOperation(pbmHost, `restore ${backupName}`);
        names.push(restore);
        await pbm.expectRestoreStatus(pbmHost, restore, 'done');
      }
      for (const member of members) {
        await pbm.recoverExporter(member);
      }

      for (const member of members) {
        await expect(async () => {
          const series = await pbm.scrapePbm(member);
          const listed = pbm
            .selectSeries(series, 'mongodb_pbm_restore_last_transition_ts')
            .map((item) => item.labels.name)
            .sort();

          expect(listed, `restores with series on ${member}`).toEqual(names.slice(1).sort());
          expect(pbm.selectSeries(series, 'mongodb_pbm_restore_duration_seconds'), `restore durations on ${member}`).toHaveLength(10);
          expect(pbm.seriesValue(series, restoreStatusMetric), `${restoreStatusMetric} on ${member}`).toEqual(3);
        }).toPass({ intervals: [3_000], timeout: 120_000 });
      }
    });

    test('PMM-T2846 - Verify a physical restore appears only after a resync of the PBM configuration', async ({}) => {
      test.skip(await pbm.isExternalPbm(), 'A physical restore needs the pbm-agent beside mongod, and an external PBM runs it elsewhere');
      test.setTimeout(40 * 60_000);
      const physicalBackup = await pbm.takeBackup(pbmHost, 'physical');
      const restore = await pbm.startOperation(pbmHost, `restore ${physicalBackup}`);

      try {
        // A physical restore ends every pbm-agent and leaves mongod stopped.
        for (const member of members) {
          await expect(async () => {
            const state = await cli.exec(`docker exec ${member} systemctl is-active pbm-agent`);

            expect(state.stdout.trim(), `pbm-agent on ${member}`).toEqual('inactive');
          }).toPass({ intervals: [10_000], timeout: 10 * 60_000 });
        }
        for (const member of members) {
          await (await cli.exec(`docker exec ${member} systemctl start mongod`)).assertSuccess();
        }
        await runOnPrimary(pbmHost, pbm.mongoRootUri, 'db.hello().isWritablePrimary');
        await pbm.setAgents(members, 'start');
        await pbm.expectAgentsOk(pbmHost);

        for (const member of members) {
          await expect(async () => {
            const series = await pbm.scrapePbm(member);

            expect(pbm.seriesValue(series, restoreStatusMetric), `${restoreStatusMetric} on ${member} before the resync`).toEqual(0);
            expect(pbm.seriesTexts(restoreSeries(series, restore)), `series of the physical restore on ${member} before the resync`).toEqual([]);
          }).toPass({ intervals: [3_000], timeout: 120_000 });
        }

        await pbm.resync(pbmHost);
        const info = await pbm.describeRestore(pbmHost, restore);
        const restoreLogs = await pbm.pbm(pbmHost, 'logs --event=restore --tail=40');

        expect(info.status, `PBM status of the physical restore ${restore}\n${restoreLogs.stdout}`).toEqual('done');

        const duration = (Date.parse(info.finish) - Date.parse(info.start)) / 1000;

        for (const member of members) {
          await expect(async () => {
            const series = await pbm.scrapePbm(member);
            const labels = {
              name: restore,
              backup: physicalBackup,
              type: 'physical',
              status: 'done',
            };

            expect(pbm.seriesValue(series, restoreStatusMetric), `${restoreStatusMetric} on ${member} after the resync`).toEqual(3);
            expect(pbm.selectSeries(series, 'mongodb_pbm_restore_last_transition_ts', labels), `physical restore on ${member}`).toHaveLength(1);
            const [seconds] = pbm.selectSeries(series, 'mongodb_pbm_restore_duration_seconds', labels);
            expect(seconds?.value, `duration of the physical restore on ${member}`).toBeGreaterThanOrEqual(duration - 1);
          }).toPass({ intervals: [3_000], timeout: 120_000 });
        }
      } finally {
        await pbm.setAgents(members, 'start');
        await pbm.removeStoredRestores(pbmHost, bucket);
        await pbm.resync(pbmHost);
      }
    });
  });
});

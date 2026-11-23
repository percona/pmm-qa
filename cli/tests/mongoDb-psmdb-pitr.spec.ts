import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import { runOnPrimary } from '@helpers/mongo';
import * as pbm from '@helpers/pbm';
import { mongoConnection } from '@helpers/constants';

const containerName = 'rs101';

test.describe(
  'Percona Server MongoDB (PSMDB) PBM PITR freshness metrics',
  { tag: '@psmdb' },
  () => {
    test.use({ pmmClientContainer: containerName });

    const members = ['rs101', 'rs102', 'rs103'];
    const replsetName = 'rs';
    let bucket: string;

    const everyMember = async (check: (member: string) => Promise<void>) => {
      for (const member of members) {
        await check(member);
      }
    };

    // The member PBM runs a backup on and the leader of the others is not fixed, so only the primary's pbm is used.
    const pbmHost = 'rs101';

    test.beforeAll(async ({}) => {
      const result = await cli.exec(
        `docker ps | grep ${containerName} | awk '{print $NF}'`,
      );
      await result.outContains(
        containerName,
        'PSMDB rs101 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=pss',
      );
      await pbm.skipBelowClient(containerName, '3.11.0');
      bucket = await pbm.pbmStorageBucket(pbmHost);
    });

    test.describe('PITR freshness', () => {
      test.describe.configure({ mode: 'serial' });

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
        await (
          await pbm.pbm(
            pbmHost,
            'config --set pitr.enabled=true --set pitr.oplogSpanMin=1',
          )
        ).assertSuccess();
        await pbm.startWriter(pbmHost, writerUri);
      });

      test.afterAll(async ({}) => {
        test.setTimeout(10 * 60_000);
        await pbm.setAgents(members, 'start');
        await pbm.stopWriter(pbmHost);
        await pbm.pbm(
          pbmHost,
          `config --set pitr.enabled=false --set pitr.oplogSpanMin=${oplogSpan}`,
        );
        await pbm.pbm(pbmHost, 'delete-pitr --all --force --wait');
        await runOnPrimary(
          pbmHost,
          pbm.mongoRootUri,
          'db.getSiblingDB("pbm_metrics_test").dropDatabase()',
        );
      });

      test('PMM-15207 - Verify the PITR recovery point equals the end of the PITR range in pbm list and advances once a minute', async ({}) => {
        test.setTimeout(15 * 60_000);

        await everyMember(async (member) => {
          await expect(async () => {
            const end = await pbm.pitrRangeEnd(pbmHost);
            const metrics = await recoveryPoint(member);

            expect(end, 'pbm list shows no PITR range yet').toBeDefined();
            expect(
              metrics,
              `${recoveryPointMetric} and ${lastWriteMetric} on ${member}`,
            ).toEqual({ cluster: end, replset: end });
          }).toPass({ intervals: [3_000], timeout: 6 * 60_000 });
        });

        await expect(async () => {
          expect(
            (await recoveryPoint(pbmHost)).cluster,
            'recovery point of the PITR that was just enabled',
          ).toBeGreaterThan(enabledAt);
        }).toPass({ intervals: [3_000], timeout: 6 * 60_000 });

        const advances: number[] = [
          (await recoveryPoint(pbmHost)).cluster ?? 0,
        ];
        while (advances.length < 3) {
          await expect(async () => {
            expect((await recoveryPoint(pbmHost)).cluster).toBeGreaterThan(
              advances[advances.length - 1],
            );
          }).toPass({ intervals: [3_000], timeout: 150_000 });
          advances.push((await recoveryPoint(pbmHost)).cluster ?? 0);
        }

        for (const [first, second] of [
          [advances[0], advances[1]],
          [advances[1], advances[2]],
        ]) {
          expect(
            second - first,
            `PITR recovery points ${advances.join(', ')}`,
          ).toBeGreaterThanOrEqual(30);
          expect(
            second - first,
            `PITR recovery points ${advances.join(', ')}`,
          ).toBeLessThanOrEqual(90);
        }
      });

      test('PMM-15207 - Verify the PITR metrics stop advancing without pbm-agents and catch up when they are started', async ({}) => {
        test.setTimeout(15 * 60_000);
        await pbm.setAgents(members, 'stop');

        try {
          const frozen = (await recoveryPoint(pbmHost)).cluster as number;
          const lagAtStart = Date.now() / 1000 - frozen;

          for (let i = 0; i < 9; i++) {
            await pbm.sleep(10_000);
            expect(
              await recoveryPoint(pbmHost),
              'PITR metrics move with every pbm-agent stopped',
            ).toEqual({ cluster: frozen, replset: frozen });
          }
          expect(
            Date.now() / 1000 - frozen,
            'time() - recovery point grows',
          ).toBeGreaterThan(lagAtStart + 60);

          await pbm.setAgents(members, 'start');
          await expect(async () => {
            const end = await pbm.pitrRangeEnd(pbmHost);

            expect(end, 'PITR range end').toBeGreaterThan(frozen);
            expect(await recoveryPoint(pbmHost)).toEqual({
              cluster: end,
              replset: end,
            });
          }).toPass({ intervals: [5_000], timeout: 6 * 60_000 });
        } finally {
          await pbm.setAgents(members, 'start');
        }
      });

      test('PMM-15207 - Verify the PITR recovery point pauses during a logical backup and continues afterwards', async ({}) => {
        test.setTimeout(15 * 60_000);
        await pbm.expectAgentsOk(pbmHost);

        const backup = await pbm.startOperation(pbmHost, 'backup');
        const during: (number | undefined)[] = [];
        await expect(async () => {
          during.push((await recoveryPoint(pbmHost)).cluster);
          expect(
            await pbm.backupStatus(pbmHost, backup.name),
            'the backup is still running',
          ).toEqual('done');
        }).toPass({ intervals: [1_000], timeout: 5 * 60_000 });

        expect(
          new Set(during.slice(0, -1)).size,
          `recovery points while the backup ran: ${during.join(', ')}`,
        ).toBeLessThanOrEqual(1);
        const paused = during[0] as number;

        await expect(async () => {
          expect(
            (await recoveryPoint(pbmHost)).cluster,
            'recovery point after the backup',
          ).toBeGreaterThan(paused);
        }).toPass({ intervals: [5_000], timeout: 5 * 60_000 });
        await expect(async () => {
          const end = await pbm.pitrRangeEnd(pbmHost);

          expect(await recoveryPoint(pbmHost)).toEqual({
            cluster: end,
            replset: end,
          });
        }).toPass({ intervals: [3_000], timeout: 3 * 60_000 });
      });

      test('PMM-15207 - Verify both PITR metrics disappear when PITR is disabled while pbm list still shows the chunks', async ({}) => {
        test.setTimeout(10 * 60_000);
        await (
          await pbm.pbm(pbmHost, 'config --set pitr.enabled=false')
        ).assertSuccess();

        await everyMember(async (member) => {
          await expect(async () => {
            const series = await pbm.scrapePbm(member);

            expect(
              pbm.selectSeries(series, recoveryPointMetric),
              `${recoveryPointMetric} on ${member}`,
            ).toHaveLength(0);
            expect(
              pbm.selectSeries(series, lastWriteMetric),
              `${lastWriteMetric} on ${member}`,
            ).toHaveLength(0);
            expect(
              pbm.seriesValue(
                series,
                'mongodb_pbm_cluster_pitr_backup_enabled',
              ),
            ).toEqual(0);
          }).toPass({ intervals: [5_000], timeout: 120_000 });
        });
        expect(
          await pbm.pitrRangeEnd(pbmHost),
          'pbm list still shows the PITR chunks',
        ).toBeDefined();
      });
    });
  },
);

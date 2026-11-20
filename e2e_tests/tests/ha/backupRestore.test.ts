import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { RestoreMarkers } from '@helpers/haBackup.helper';

const run = Date.now();
const backupJob = `pmm-e2e-backup-${run}`;
const restoreJob = `pmm-e2e-restore-${run}`;
const refusedRestoreJob = `pmm-e2e-refused-restore-${run}`;
let markers: RestoreMarkers | undefined;
let stoppedClickHouse: string | undefined;

// A failed restore can leave the cluster half down, and two ~20 minute retries
// would spend the whole run's globalTimeout on it.
pmmTest.describe.configure({ retries: 0 });

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest.afterEach(
  async ({ api, haBackupHelper, haClickHouseHelper, haClusterHelper, k8sHelper }, testInfo) => {
    // The Jobs take their pods' logs with them when deleted.
    for (const job of [backupJob, refusedRestoreJob, restoreJob]) {
      const logs = haBackupHelper.jobLogs(job);

      if (logs) await testInfo.attach(`${job}.log`, { body: logs, contentType: 'text/plain' });
    }

    k8sHelper.exec(`delete job ${backupJob} ${refusedRestoreJob} ${restoreJob} --ignore-not-found`);

    if (stoppedClickHouse) await haClickHouseHelper.startServer(stoppedClickHouse);

    stoppedClickHouse = undefined;
    await haClusterHelper.ensureServing(api.haApi);
    await markers?.remove();
  },
);

pmmTest(
  'PMM-T2377 + PMM-T2775 - Verify an in-place restore brings back PostgreSQL, ClickHouse, VictoriaMetrics, /srv and the monitored services as backed up, with one QAN database on every ClickHouse server @ha-backup-restore',
  async ({ api, haBackupHelper, haClickHouseHelper, haClusterHelper }) => {
    pmmTest.setTimeout(Timeouts.SIXTY_MINUTES);

    const podNames = haClusterHelper.podNames();
    const clickHousePods = haClickHouseHelper.pods();
    const [serverZero, serverOne, serverTwo] = clickHousePods;
    const sharedUuid = await haClickHouseHelper.waitForOnePmm(clickHousePods);
    const restoreMarkers = new RestoreMarkers(api, haBackupHelper, podNames, run);
    const previousLatest = haBackupHelper.listBackups().find((backup) => backup.latest)?.id;
    let monitoredServices: string[] = [];

    markers = restoreMarkers;

    await pmmTest.step('Write a marker into PostgreSQL, ClickHouse, VictoriaMetrics and /srv', async () => {
      restoreMarkers.createTable();
      await restoreMarkers.write('before');
    });

    await pmmTest.step('Capture the services running and reporting before the backup', async () => {
      monitoredServices = await haClusterHelper.waitForRunningServicesReporting(
        api,
        (await api.prometheusApi.waitForServerTime()) - 120,
      );
    });

    const backupId = await pmmTest.step('Back up with a Job cloned from the backup CronJob', async () => {
      const mostRows = Math.max(...haClickHouseHelper.pmmCopies(clickHousePods).map((copy) => copy.rows));

      await haBackupHelper.runBackupJob(backupJob);

      const [, pod, rows] =
        /\[ClickHouse\] Using pod: (\S+) \((\d+) rows in pmm\.metrics\)/.exec(
          haBackupHelper.jobLogs(backupJob),
        ) ?? [];

      expect(clickHousePods, 'The backup must name the ClickHouse pod it used').toContain(pod);
      expect(
        Number(rows),
        'The backup must use the ClickHouse server with the most QAN rows',
      ).toBeGreaterThanOrEqual(mostRows);

      const latest = haBackupHelper.latestBackup();

      expect(latest.id, 'A complete backup must move the latest pointer').not.toEqual(previousLatest);
      expect(latest.status).toEqual('complete');
      expect([...latest.components].sort()).toEqual([
        'clickhouse',
        'encryption',
        'pmm-server',
        'postgresql',
        'victoriametrics',
      ]);

      return latest.id;
    });

    await pmmTest.step(
      'Verify a restore is refused before PMM stops while a ClickHouse server is down',
      async () => {
        stoppedClickHouse = serverTwo;
        await haClickHouseHelper.stopServer(serverTwo);

        await haBackupHelper.runRestoreJob(refusedRestoreJob, backupId, 'Failed');
        expect(haBackupHelper.jobLogs(refusedRestoreJob)).toContain(
          '[Preflight] clickhouse: 2 of 3 ClickHouse pods answer; the restore needs all of them',
        );
        await haClusterHelper.verifyHaEnabled(api.haApi);
        expect(haClickHouseHelper.pmmCopies([serverZero, serverOne]).map((copy) => copy.uuid)).toEqual([
          sharedUuid,
          sharedUuid,
        ]);

        await haClickHouseHelper.startServer(serverTwo);
        stoppedClickHouse = undefined;
      },
    );

    await pmmTest.step('Write a second marker that the backup does not hold', async () => {
      await restoreMarkers.write('after');
      expect(await restoreMarkers.found()).toEqual(restoreMarkers.everywhere(['before', 'after']));
    });

    // Server 0 keeps its copy: the markers are read there.
    await pmmTest.step('Split the QAN database: a stray copy on one server, none on another', async () => {
      haClickHouseHelper.createStrayPmm(serverTwo);
      haClickHouseHelper.dropPmm(serverOne);
    });

    await pmmTest.step(`Restore ${backupId} in place with a Job`, async () => {
      await haBackupHelper.runRestoreJob(restoreJob, backupId);
    });

    await pmmTest.step(
      'Verify the restore recreated one QAN database on every ClickHouse server',
      async () => {
        const lines = haBackupHelper
          .jobLogs(restoreJob)
          .split('\n')
          .filter((line) => line.includes('[ClickHouse]'));
        const at = (pattern: RegExp) => lines.findIndex((line) => pattern.test(line));
        const [, restoredUuid] = /Recreated pmm with UUID (\S+) on every pod/.exec(lines.join('\n')) ?? [];
        const order = [
          /\] (download|untar) /,
          /Recreated pmm with UUID/,
          /restore --rm /,
          /Restore complete/,
        ].map(at);

        expect(order, `Every ClickHouse restore stage must be logged:\n${lines.join('\n')}`).not.toContain(
          -1,
        );
        expect(order, `Stage, recreate, restore, in order:\n${lines.join('\n')}`).toEqual(
          [...order].sort((a, b) => a - b),
        );
        expect(await haClickHouseHelper.waitForOnePmm(clickHousePods, Timeouts.FIVE_MINUTES)).toEqual(
          restoredUuid,
        );
      },
    );

    await pmmTest.step('Verify the cluster serves again with every pod and one leader', async () => {
      await haClusterHelper.ensureServing(api.haApi);
      await haClusterHelper.verifyHaEnabled(api.haApi);
      await haClusterHelper.verifySingleLeader(api.haApi, podNames);
    });

    await pmmTest.step('Verify every component holds the first marker and not the second', async () => {
      await expect(async () => {
        expect(await restoreMarkers.found()).toEqual(restoreMarkers.everywhere(['before']));
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });

    await pmmTest.step(
      `Verify the ${monitoredServices.length} services that ran before the backup run and report again`,
      async () => {
        const restoredAt = await api.prometheusApi.waitForServerTime();

        await expect(async () => {
          const restored = await haClusterHelper.servicesRunningAndReporting(api, restoredAt);

          expect(monitoredServices.filter((serviceName) => !restored.includes(serviceName))).toEqual([]);
        }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      },
    );
  },
);

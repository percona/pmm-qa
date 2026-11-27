import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { RestoreMarkers } from '@helpers/haBackup.helper';
import { pmmDbCreated } from '@helpers/haClickHouse.helper';

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
    // A failed step can leave the QAN database split; the restart repairs it now instead of within 10 minutes.
    haClickHouseHelper.restartQanApi(haClusterHelper.leaderFromPods());

    const clickHousePods = haClickHouseHelper.pods();

    expect(clickHousePods, 'PMM HA runs three ClickHouse servers').toHaveLength(3);
    await haClickHouseHelper.waitForOnePmm(clickHousePods, Timeouts.FIVE_MINUTES);
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

    const leader = haClusterHelper.leaderFromPods();

    // The backup takes the first pod on a tie, so server 0 loses its copy to tell "most rows" from "first".
    await pmmTest.step('Drop the QAN database on server 0 right after a leader check', async () => {
      const since = haClickHouseHelper.podTime(leader);

      haClickHouseHelper.dropPmm(serverZero);
      haClickHouseHelper.restartQanApi(leader);
      await expect
        .poll(() => haClickHouseHelper.pmmDbLogged(leader, since, pmmDbCreated), {
          message: `The leader must log "${pmmDbCreated}"`,
          timeout: Timeouts.TWO_MINUTES,
        })
        .toBe(true);
      // The leader's next check is 10 minutes out now, after the backup has picked its pod.
      haClickHouseHelper.dropPmm(serverZero);
    });

    const backupId = await pmmTest.step('Back up with a Job cloned from the backup CronJob', async () => {
      const mostRows = Math.max(...haClickHouseHelper.pmmCopies(clickHousePods).map((copy) => copy.rows));

      await haBackupHelper.runBackupJob(backupJob);

      const [, pod, rows] =
        /\[ClickHouse\] Using pod: (\S+) \((\d+) rows in pmm\.metrics\)/.exec(
          haBackupHelper.jobLogs(backupJob),
        ) ?? [];

      expect([serverOne, serverTwo], 'The backup must skip the server without QAN data').toContain(pod);
      expect(
        Number(rows),
        'The backup must use a ClickHouse server with at least the most QAN rows any server held before it',
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

    await pmmTest.step('Verify server 0 gets the QAN database and the marker back', async () => {
      haClickHouseHelper.restartQanApi(leader);
      expect(await haClickHouseHelper.waitForOnePmm(clickHousePods)).toEqual(sharedUuid);
      await expect(async () => {
        expect(await restoreMarkers.found()).toEqual(restoreMarkers.everywhere(['before']));
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
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
        const { lines, order } = haBackupHelper.clickHouseRestoreStages(restoreJob, [
          /\] (download|untar) /,
          /Recreated pmm with UUID/,
          /restore --rm /,
          /Restore complete/,
        ]);
        const [, restoredUuid] = /Recreated pmm with UUID (\S+) on every pod/.exec(lines.join('\n')) ?? [];

        expect(order, `Every ClickHouse restore stage must be logged:\n${lines.join('\n')}`).not.toContain(
          -1,
        );
        expect(order, `Stage, recreate, restore, in order:\n${lines.join('\n')}`).toEqual(
          [...order].sort((a, b) => a - b),
        );
        expect(await haClickHouseHelper.waitForOnePmm(clickHousePods, Timeouts.FIVE_MINUTES)).toEqual(
          restoredUuid,
        );

        const before = new Date(Date.now() - Timeouts.FIVE_MINUTES);

        await expect(async () => {
          const rows = haClickHouseHelper.syncedRowsBefore(clickHousePods, before);

          expect(
            new Set(rows).size,
            `Rows before ${before.toISOString()} per server: ${rows.join(', ')}`,
          ).toEqual(1);
        }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
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

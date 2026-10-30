import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { RestoreMarkers } from '@helpers/haBackup.helper';

const run = Date.now();
const backupJob = `pmm-e2e-backup-${run}`;
const restoreJob = `pmm-e2e-restore-${run}`;
let markers: RestoreMarkers | undefined;

// A failed restore can leave the cluster half down, and two ~20 minute retries
// would spend the whole run's globalTimeout on it.
pmmTest.describe.configure({ retries: 0 });

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest.afterEach(async ({ api, haBackupHelper, haClusterHelper, k8sHelper }, testInfo) => {
  // The Jobs take their pods' logs with them when deleted.
  for (const job of [backupJob, restoreJob]) {
    const logs = haBackupHelper.jobLogs(job);

    if (logs) await testInfo.attach(`${job}.log`, { body: logs, contentType: 'text/plain' });
  }

  k8sHelper.exec(`delete job ${backupJob} ${restoreJob} --ignore-not-found`);
  await haClusterHelper.ensureServing(api.haApi);
  await markers?.remove();
});

pmmTest(
  'PMM-T2377 - Verify an in-place restore brings back PostgreSQL, ClickHouse, VictoriaMetrics, /srv and the monitored services as backed up @ha-backup-restore',
  async ({ api, haBackupHelper, haClusterHelper }) => {
    pmmTest.setTimeout(Timeouts.SIXTY_MINUTES);

    const podNames = haClusterHelper.podNames();
    const restoreMarkers = new RestoreMarkers(api, haBackupHelper, podNames, run);
    const previousLatest = haBackupHelper.listBackups().find((backup) => backup.latest)?.id;
    let monitoredServices: string[] = [];

    markers = restoreMarkers;

    await pmmTest.step('Write a marker into PostgreSQL, ClickHouse, VictoriaMetrics and /srv', async () => {
      restoreMarkers.createTable();
      await restoreMarkers.write('before');
    });

    await pmmTest.step('Capture the services running and reporting before the backup', async () => {
      monitoredServices = await haClusterHelper.servicesRunningAndReporting(
        api,
        (await api.prometheusApi.waitForServerTime()) - 120,
      );

      expect(monitoredServices.length, 'At least one service must be monitored').toBeGreaterThan(0);
    });

    const backupId = await pmmTest.step('Back up with a Job cloned from the backup CronJob', async () => {
      await haBackupHelper.runBackupJob(backupJob);

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

    await pmmTest.step('Write a second marker that the backup does not hold', async () => {
      await restoreMarkers.write('after');
      expect(await restoreMarkers.found()).toEqual(restoreMarkers.everywhere(['before', 'after']));
    });

    await pmmTest.step(`Restore ${backupId} in place with a Job`, async () => {
      await haBackupHelper.runRestoreJob(restoreJob, backupId);
    });

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

import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { AgentStatus } from '@interfaces/inventory';

const run = Date.now();
const phases = ['before', 'after'];
const marker = (phase: string): string => `pmm-e2e-${phase}-backup-${run}`;
const present = (found: string[]): string[] => phases.filter((phase) => found.includes(marker(phase)));
const metric = 'pmm_e2e_backup_marker';
// In PMM's own Replicated database, so the marker takes the restore path QAN data takes.
const clickHouseTable = `pmm.pmm_e2e_backup_${run}`;
const backupJob = `pmm-e2e-backup-${run}`;
const restoreJob = `pmm-e2e-restore-${run}`;

// A failed restore can leave the cluster half down, and two ~20 minute retries
// would spend the whole run's globalTimeout on it.
pmmTest.describe.configure({ retries: 0 });

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest.afterEach(async ({ api, haBackupHelper, haClusterHelper, k8sHelper }) => {
  await haClusterHelper.ensureServing(api.haApi);

  for (const folder of await api.grafanaApi.getFolders()) {
    if (present([folder.title]).length) await api.grafanaApi.deleteFolder(folder.uid);
  }

  for (const podName of haClusterHelper.podNames()) {
    k8sHelper.execInPod(podName, `rm -f ${phases.map((phase) => `/srv/${marker(phase)}`).join(' ')}`, {
      silent: true,
    });
  }

  haBackupHelper.clickHouseQuery(`DROP TABLE IF EXISTS ${clickHouseTable} SYNC`);
  k8sHelper.exec(`delete job ${backupJob} ${restoreJob} --ignore-not-found`);
});

pmmTest(
  'PMM-T2377 - Verify an in-place restore brings back PostgreSQL, ClickHouse, VictoriaMetrics, /srv and the monitored services as backed up @ha-backup-restore',
  async ({ api, haBackupHelper, haClusterHelper }) => {
    pmmTest.setTimeout(Timeouts.SIXTY_MINUTES);

    const podNames = haClusterHelper.podNames();
    const markersFound = async (): Promise<Record<string, string[]>> => ({
      clickhouse: present(
        haBackupHelper.clickHouseQuery(`SELECT marker FROM ${clickHouseTable}`).split('\n'),
      ),
      postgresql: present((await api.grafanaApi.getFolders()).map((folder) => folder.title)),
      ...Object.fromEntries(
        podNames.map((podName) => [`srv on ${podName}`, present(haBackupHelper.srvFiles(podName))]),
      ),
      victoriametrics: present(
        (
          await api.prometheusApi.instantQuery(`last_over_time(${metric}{run="${run}"}[1h])`, {
            nocache: '1',
          })
        ).map((sample) => sample.metric.marker),
      ),
    });
    const everywhere = (expected: string[]): Record<string, string[]> => ({
      clickhouse: expected,
      postgresql: expected,
      ...Object.fromEntries(podNames.map((podName) => [`srv on ${podName}`, expected])),
      victoriametrics: expected,
    });

    const runningAndReporting = async (since: number): Promise<string[]> => {
      const running = (await api.inventoryApi.getServices()).services
        .filter((service) => {
          const agents = service.agents.filter((agent) => agent.agent_type !== 'pmm-agent');

          return agents.length > 0 && agents.every((agent) => agent.status === AgentStatus.running);
        })
        .map((service) => service.service_name);
      const reporting = (
        await api.prometheusApi.instantQuery('max by (service_name) (timestamp(up{service_name!=""}))', {
          nocache: '1',
        })
      )
        .filter((sample) => Number(sample.value[1]) > since)
        .map((sample) => sample.metric.service_name);

      return running.filter((serviceName) => reporting.includes(serviceName)).sort();
    };

    const writeMarkers = async (phase: string): Promise<void> => {
      await api.grafanaApi.createFolder(marker(phase));
      haBackupHelper.clickHouseQuery(`INSERT INTO ${clickHouseTable} VALUES ('${marker(phase)}')`);
      haBackupHelper.importMetric(podNames[0], `${metric}{run="${run}",marker="${marker(phase)}"} 1`);

      for (const podName of podNames) haBackupHelper.touchSrvFile(podName, marker(phase));

      await expect
        .poll(async () => (await markersFound()).victoriametrics, { timeout: Timeouts.TWO_MINUTES })
        .toContain(phase);
    };

    const previousLatest = haBackupHelper.listBackups().find((backup) => backup.latest)?.id;
    let monitoredServices: string[] = [];

    await pmmTest.step('Write a marker into PostgreSQL, ClickHouse, VictoriaMetrics and /srv', async () => {
      haBackupHelper.clickHouseQuery(
        `CREATE TABLE ${clickHouseTable} (marker String) ENGINE = ReplicatedMergeTree ORDER BY marker`,
      );
      await writeMarkers('before');
    });

    await pmmTest.step('Capture the services running and reporting before the backup', async () => {
      monitoredServices = await runningAndReporting((await api.prometheusApi.waitForServerTime()) - 120);

      expect(monitoredServices.length, 'At least one service must be monitored').toBeGreaterThan(0);
    });

    const backupId = await pmmTest.step('Back up with a Job cloned from the backup CronJob', async () => {
      await haBackupHelper.runBackupJob(backupJob);

      const latest = haBackupHelper.listBackups().find((backup) => backup.latest);

      expect(latest?.id, 'A complete backup must move the latest pointer').not.toEqual(previousLatest);
      expect(latest?.status).toEqual('complete');
      expect(latest?.components.sort()).toEqual([
        'clickhouse',
        'encryption',
        'pmm-server',
        'postgresql',
        'victoriametrics',
      ]);

      return latest?.id as string;
    });

    await pmmTest.step('Write a second marker that the backup does not hold', async () => {
      await writeMarkers('after');
      expect(await markersFound()).toEqual(everywhere(['before', 'after']));
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
        expect(await markersFound()).toEqual(everywhere(['before']));
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });

    await pmmTest.step(
      `Verify the ${monitoredServices.length} services that ran before the backup run and report again`,
      async () => {
        const restoredAt = await api.prometheusApi.waitForServerTime();

        await expect(async () => {
          const restored = await runningAndReporting(restoredAt);

          expect(monitoredServices.filter((serviceName) => !restored.includes(serviceName))).toEqual([]);
        }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      },
    );
  },
);

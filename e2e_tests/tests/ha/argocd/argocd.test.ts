import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import K8sHelper from '@helpers/k8s.helper';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';
import { defaultReplicas, pmmServerPodSelector } from '@helpers/haCluster.helper';

const run = Date.now();
const backupJob = `pmm-e2e-argocd-backup-${run}`;
const restoreJob = `pmm-e2e-argocd-restore-${run}`;
const refreshInterval = Timeouts.THIRTY_SECONDS + Timeouts.TEN_SECONDS;
// PMM Server logs to files on its PVC, not to the container's stdout.
const serverLogs = ['/srv/logs/pmm-managed.log', '/srv/logs/grafana.log'];

// The later cases change the cluster, and a retry of a serial file repeats all of
// it, backup and restore included, inside the run's globalTimeout.
pmmTest.describe.configure({ mode: 'serial', retries: 0 });

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest.afterEach(async ({ haBackupHelper, k8sHelper }, testInfo) => {
  // The Jobs take their pods' logs with them when deleted.
  for (const job of [backupJob, restoreJob]) {
    const logs = haBackupHelper.jobLogs(job);

    if (logs) await testInfo.attach(`${job}.log`, { body: logs, contentType: 'text/plain' });
  }

  k8sHelper.exec(`delete job ${backupJob} ${restoreJob} --ignore-not-found`);
});

pmmTest(
  'PMM-T2495 - Verify both Argo CD Applications are Synced and Healthy, leave no PMM Role in namespace default and apply the backup scripts ConfigMap server-side @ha-argocd',
  async ({ argoCdHelper }) => {
    const { deps, pmm } = argoCdHelper.apps();

    for (const app of [deps, pmm]) {
      await pmmTest.step(`Verify Application "${app}" is Synced and Healthy`, async () => {
        await argoCdHelper.waitForSyncedHealthy(app, Timeouts.FIVE_MINUTES);
      });
    }

    for (const app of [deps, pmm]) {
      await pmmTest.step(
        `Verify Application "${app}" syncs automatically with prune and self-heal`,
        async () => {
          expect(
            argoCdHelper.automatedSyncPolicy(app),
            `spec.syncPolicy.automated of "${app}"`,
          ).toMatchObject({
            prune: true,
            selfHeal: true,
          });
        },
      );
    }

    await pmmTest.step(`Verify "${pmm}" ignores the replica counts a restore writes`, async () => {
      expect(argoCdHelper.ignoreDifferences(pmm), `spec.ignoreDifferences of "${pmm}"`).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            group: 'apps',
            kind: 'StatefulSet',
            managedFieldsManagers: ['pmm-backup'],
            name: pmm,
          }),
          expect.objectContaining({
            group: 'operator.victoriametrics.com',
            kind: 'VMCluster',
            managedFieldsManagers: ['pmm-backup'],
            name: `${pmm}-vmcluster`,
          }),
        ]),
      );
    });

    await pmmTest.step('Verify namespace default has no Role or RoleBinding of PMM', async () => {
      const names = new K8sHelper('default')
        .execSilent('get role,rolebinding --output=name')
        .assertSuccess()
        .getStdOutLines();

      expect(names.filter((name) => name.includes('pmm'))).toEqual([]);
    });

    const configMap = `${pmm}-backup-scripts`;

    await pmmTest.step(`Verify Argo CD applied ConfigMap "${configMap}" server-side`, async () => {
      // Its last-applied-configuration annotation would pass the 256 KiB client-side cap.
      expect(argoCdHelper.syncResultMessage(pmm, 'ConfigMap', configMap)).toContain('serverside-applied');
    });
  },
);

pmmTest(
  'PMM-T2496 - Verify hard refreshes of both Argo CD Applications find no drift and restart no PMM HA pod @ha-argocd',
  async ({ argoCdHelper, k8sHelper }) => {
    pmmTest.setTimeout(Timeouts.FIFTEEN_MINUTES);

    const { deps, pmm } = argoCdHelper.apps();
    const podUids = k8sHelper.getControllerPodUids();
    const lastOperations = [deps, pmm].map((app) => argoCdHelper.lastOperationFinishedAt(app));

    expect(
      Object.keys(podUids).length,
      'The PMM namespace must run StatefulSet and Deployment pods',
    ).toBeGreaterThan(0);

    for (const attempt of [1, 2, 3]) {
      await pmmTest.step(`Hard refresh ${attempt} of 3: both Applications stay Synced`, async () => {
        await argoCdHelper.hardRefresh([deps, pmm], refreshInterval);

        for (const app of [deps, pmm]) {
          await expect(async () => {
            expect(
              argoCdHelper.refreshPending(app),
              `Argo CD must have acted on the hard refresh of "${app}"`,
            ).toBe(false);
          }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
          expect(argoCdHelper.syncStatus(app), `"${app}" must not drift after a re-render`).toEqual('Synced');
        }
      });
    }

    await pmmTest.step('Verify no sync ran and no StatefulSet or Deployment pod was replaced', async () => {
      expect(
        [deps, pmm].map((app) => argoCdHelper.lastOperationFinishedAt(app)),
        'A drift corrected by self-heal shows up as a new sync operation',
      ).toEqual(lastOperations);
      expect(k8sHelper.getControllerPodUids()).toEqual(podUids);
    });
  },
);

pmmTest(
  'PMM-T2497 - Verify PMM Server authenticates to PostgreSQL and the Grafana ClickHouse data source works when deployed by Argo CD @ha-argocd',
  async ({ haClusterHelper, k8sHelper, request }) => {
    for (const podName of haClusterHelper.podNames()) {
      await pmmTest.step(`Verify "${podName}" logs no PostgreSQL authentication failure`, async () => {
        const result = k8sHelper.execInPod(
          podName,
          `grep -ah 'password authentication failed' ${serverLogs.join(' ')}`,
          { silent: true },
        );
        // kubectl exits 1 on its own errors too; only grep's no-match is reported this way.
        const noMatch = result.code === 1 && result.stderr.includes('command terminated with exit code 1');

        if (result.code !== 0 && !noMatch) {
          throw new Error(`Cannot read ${serverLogs.join(', ')} in "${podName}": ${result.stderr.trim()}`);
        }

        expect(result.getStdOutLines(), `${serverLogs.join(', ')} in "${podName}"`).toEqual([]);
      });
    }

    const clickHouseUids = await pmmTest.step('Find the ClickHouse data sources', async () => {
      const response = await request.get(apiEndpoints.grafana.datasources, {
        headers: GrafanaHelper.getAuthHeader(),
      });

      expect(response.status(), await response.text()).toEqual(200);

      const uids = ((await response.json()) as { type: string; uid: string }[])
        .filter((dataSource) => dataSource.type === 'grafana-clickhouse-datasource')
        .map((dataSource) => dataSource.uid);

      expect(uids.length, 'PMM must provision a ClickHouse data source').toBeGreaterThan(0);

      return uids;
    });

    for (const uid of clickHouseUids) {
      await pmmTest.step(`Verify the health check of ClickHouse data source "${uid}" passes`, async () => {
        const response = await request.get(`${apiEndpoints.grafana.datasourceByUid}/${uid}/health`, {
          headers: GrafanaHelper.getAuthHeader(),
        });
        const body = await response.text();

        expect(response.status(), body).toEqual(200);
        expect((JSON.parse(body) as { message?: string }).message, body).toEqual('Data source is working');
      });
    }
  },
);

pmmTest(
  'PMM-T2498 - Verify Argo CD self-heal brings the PMM HA StatefulSet back to its chart replica count @ha-argocd',
  async ({ api, argoCdHelper, haClusterHelper, k8sHelper }) => {
    pmmTest.setTimeout(Timeouts.THIRTY_MINUTES);

    const { pmm } = argoCdHelper.apps();
    const podNames = haClusterHelper.podNames();

    expect(argoCdHelper.automatedSyncPolicy(pmm)?.selfHeal, `Self-heal must be on for "${pmm}"`).toBe(true);

    // Only the leader removes departing members from Raft, so it must survive the scale-down.
    await pmmTest.step(`Move leadership onto "${podNames[0]}"`, async () => {
      await haClusterHelper.ensureLeaderAmong([podNames[0]]);
    });

    await pmmTest.step(`Scale StatefulSet "${pmm}" to 1 replica`, async () => {
      k8sHelper.scaleStatefulSet(pmm, 1).assertSuccess();
    });

    await pmmTest.step(`Verify self-heal restores ${defaultReplicas} replicas within 2 minutes`, async () => {
      await expect(async () => {
        const replicas = k8sHelper.getStatefulSetReplicas(pmm);

        expect(
          replicas,
          `StatefulSet "${pmm}" .spec.replicas is ${replicas}; Application "${pmm}" is ` +
            `${argoCdHelper.syncStatus(pmm)}/${argoCdHelper.healthStatus(pmm)}`,
        ).toEqual(defaultReplicas);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
    });

    await pmmTest.step('Verify the HA cluster serves again with every pod', async () => {
      await haClusterHelper.ensureServing(api.haApi);
      expect(k8sHelper.getPodNames(pmmServerPodSelector).sort()).toEqual(podNames);
      await argoCdHelper.waitForSyncedHealthy(pmm, Timeouts.TEN_MINUTES);
    });
  },
);

pmmTest(
  'PMM-T2499 - Verify an in-place backup restore finishes under Argo CD self-heal without a sync of the PMM Application @ha-argocd',
  async ({ argoCdHelper, haBackupHelper }) => {
    pmmTest.setTimeout(Timeouts.SIXTY_MINUTES);

    const { deps, pmm } = argoCdHelper.apps();
    const lastOperation = argoCdHelper.lastOperationFinishedAt(pmm);
    const previousLatest = haBackupHelper.listBackups().find((backup) => backup.latest)?.id;

    expect(argoCdHelper.automatedSyncPolicy(pmm)?.selfHeal, `Self-heal must be on for "${pmm}"`).toBe(true);

    const backupId = await pmmTest.step('Back up with a Job cloned from the backup CronJob', async () => {
      await haBackupHelper.runBackupJob(backupJob);

      const latest = haBackupHelper.latestBackup();

      expect(latest.id, 'A complete backup must move the latest pointer').not.toEqual(previousLatest);
      expect(latest.status).toEqual('complete');

      return latest.id;
    });

    await pmmTest.step(`Restore ${backupId} in place with a Job`, async () => {
      await haBackupHelper.runRestoreJob(restoreJob, backupId);
    });

    await pmmTest.step(`Verify Argo CD did not sync "${pmm}" during the restore`, async () => {
      // The restore's scale-down is ignored through managedFieldsManagers, not reverted.
      expect(argoCdHelper.lastOperationFinishedAt(pmm)).toEqual(lastOperation);
    });

    for (const app of [deps, pmm]) {
      await pmmTest.step(`Verify Application "${app}" ends Synced and Healthy`, async () => {
        await argoCdHelper.waitForSyncedHealthy(app, Timeouts.TEN_MINUTES);
      });
    }
  },
);

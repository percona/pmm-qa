import { createHash } from 'node:crypto';
import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import K8sHelper from '@helpers/k8s.helper';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';
import { KubernetesResourceList } from '@interfaces/kubernetes';

const run = Date.now();
const backupJob = `pmm-e2e-flux-backup-${run}`;
const restoreJob = `pmm-e2e-flux-restore-${run}`;
// The chart pins it through haproxy.fullnameOverride, whatever the release is called.
const haproxyDeployment = 'pmm-ha-haproxy';
// pmm-secret and the PostgreSQL operator's per-user secrets of pg-db.pmmUserName and pg-db.grafanaUserName.
const credentialSecrets = ['pmm-secret', 'pmmuser-credentials', 'gfuser-credentials'];
const upgradeValue = 'pmmEnv.PMM_E2E_FLUX_UPGRADE';
// PMM Server logs to files on its PVC, not to the container's stdout.
const serverLogs = ['/srv/logs/pmm-managed.log', '/srv/logs/grafana.log'];

interface OwnedPod {
  metadata: { name: string; ownerReferences?: { kind: string }[]; uid: string };
}

// A Job pod, such as a scheduled backup, comes and goes on its own.
const controllerPodUids = (k8sHelper: K8sHelper): Record<string, string> =>
  Object.fromEntries(
    (
      JSON.parse(
        k8sHelper.execSilent('get pods --output=json').assertSuccess().stdout,
      ) as KubernetesResourceList<OwnedPod>
    ).items
      .filter((pod) => ['ReplicaSet', 'StatefulSet'].includes(pod.metadata.ownerReferences?.[0]?.kind ?? ''))
      .map((pod) => [pod.metadata.name, pod.metadata.uid]),
  );
const secretDigests = (k8sHelper: K8sHelper): Record<string, string> =>
  Object.fromEntries(
    credentialSecrets.map((name) => [
      name,
      createHash('sha256')
        .update(k8sHelper.execSilent(`get secret ${name} --output=jsonpath={.data}`).assertSuccess().stdout)
        .digest('hex'),
    ]),
  );

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
  'PMM-TXXXX - Verify both Flux HelmReleases are Ready with the recommended settings and leave no PMM Role in namespace default @ha-flux',
  async ({ fluxHelper }) => {
    const { deps, pmm } = fluxHelper.releases();
    const sources = fluxHelper.sources();

    expect(sources.length, 'PMM_HA_FLUX_SOURCES must name the chart sources').toBeGreaterThan(0);

    for (const { kind, name } of sources) {
      await pmmTest.step(`Verify ${kind} "${name}" is Ready`, async () => {
        expect(fluxHelper.sourceReady(kind, name), `${kind} "${name}" Ready`).toBe(true);
      });
    }

    for (const release of [deps, pmm]) {
      await pmmTest.step(`Verify HelmRelease "${release}" is Ready`, async () => {
        await fluxHelper.waitForReady(release, Timeouts.FIVE_MINUTES);
      });
    }

    const chartVersion = process.env.PMM_HA_CHART_VERSION ?? '';

    await pmmTest.step(`Verify "${pmm}" runs the released chart version, if one was resolved`, async () => {
      // A pmm-ha chart from a git branch leaves PMM_HA_CHART_VERSION empty and has no version to compare.
      expect(
        chartVersion && fluxHelper.chartVersion(pmm),
        `status.history[0].chartVersion of "${pmm}"`,
      ).toEqual(chartVersion);
    });

    for (const release of [deps, pmm]) {
      await pmmTest.step(`Verify "${release}" detects drift and retries failed actions`, async () => {
        expect(fluxHelper.driftDetection(release).mode, `spec.driftDetection.mode of "${release}"`).toEqual(
          'enabled',
        );
        expect(fluxHelper.strategies(release), `Strategies, interval and timeout of "${release}"`).toEqual({
          crds: 'CreateReplace',
          install: 'RetryOnFailure',
          interval: '30m',
          timeout: '15m',
          upgrade: 'RetryOnFailure',
        });
      });
    }

    await pmmTest.step(`Verify "${pmm}" ignores the replica counts a restore writes`, async () => {
      expect(fluxHelper.driftDetection(pmm).ignore, `spec.driftDetection.ignore of "${pmm}"`).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ paths: ['/spec/replicas'], target: { kind: 'StatefulSet', name: pmm } }),
          expect.objectContaining({
            paths: ['/spec/replicas'],
            target: { kind: 'VMCluster', name: `${pmm}-vmcluster` },
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
  },
);

pmmTest(
  'PMM-TXXXX - Verify requested reconciles of both Flux HelmReleases find no drift and restart no PMM HA pod @ha-flux',
  async ({ fluxHelper, k8sHelper }) => {
    pmmTest.setTimeout(Timeouts.FIFTEEN_MINUTES);

    const { deps, pmm } = fluxHelper.releases();
    const podUids = controllerPodUids(k8sHelper);
    const revisions = [deps, pmm].map((release) => fluxHelper.releaseRevision(release));

    expect(
      Object.keys(podUids).length,
      'The PMM namespace must run StatefulSet and Deployment pods',
    ).toBeGreaterThan(0);

    for (const attempt of [1, 2, 3]) {
      await pmmTest.step(`Reconcile ${attempt} of 3: both HelmReleases handle the request`, async () => {
        const requests = [deps, pmm].map((release) => [release, fluxHelper.requestReconcile(release)]);

        for (const [release, requestedAt] of requests) {
          await expect(async () => {
            expect(
              fluxHelper.reconcileHandled(release, requestedAt),
              `Flux must have handled the reconcile of "${release}" requested at ${requestedAt}`,
            ).toBe(true);
          }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
        }
      });
    }

    await pmmTest.step('Verify no upgrade ran, no drift was found and no pod was replaced', async () => {
      expect(
        [deps, pmm].map((release) => fluxHelper.releaseRevision(release)),
        'A drift correction or upgrade shows up as a new Helm release revision',
      ).toEqual(revisions);
      expect(
        [deps, pmm].flatMap((release) => fluxHelper.driftEvents(release)),
        'Drift events on the HelmReleases',
      ).toEqual([]);
      expect(controllerPodUids(k8sHelper)).toEqual(podUids);
    });
  },
);

pmmTest(
  'PMM-TXXXX - Verify PMM Server authenticates to PostgreSQL and the Grafana ClickHouse data source works when deployed by Flux @ha-flux',
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
  'PMM-TXXXX - Verify Flux drift detection restores a changed HAProxy Deployment @ha-flux',
  async ({ fluxHelper, k8sHelper }) => {
    pmmTest.setTimeout(Timeouts.TEN_MINUTES);

    const { pmm } = fluxHelper.releases();
    const replicas = k8sHelper.getDeploymentReplicas(haproxyDeployment);
    const revision = fluxHelper.releaseRevision(pmm);

    expect(replicas, `Deployment "${haproxyDeployment}" must run more than 1 replica`).toBeGreaterThan(1);

    try {
      await pmmTest.step(`Scale Deployment "${haproxyDeployment}" to 1 replica`, async () => {
        k8sHelper.scaleDeployment(haproxyDeployment, 1).assertSuccess();
      });

      await pmmTest.step(`Verify a reconcile of "${pmm}" restores ${replicas} replicas`, async () => {
        const requestedAt = fluxHelper.requestReconcile(pmm);

        await expect(async () => {
          const current = k8sHelper.getDeploymentReplicas(haproxyDeployment);

          expect(
            current,
            `Deployment "${haproxyDeployment}" .spec.replicas is ${current}; reconcile handled: ` +
              `${fluxHelper.reconcileHandled(pmm, requestedAt)}; Ready: ${JSON.stringify(fluxHelper.ready(pmm))}`,
          ).toEqual(replicas);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
      });

      await pmmTest.step(`Verify Flux corrected the drift without an upgrade of "${pmm}"`, async () => {
        expect(fluxHelper.releaseRevision(pmm), `Helm release revision of "${pmm}"`).toEqual(revision);
        expect(fluxHelper.driftEvents(pmm).length, `Drift events on "${pmm}"`).toBeGreaterThan(0);
      });
    } finally {
      if (k8sHelper.getDeploymentReplicas(haproxyDeployment) !== replicas) {
        k8sHelper.scaleDeployment(haproxyDeployment, replicas).assertSuccess();
      }
    }
  },
);

pmmTest(
  'PMM-TXXXX - Verify an in-place backup restore finishes under Flux drift detection without an upgrade or rollback of the PMM release @ha-flux',
  async ({ fluxHelper, haBackupHelper, k8sHelper }, testInfo) => {
    pmmTest.setTimeout(Timeouts.SIXTY_MINUTES);

    const { deps, pmm } = fluxHelper.releases();
    const revision = fluxHelper.releaseRevision(pmm);
    const previousLatest = haBackupHelper.listBackups().find((backup) => backup.latest)?.id;

    try {
      const backupId = await pmmTest.step('Back up with a Job cloned from the backup CronJob', async () => {
        await haBackupHelper.runBackupJob(backupJob);

        const latest = haBackupHelper.latestBackup();

        expect(latest.id, 'A complete backup must move the latest pointer').not.toEqual(previousLatest);
        expect(latest.status).toEqual('complete');

        return latest.id;
      });

      await pmmTest.step(
        `Restore ${backupId} in place with a Job while Flux reconciles "${pmm}"`,
        async () => {
          const restore = haBackupHelper.runRestoreJob(restoreJob, backupId);

          // Awaited below; this only keeps an early failure from being an unhandled rejection meanwhile.
          restore.catch(() => undefined);

          await expect(async () => {
            expect(
              k8sHelper.getStatefulSetReplicas(pmm),
              `StatefulSet "${pmm}" scaled down by the restore`,
            ).toEqual(0);
          }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TEN_MINUTES });

          const requestedAt = fluxHelper.requestReconcile(pmm);

          await expect(async () => {
            expect(
              fluxHelper.reconcileHandled(pmm, requestedAt),
              `Flux must have handled the reconcile of "${pmm}" requested at ${requestedAt}`,
            ).toBe(true);
          }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });

          // The ignore rule on /spec/replicas keeps drift correction from scaling it back mid-restore.
          expect(k8sHelper.getStatefulSetReplicas(pmm), `StatefulSet "${pmm}" after the reconcile`).toEqual(
            0,
          );

          await restore;
        },
      );

      await pmmTest.step(`Verify Flux did not upgrade or roll back "${pmm}" during the restore`, async () => {
        expect(fluxHelper.releaseRevision(pmm), `Helm release revision of "${pmm}"`).toEqual(revision);
      });

      for (const release of [deps, pmm]) {
        await pmmTest.step(`Verify HelmRelease "${release}" ends Ready`, async () => {
          await fluxHelper.waitForReady(release, Timeouts.TEN_MINUTES);
        });
      }
    } catch (error) {
      // The Job logs are attached by afterEach; the events tell a Flux revert from a backup failure.
      await testInfo.attach(`${pmm}-helmrelease-events.txt`, {
        body: fluxHelper
          .events(pmm)
          .map((event) => `${event.reason ?? ''}: ${event.message ?? ''}`)
          .join('\n'),
        contentType: 'text/plain',
      });

      throw error;
    }
  },
);

pmmTest(
  'PMM-TXXXX - Verify a values change in the Flux HelmRelease upgrades PMM HA in place and keeps its credentials @ha-flux',
  async ({ api, fluxHelper, haClusterHelper, k8sHelper }) => {
    pmmTest.setTimeout(Timeouts.THIRTY_MINUTES + Timeouts.FIFTEEN_MINUTES);

    const { pmm } = fluxHelper.releases();
    const revision = fluxHelper.releaseRevision(pmm);
    const digests = secretDigests(k8sHelper);

    const serverPodUids = (): Record<string, string> => {
      const uids = controllerPodUids(k8sHelper);

      return Object.fromEntries(haClusterHelper.podNames().map((name) => [name, uids[name]]));
    };

    const podUids = serverPodUids();

    try {
      await pmmTest.step(`Set ${upgradeValue} in the values of "${pmm}"`, async () => {
        fluxHelper.setValue(pmm, upgradeValue, '1');
      });

      await pmmTest.step(`Verify "${pmm}" upgrades to revision ${revision + 1} and is Ready`, async () => {
        await expect(async () => {
          const ready = fluxHelper.ready(pmm);

          expect(fluxHelper.releaseRevision(pmm), `Helm release revision of "${pmm}"`).toEqual(revision + 1);
          expect(ready.status, `Ready of "${pmm}": ${ready.reason}: ${ready.message}`).toEqual('True');
        }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIFTEEN_MINUTES });
      });

      await pmmTest.step('Verify every PMM Server pod was replaced and the HA cluster serves', async () => {
        const replaced = serverPodUids();

        expect(Object.keys(replaced), 'PMM Server pods after the upgrade').toEqual(Object.keys(podUids));

        for (const [name, uid] of Object.entries(replaced)) {
          expect(uid, `UID of "${name}" after the upgrade`).not.toEqual(podUids[name]);
        }

        await haClusterHelper.ensureServing(api.haApi);
      });

      await pmmTest.step('Verify the upgrade kept the credential secrets', async () => {
        expect(secretDigests(k8sHelper), `SHA-256 of .data of ${credentialSecrets.join(', ')}`).toEqual(
          digests,
        );
      });
    } finally {
      fluxHelper.setValue(pmm, upgradeValue, null);

      const requestedAt = fluxHelper.requestReconcile(pmm);

      await expect(async () => {
        expect(
          fluxHelper.reconcileHandled(pmm, requestedAt),
          `Flux must have handled the reconcile of "${pmm}" requested at ${requestedAt}`,
        ).toBe(true);
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIFTEEN_MINUTES });
      await fluxHelper.waitForReady(pmm, Timeouts.TEN_MINUTES);
    }
  },
);

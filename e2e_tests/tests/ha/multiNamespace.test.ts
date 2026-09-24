import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import HaClusterHelper, { defaultReplicas, pmmServerPodSelector } from '@helpers/haCluster.helper';
import K8sHelper from '@helpers/k8s.helper';
import CliHelper from '@helpers/cli.helper';
import GrafanaHelper from '@helpers/grafana.helper';
import ExecReturn from '@interfaces/execReturn';
import { HaStatusResponse } from '@interfaces/ha';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';

const execFileAsync = promisify(execFile);
const installScript = resolve('../k8s/install_pmm_ha.sh');
const outputDir = resolve('output/ha-multi-namespace');
const summaryFile = `${outputDir}/pmm-ha-summary.env`;
const secondNamespace = 'pmm-2';
// Without "pmm-ha" in it, so the chart names the second instance `<release>-pmm-ha`.
const secondRelease = 'pmm-second';
const secondPodNames = Array.from({ length: defaultReplicas }, (_, i) => `${secondRelease}-pmm-ha-${i}`);
const haproxySelector = 'app.kubernetes.io/name=haproxy';
const nodeExporterSelector = 'app.kubernetes.io/name=prometheus-node-exporter';
const cliHelper = new CliHelper();

const platform = (): string => {
  if (!process.env.PLATFORM) {
    throw new Error('PLATFORM must name the platform install_pmm_ha.sh targets: eks, openshift or lke');
  }

  return process.env.PLATFORM;
};

/** Async, so a 15 minute `helm --wait` does not block the Playwright worker. */
const runInstaller = async (args: string[]): Promise<ExecReturn> => {
  const command = `${installScript} ${args.join(' ')}`;

  mkdirSync(outputDir, { recursive: true });
  console.log(`exec: "${command}"`);

  try {
    const { stderr, stdout } = await execFileAsync(installScript, args, {
      env: {
        ...process.env,
        DEBUG_DIR: `${outputDir}/debug`,
        PMM_ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin',
        SUMMARY_FILE: summaryFile,
      },
      maxBuffer: 64 * 1_024 * 1_024,
    });

    return new ExecReturn(command, 0, stdout, stderr);
  } catch (error) {
    const {
      code,
      stderr = '',
      stdout = '',
    } = error as { code?: number | string; stderr?: string; stdout?: string };

    return new ExecReturn(command, typeof code === 'number' ? code : 1, stdout, stderr);
  }
};

const installIntoSecondNamespace = async (
  charts: 'deps' | 'pmm-ha',
  extraArgs: string[],
): Promise<ExecReturn> =>
  await runInstaller([
    '--platform',
    platform(),
    '--namespace',
    secondNamespace,
    '--charts',
    charts,
    ...extraArgs,
  ]);

const expectOwnershipConflict = (result: ExecReturn, kindPattern: string): void => {
  const output = `${result.stdout}\n${result.stderr}`;

  expect(
    result.code,
    'The install must fail on a cluster-scoped resource the first namespace owns',
  ).not.toEqual(0);
  expect(output).toContain('INSTALLATION FAILED');
  expect(output).toMatch(new RegExp(`${kindPattern} "[^"]+" in namespace "" exists and cannot be imported`));
  expect(output).toContain(`key "meta.helm.sh/release-namespace" must equal "${secondNamespace}"`);
};

const secondInstanceUrl = (): string => {
  const url = /^url=(https:\/\/\S+)$/m.exec(readFileSync(summaryFile, 'utf8'))?.[1];

  if (!url) throw new Error(`${summaryFile} carries no external URL for the second PMM HA instance`);

  return url.replace(/\/?$/, '');
};

// Deleting the namespace alone would leak the release's ClusterRoles and fail the next run's install.
const removeSecondInstance = (): void => {
  if (cliHelper.execSilent(`helm status ${secondRelease} --namespace ${secondNamespace}`).code === 0) {
    cliHelper
      .execute(`helm uninstall ${secondRelease} --namespace ${secondNamespace} --wait --timeout 10m`)
      .assertSuccess();
  }

  cliHelper
    .execute(
      `kubectl delete clusterrole,clusterrolebinding --selector=app.kubernetes.io/instance=${secondRelease} --ignore-not-found`,
    )
    .assertSuccess();
  cliHelper
    .execute(
      `kubectl delete clusterrolebinding pmm-ha-anyuid-${secondNamespace} pmm-ha-nonroot-v2-${secondNamespace} --ignore-not-found`,
    )
    .assertSuccess();
  cliHelper
    .execute(`kubectl delete namespace ${secondNamespace} --ignore-not-found --timeout=10m`)
    .assertSuccess();
};

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
  removeSecondInstance();
});

pmmTest.afterEach(() => {
  removeSecondInstance();
});

// Not tagged @pmm-ha: it installs a second PMM HA into the cluster, and `--grep "@pmm-ha"`
// matches a nested tag by substring.
pmmTest(
  'PMM-T2286 - Verify PMM HA can be installed into a second namespace of the same cluster @pmm-helm-multi-namespace',
  async ({
    api,
    grafanaHelper,
    haClusterHelper,
    helmHelper,
    highAvailabilityPage,
    k8sHelper,
    leftNavigation,
    page,
    queryAnalytics,
  }) => {
    pmmTest.setTimeout(Timeouts.SIXTY_MINUTES);
    helmHelper.assertAvailable();

    const firstPodNames = haClusterHelper.podNames();
    const firstLeader = await haClusterHelper.verifySingleLeader(api.haApi, firstPodNames);
    const firstRelease = helmHelper.getRelease('pmm-ha').name;
    const dependenciesRelease = helmHelper.getRelease('pmm-ha-dependencies').name;
    const image = process.env.DOCKER_VERSION || k8sHelper.getPods(pmmServerPodSelector)[0].images[0];
    const secondK8sHelper = new K8sHelper(secondNamespace);
    const secondHaClusterHelper = new HaClusterHelper(secondK8sHelper);

    await pmmTest.step(
      'Verify the dependencies cannot be installed a second time into another namespace',
      async () => {
        expectOwnershipConflict(
          await installIntoSecondNamespace('deps', ['--deps-release', dependenciesRelease]),
          'CustomResourceDefinition',
        );
      },
    );

    await pmmTest.step(
      `Verify PMM HA cannot reuse the release name "${firstRelease}" in another namespace`,
      async () => {
        expectOwnershipConflict(
          await installIntoSecondNamespace('pmm-ha', ['--release', firstRelease, '--image', image]),
          'ClusterRole(Binding)?',
        );
      },
    );

    await pmmTest.step(
      `Install PMM HA as "${secondRelease}" into "${secondNamespace}" with the node exporter disabled`,
      async () => {
        (
          await installIntoSecondNamespace('pmm-ha', [
            '--release',
            secondRelease,
            '--image',
            image,
            '--set',
            'prometheus-node-exporter.enabled=false',
            '--external-access',
          ])
        ).assertSuccess();
      },
    );

    await pmmTest.step(`Verify every PMM and HAProxy pod runs in "${secondNamespace}"`, async () => {
      await secondHaClusterHelper.waitForReadyPods(defaultReplicas, Timeouts.TEN_MINUTES);
      expect(secondHaClusterHelper.podNames()).toEqual(secondPodNames);

      const haproxyPods = secondK8sHelper.getPods(haproxySelector);

      expect(haproxyPods.length, 'The second instance must run its own HAProxy').toBeGreaterThan(0);
      expect(haproxyPods.filter((pod) => !pod.ready).map((pod) => pod.name)).toEqual([]);
      expect(
        secondK8sHelper.getPods(nodeExporterSelector).map((pod) => pod.name),
        'The node exporter is cluster-wide and must not be deployed a second time',
      ).toEqual([]);
    });

    const secondLeader = await pmmTest.step('Verify the second instance is its own HA cluster', async () => {
      for (const podName of secondPodNames) {
        await expect(() => {
          expect(secondHaClusterHelper.haStatusFromPod(podName)).toEqual('Enabled');
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
      }

      const leader = await secondHaClusterHelper.waitForLeaderChange();

      await expect(() => {
        expect(
          secondHaClusterHelper
            .nodesFromPod(leader)
            .nodes.map((node) => node.node_name)
            .sort(),
          'The two instances must not join one another',
        ).toEqual(secondPodNames);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });

      return leader;
    });

    await pmmTest.step(`Verify the first instance in "${k8sHelper.namespace}" is unaffected`, async () => {
      expect(haClusterHelper.podNames()).toEqual(firstPodNames);
      expect(await haClusterHelper.verifySingleLeader(api.haApi, firstPodNames)).toEqual(firstLeader);
      expect(
        k8sHelper
          .getPods(haproxySelector)
          .filter((pod) => !pod.ready)
          .map((pod) => pod.name),
      ).toEqual([]);
    });

    await pmmTest.step('Verify the first instance UI names its own leader', async () => {
      await leftNavigation.verifyUiRenders(highAvailabilityPage.url);
      expect(await highAvailabilityPage.getLeaderName()).toEqual(firstLeader);
    });

    const secondUrl = secondInstanceUrl();

    await pmmTest.step(`Verify the second instance serves on ${secondUrl}`, async () => {
      const response = await page.request.get(`${secondUrl}${apiEndpoints.ha.status}`, {
        headers: GrafanaHelper.getAuthHeader(),
      });

      expect(response.status()).toEqual(200);
      expect(((await response.json()) as HaStatusResponse).status).toEqual('Enabled');
    });

    await grafanaHelper.authorize('admin', process.env.ADMIN_PASSWORD || 'admin', `${secondUrl}/`);

    await pmmTest.step('Verify the second instance UI names its own leader', async () => {
      await leftNavigation.verifyUiRenders(`${secondUrl}/${highAvailabilityPage.url}`);
      expect(await highAvailabilityPage.getLeaderName()).toEqual(secondLeader);
    });

    await pmmTest.step('Verify Query Analytics opens on the second instance', async () => {
      await page.goto(`${secondUrl}/${queryAnalytics.url}`, { timeout: Timeouts.TWO_MINUTES });
      await expect(queryAnalytics.elements.pageTitle.first()).toBeVisible({ timeout: Timeouts.TWO_MINUTES });
      await queryAnalytics.noSpinner();
    });
  },
);

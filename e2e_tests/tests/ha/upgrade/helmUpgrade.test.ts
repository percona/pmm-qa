import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import apiEndpoints from '@helpers/apiEndpoints';
import { pmmServerPodSelector } from '@helpers/haCluster.helper';
import { serverVersionBelow } from '@helpers/version.helper';

const pmmHaChart = 'pmm-ha';
const dependenciesChart = 'pmm-ha-dependencies';
const targetImage = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
// Set by the pipeline to the image it asked k8s/install_pmm_ha.sh to install.
const releaseImage = process.env.RELEASE_DOCKER_VERSION;
// The upgrade happens between the two tests - and so between two Playwright
// processes - so what the second one needs to compare against is written here.
const baselineFile = process.env.HA_UPGRADE_BASELINE || resolve('output/ha-upgrade-baseline.json');
// A cluster can pull through a mirror - ROSA rewrites docker.io to an internal
// cache registry - so a pod's image carries a prefix the chart never asked for.
const runsImage = (images: string[], wanted: string): boolean =>
  images.some((image) => image === wanted || image.endsWith(`/${wanted}`));

interface Baseline {
  images: string[];
  podNames: string[];
  revision: number;
  version: string;
}

const readBaseline = (): Baseline => {
  try {
    return JSON.parse(readFileSync(baselineFile, 'utf8')) as Baseline;
  } catch (error) {
    throw new Error(
      `Cannot read the pre-upgrade baseline at "${baselineFile}": ${(error as Error).message}\n` +
        'Run the @pmm-helm-pre-upgrade test against the released install before upgrading.',
    );
  }
};

const writeBaseline = (baseline: Baseline): void => {
  mkdirSync(dirname(baselineFile), { recursive: true });
  writeFileSync(baselineFile, JSON.stringify(baseline, undefined, 2));
};

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

// Deliberately not tagged @pmm-ha: these two run either side of an upgrade of the
// cluster they run on, and `--grep "@pmm-ha"` matches a nested tag by substring.
pmmTest(
  'Verify a PMM HA cluster installed from the released Helm chart is healthy before the upgrade @pmm-helm-pre-upgrade',
  async ({ api, haClusterHelper, helmHelper, highAvailabilityPage, k8sHelper, leftNavigation, page }) => {
    await pmmTest.step('Verify HA mode is enabled', async () => {
      expect(await api.haApi.getStatus()).toEqual('Enabled');
    });

    const baseline = await pmmTest.step('Baseline the release, images and version in place', async () => {
      helmHelper.assertAvailable();

      expect(targetImage, `"${targetImage}" must be a repository:tag pair`).toContain(':');

      const release = helmHelper.getRelease(pmmHaChart);
      const pods = k8sHelper.getPods(pmmServerPodSelector);
      const images = [...new Set(pods.flatMap((pod) => pod.images))];

      expect(release.status, `Helm release "${release.name}" must be deployed`).toEqual('deployed');
      expect(pods.length, 'The HA cluster must have PMM Server pods').toBeGreaterThan(0);
      expect(
        runsImage(images, targetImage),
        `The upgrade target is "${targetImage}", so the cluster must be installed from the released chart first`,
      ).toBeFalsy();

      // The pipeline names the image it asked the install script for; with nothing
      // named there is nothing extra to pin down.
      expect(
        !releaseImage || pods.every((pod) => runsImage(pod.images, releaseImage)),
        `Every PMM Server pod must run "${releaseImage}", got ${images.join(', ')}`,
      ).toBeTruthy();

      return {
        images,
        podNames: pods.map((pod) => pod.name).sort(),
        revision: Number(release.revision),
        version: (await api.serverApi.getPmmVersion()).version,
      };
    });

    await pmmTest.step('Verify the UI is accessible', async () => {
      await page.goto(highAvailabilityPage.url, { timeout: Timeouts.TWO_MINUTES });
      await expect(leftNavigation.elements.sidebar).toBeVisible({ timeout: Timeouts.TWO_MINUTES });
      await leftNavigation.selectMenuItem('home');
      await expect(leftNavigation.elements.iframe, 'The home dashboard must render').toBeVisible({
        timeout: Timeouts.TWO_MINUTES,
      });
    });

    const leader = await pmmTest.step('Verify the cluster has exactly one leader', async () => {
      const leaderPod = await haClusterHelper.waitForLeaderChange(undefined, Timeouts.FIVE_MINUTES);

      await api.haApi.waitForLeaderStatusSum(1, Timeouts.TWO_MINUTES);
      expect(await api.haApi.getNodeNames(), 'Every pod must have joined the HA cluster').toEqual(
        baseline.podNames,
      );
      expect(
        (await api.haApi.getLeaderNode())?.node_name,
        `${apiEndpoints.ha.nodes} must name the pod that answers the leader health check`,
      ).toEqual(leaderPod);

      return leaderPod;
    });

    await pmmTest.step(`Verify the HA badge names "${leader}" as leader`, async () => {
      await highAvailabilityPage.reloadAndExpandHaNavItem();
      await expect(highAvailabilityPage.leaderNameLocator()).toHaveText(leader, {
        timeout: Timeouts.TWO_MINUTES,
      });
    });

    await pmmTest.step(`Record the baseline in "${baselineFile}"`, async () => {
      writeBaseline(baseline);
    });
  },
);

pmmTest(
  'Verify a PMM HA cluster keeps serving while its dependencies are upgraded @pmm-helm-mid-upgrade',
  async ({ api, haClusterHelper, helmHelper, highAvailabilityPage, k8sHelper, leftNavigation, page }) => {
    const before = readBaseline();

    await pmmTest.step('Verify HA mode is enabled', async () => {
      expect(await api.haApi.getStatus()).toEqual('Enabled');
    });

    await pmmTest.step('Verify the dependencies moved and the pmm-ha release did not', async () => {
      helmHelper.assertAvailable();

      expect(
        helmHelper.getRelease(dependenciesChart).status,
        `"${dependenciesChart}" must be deployed after its upgrade`,
      ).toEqual('deployed');

      const release = helmHelper.getRelease(pmmHaChart);

      expect(release.status, 'The pmm-ha release must still be deployed').toEqual('deployed');
      expect(
        Number(release.revision),
        'Upgrading the dependencies must leave the pmm-ha release untouched',
      ).toEqual(before.revision);
    });

    const podNames = await pmmTest.step('Verify the PMM Server pods were not replaced', async () => {
      const pods = k8sHelper.getPods(pmmServerPodSelector);
      const names = pods.map((pod) => pod.name).sort();

      expect(names, 'Upgrading the dependencies must not replace the PMM Server pods').toEqual(
        before.podNames,
      );

      for (const pod of pods) {
        expect(
          runsImage(pod.images, targetImage),
          `Pod "${pod.name}" must not be on the upgrade target yet, got ${pod.images.join(', ')}`,
        ).toBeFalsy();
      }

      return names;
    });

    await pmmTest.step(`Verify the cluster still serves "${before.version}"`, async () => {
      const version = await api.serverApi.getPmmVersion();

      expect(version.version, 'The dependencies upgrade must not move the server version').toEqual(
        before.version,
      );

      for (const podName of podNames) {
        expect(
          haClusterHelper.versionFromPod(podName),
          `Pod "${podName}" must serve the same version as the cluster API`,
        ).toEqual(version.version);
      }
    });

    await pmmTest.step('Verify the UI is accessible', async () => {
      await page.goto(highAvailabilityPage.url, { timeout: Timeouts.TWO_MINUTES });
      await expect(leftNavigation.elements.sidebar).toBeVisible({ timeout: Timeouts.TWO_MINUTES });
      await leftNavigation.selectMenuItem('home');
      await expect(leftNavigation.elements.iframe, 'The home dashboard must render').toBeVisible({
        timeout: Timeouts.TWO_MINUTES,
      });
    });

    const leader = await pmmTest.step('Verify the cluster still has exactly one leader', async () => {
      const leaderPod = await haClusterHelper.waitForLeaderChange(undefined, Timeouts.FIVE_MINUTES);

      await api.haApi.waitForLeaderStatusSum(1, Timeouts.TWO_MINUTES);
      expect(await api.haApi.getNodeNames(), 'Every pod must still be in the HA cluster').toEqual(podNames);
      expect(
        (await api.haApi.getLeaderNode())?.node_name,
        `${apiEndpoints.ha.nodes} must name the pod that answers the leader health check`,
      ).toEqual(leaderPod);

      return leaderPod;
    });

    await pmmTest.step(`Verify the HA badge names "${leader}" as leader`, async () => {
      await highAvailabilityPage.reloadAndExpandHaNavItem();
      await expect(highAvailabilityPage.leaderNameLocator()).toHaveText(leader, {
        timeout: Timeouts.TWO_MINUTES,
      });
    });
  },
);

pmmTest(
  'Verify a PMM HA cluster upgraded to a new server image is healthy on it @pmm-helm-post-upgrade',
  async ({
    api,
    grafanaHelper,
    haClusterHelper,
    helmHelper,
    highAvailabilityPage,
    k8sHelper,
    leftNavigation,
    page,
  }) => {
    const before = readBaseline();

    await pmmTest.step('Verify HA mode is enabled', async () => {
      expect(await api.haApi.getStatus()).toEqual('Enabled');
    });

    await pmmTest.step('Verify Helm recorded a new deployed revision', async () => {
      helmHelper.assertAvailable();

      const upgraded = helmHelper.getRelease(pmmHaChart);

      expect(
        Number(upgraded.revision),
        `The Helm revision must advance past ${before.revision}`,
      ).toBeGreaterThan(before.revision);
      expect(upgraded.status, 'The upgraded release must be deployed').toEqual('deployed');
    });

    const podNames = await pmmTest.step(`Verify every pod runs "${targetImage}"`, async () => {
      const pods = k8sHelper.getPods(pmmServerPodSelector);
      const names = pods.map((pod) => pod.name).sort();

      expect(names, 'The upgrade must not replace the PMM Server pods').toEqual(before.podNames);

      for (const pod of pods) {
        expect(
          runsImage(pod.images, targetImage),
          `Pod "${pod.name}" must run the upgraded image, got ${pod.images.join(', ')}`,
        ).toBeTruthy();
      }

      return names;
    });

    await pmmTest.step('Verify every pod serves the upgraded version', async () => {
      const version = await api.serverApi.getPmmVersion();

      // Not asserted to differ from the baseline: a dev build reports whatever
      // version main is on, which can still be the released one.
      expect(
        serverVersionBelow(version, before.version),
        `The cluster must not report a version older than "${before.version}"`,
      ).toBeFalsy();

      for (const podName of podNames) {
        expect(
          haClusterHelper.versionFromPod(podName),
          `Pod "${podName}" must serve the same version as the cluster API`,
        ).toEqual(version.version);
      }
    });

    const leader = await pmmTest.step('Verify the cluster settles with exactly one leader', async () => {
      // No previous leader to wait away from - the rolling upgrade has already moved
      // leadership; this retries until exactly one pod answers the health check again.
      const leaderPod = await haClusterHelper.waitForLeaderChange(undefined, Timeouts.FIVE_MINUTES);

      await api.haApi.waitForLeaderStatusSum(1, Timeouts.TWO_MINUTES);
      expect(await api.haApi.getNodeNames(), 'Every pod must rejoin the HA cluster').toEqual(podNames);
      expect(
        (await api.haApi.getLeaderNode())?.node_name,
        `${apiEndpoints.ha.nodes} must name the pod that answers the leader health check`,
      ).toEqual(leaderPod);

      return leaderPod;
    });

    await pmmTest.step('Verify the UI is accessible after the upgrade', async () => {
      // The pods that served the pre-upgrade session are gone.
      await grafanaHelper.authorize();
      await page.goto(highAvailabilityPage.url, { timeout: Timeouts.TWO_MINUTES });
      await expect(leftNavigation.elements.sidebar).toBeVisible({ timeout: Timeouts.TWO_MINUTES });
      await leftNavigation.selectMenuItem('home');
      await expect(leftNavigation.elements.iframe, 'The home dashboard must render').toBeVisible({
        timeout: Timeouts.TWO_MINUTES,
      });
    });

    await pmmTest.step(`Verify the HA badge names "${leader}" as leader`, async () => {
      await highAvailabilityPage.reloadAndExpandHaNavItem();
      await expect(highAvailabilityPage.leaderNameLocator()).toHaveText(leader, {
        timeout: Timeouts.TWO_MINUTES,
      });
    });
  },
);

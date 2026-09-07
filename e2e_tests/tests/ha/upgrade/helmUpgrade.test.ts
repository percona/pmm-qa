import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { pmmServerPodSelector } from '@helpers/haCluster.helper';
import { KubernetesPod } from '@interfaces/kubernetes';
import { serverVersionBelow } from '@helpers/version.helper';

const pmmHaChart = 'pmm-ha';
const dependenciesChart = 'pmm-ha-dependencies';
const targetImage = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
/**
 * The image the cluster was installed from.
 */
const releasedImage = (): string => {
  const image = process.env.RELEASE_DOCKER_VERSION || 'percona/pmm-server:latest';

  if (!image) {
    throw new Error(
      'RELEASE_DOCKER_VERSION must name the image the cluster was installed from, ' +
        'so this test can prove the released install landed before anything moves.',
    );
  }

  return image;
};
// The upgrade happens between the two tests - and so between two Playwright
// processes - so what the second one needs to compare against is written here.
const baselineFile = process.env.HA_UPGRADE_BASELINE || resolve('output/ha-upgrade-baseline.json');
/**
 * `percona/pmm-server:3.9.1` out of a possibly mirrored reference like
 * `reg.example.com/dockerhub-cache/percona/pmm-server:3.9.1` - a cluster can pull
 * through a mirror, so only the repository and tag are comparable.
 */
const repositoryAndTag = (image: string): string => image.split('/').slice(-2).join('/');

/** The distinct PMM Server images the pods run; one entry when they all agree. */
const serverImages = (pods: KubernetesPod[]): string[] => [
  ...new Set(pods.flatMap((pod) => pod.images).map(repositoryAndTag)),
];

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
  async ({ api, haClusterHelper, helmHelper, highAvailabilityPage, k8sHelper, leftNavigation }) => {
    await haClusterHelper.verifyHaEnabled(api.haApi);

    const baseline = await pmmTest.step('Baseline the release, images and version in place', async () => {
      helmHelper.assertAvailable();

      expect(targetImage, `"${targetImage}" must be a repository:tag pair`).toContain(':');

      const release = helmHelper.getRelease(pmmHaChart);
      const pods = k8sHelper.getPods(pmmServerPodSelector);
      const images = [...new Set(pods.flatMap((pod) => pod.images))];

      expect(release.status, `Helm release "${release.name}" must be deployed`).toEqual('deployed');
      expect(pods.length, 'The HA cluster must have PMM Server pods').toBeGreaterThan(0);
      expect(
        serverImages(pods),
        `The upgrade target is "${targetImage}", so the cluster must be installed from the released chart first`,
      ).not.toContain(repositoryAndTag(targetImage));

      const releaseImage = releasedImage();

      expect(serverImages(pods), `Every PMM Server pod must run "${releaseImage}"`).toEqual([
        repositoryAndTag(releaseImage),
      ]);

      return {
        images,
        podNames: pods.map((pod) => pod.name).sort(),
        revision: Number(release.revision),
        version: (await api.serverApi.getPmmVersion()).version,
      };
    });

    await leftNavigation.verifyUiRenders(highAvailabilityPage.url);
    const leader = await haClusterHelper.verifySingleLeader(api.haApi, baseline.podNames);

    await highAvailabilityPage.verifyLeaderBadge(leader);

    await pmmTest.step(`Record the baseline in "${baselineFile}"`, async () => {
      writeBaseline(baseline);
    });
  },
);

pmmTest(
  'Verify a PMM HA cluster keeps serving while its dependencies are upgraded @pmm-helm-mid-upgrade',
  async ({ api, haClusterHelper, helmHelper, highAvailabilityPage, k8sHelper, leftNavigation }) => {
    const before = readBaseline();

    await haClusterHelper.verifyHaEnabled(api.haApi);

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

      expect(
        serverImages(pods),
        'Upgrading the dependencies must leave the server image alone',
      ).toEqual(before.images.map(repositoryAndTag));

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

    await leftNavigation.verifyUiRenders(highAvailabilityPage.url);
    const leader = await haClusterHelper.verifySingleLeader(api.haApi, podNames);

    await highAvailabilityPage.verifyLeaderBadge(leader);
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
  }) => {
    const before = readBaseline();

    await haClusterHelper.verifyHaEnabled(api.haApi);

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

      expect(serverImages(pods), 'Every pod must run the upgraded image').toEqual([
        repositoryAndTag(targetImage),
      ]);

      return names;
    });

    await pmmTest.step('Verify every pod serves the upgraded version', async () => {
      const version = await api.serverApi.getPmmVersion();

      expect(
        serverVersionBelow(version, before.version),
        `The cluster reports "${version.version}", older than the baseline "${before.version}"`,
      ).toBeFalsy();

      for (const podName of podNames) {
        expect(
          haClusterHelper.versionFromPod(podName),
          `Pod "${podName}" must serve the same version as the cluster API`,
        ).toEqual(version.version);
      }
    });

    const leader = await haClusterHelper.verifySingleLeader(api.haApi, podNames);

    await grafanaHelper.authorize();
    await leftNavigation.verifyUiRenders(highAvailabilityPage.url);
    await highAvailabilityPage.verifyLeaderBadge(leader);
  },
);

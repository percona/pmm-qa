import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

const pmmHaChart = 'pmm-ha';

pmmTest(
  'PMM-T2395 - Verify PMM HA installed under a release name without "pmm-ha" elects a leader and opens the UI @pmm-helm-release-name',
  async ({
    api,
    grafanaHelper,
    haClusterHelper,
    helmHelper,
    highAvailabilityPage,
    k8sHelper,
    leftNavigation,
  }) => {
    const statefulSet = await pmmTest.step(
      'Verify the release name differs from the PMM Server pod names',
      async () => {
        helmHelper.assertAvailable();
        k8sHelper.assertReachable();

        const release = helmHelper.getRelease(pmmHaChart);
        const name = haClusterHelper.statefulSetName();

        // The chart names the pods after the release only when it contains the chart name.
        expect(
          release.name,
          `Release "${release.name}" contains "${pmmHaChart}", so its pods are named after it and the case proves nothing`,
        ).not.toContain(pmmHaChart);
        expect(name, `The StatefulSet must be named "${release.name}-${pmmHaChart}"`).toEqual(
          `${release.name}-${pmmHaChart}`,
        );

        return name;
      },
    );

    await pmmTest.step('Verify PMM_HA_PEERS addresses the pods the StatefulSet creates', async () => {
      const { replicas, serviceName } = k8sHelper.getStatefulSet(statefulSet).spec;
      const expectedPeers = Array.from(
        { length: replicas },
        (_, ordinal) => `${statefulSet}-${ordinal}.${serviceName}.${k8sHelper.namespace}.svc.cluster.local`,
      );

      expect(haClusterHelper.haPeers(statefulSet)).toEqual(expectedPeers);
    });

    await haClusterHelper.ensureServing(api.haApi);
    await grafanaHelper.authorize();

    const podNames = haClusterHelper.podNames();
    const leader = await haClusterHelper.verifySingleLeader(api.haApi, podNames);

    await leftNavigation.verifyUiRenders(highAvailabilityPage.url);
    await highAvailabilityPage.verifyLeaderBadge(leader);

    const newLeader = await pmmTest.step(
      'Fail over the leader',
      async () => await haClusterHelper.failoverLeader(api.haApi),
    );

    expect(newLeader, 'A different pod must take over the leadership').not.toEqual(leader);
    await highAvailabilityPage.verifyLeaderBadge(newLeader);
  },
);

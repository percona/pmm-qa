import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import HaApi from '@api/ha.api';
import { Timeouts } from '@helpers/timeouts';
import { defaultReplicas } from '@helpers/haCluster.helper';

const terminalPhases = ['Succeeded', 'Failed'];

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2261 - Verify Prometheus rules and raft metrics for HA @pmm-ha',
  async ({ api, haClusterHelper, k8sHelper }) => {
    await pmmTest.step(
      `Verify PMM HA runs with ${defaultReplicas} replicas and every pod is up`,
      async () => {
        expect(haClusterHelper.podNames()).toHaveLength(defaultReplicas);

        await expect(async () => {
          expect(
            k8sHelper
              .getPods()
              .filter((pod) => !terminalPhases.includes(pod.phase) && !pod.ready)
              .map((pod) => `${pod.name} (${pod.phase})`),
          ).toEqual([]);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      },
    );

    const initialLeader = haClusterHelper.leaderFromPods();

    await pmmTest.step(
      `Verify "${HaApi.leaderStatusMetric}" shows "${initialLeader}" as leader`,
      async () => {
        expect(await api.haApi.waitForLeaderInMetrics()).toEqual(initialLeader);
      },
    );

    const newLeader = await pmmTest.step(
      `Switch the leader and verify "${HaApi.leaderStatusMetric}" shows the new one`,
      async () => {
        const leader = await haClusterHelper.failoverLeader(api.haApi);

        expect(await api.haApi.waitForLeaderInMetrics(initialLeader)).toEqual(leader);

        return leader;
      },
    );

    await pmmTest.step(`Verify sum(${HaApi.leaderStatusMetric}) returns 1`, async () => {
      await api.haApi.waitForLeaderStatusSum(1, Timeouts.TWO_MINUTES);
    });

    await pmmTest.step(`Verify every node reports "${HaApi.raftTermMetric}"`, async () => {
      await expect(async () => {
        expect(await api.haApi.getNodesFromMetric(HaApi.raftTermMetric)).toEqual(haClusterHelper.podNames());
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });

    await pmmTest.step(
      `Verify changes(${HaApi.raftTermMetric}[15m]) is above 0 on every node after the switch to "${newLeader}"`,
      async () => {
        await expect(async () => {
          const changes = await api.haApi.getRaftTermChanges();

          expect(changes).toHaveLength(defaultReplicas);
          expect(changes.filter((change) => change > 0)).toHaveLength(defaultReplicas);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      },
    );

    await pmmTest.step(`Verify every node reports "${HaApi.upMetric}" as a live voter`, async () => {
      await expect(async () => {
        const samples = await api.prometheusApi.instantQuery(HaApi.upMetric);

        expect(samples.map((sample) => sample.metric.node_id).sort()).toEqual(haClusterHelper.podNames());
        expect(samples.map((sample) => sample.metric.role)).toEqual(Array(defaultReplicas).fill('voter'));
        expect(samples.map((sample) => Number(sample.value[1]))).toEqual(Array(defaultReplicas).fill(1));
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });

    await pmmTest.step(`Verify count(${HaApi.upMetric}{role="voter"}) is ${defaultReplicas}`, async () => {
      await expect(async () => {
        expect(await api.haApi.getVoterCount()).toEqual(defaultReplicas);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });
  },
);

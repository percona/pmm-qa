import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import HaApi from '@api/ha.api';
import { Timeouts } from '@helpers/timeouts';
import { defaultReplicas } from '@helpers/haCluster.helper';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2261 - Verify Prometheus rules and raft metrics for HA @pmm-ha',
  async ({ api, haClusterHelper }) => {
    await pmmTest.step(`Verify PMM HA runs with ${defaultReplicas} pods`, async () => {
      expect(haClusterHelper.podNames()).toHaveLength(defaultReplicas);
    });

    const initialLeader = haClusterHelper.leaderFromPods();
    // Waited for rather than read once: a node missing from the baseline would drop
    // out of the post-switch comparison instead of failing it.
    const baselineTerms = await api.haApi.waitForRaftTerms(haClusterHelper.podNames());

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
      `Verify ${HaApi.raftTermMetric} rises on every node after the switch to "${newLeader}"`,
      async () => {
        // The term itself, not changes() over a rolling window: an older change ages
        // out of that window as the new one enters it, so the count can stay flat
        // across a switch that really did raise the term.
        await expect(async () => {
          const terms = await api.haApi.getRaftTerms();

          expect(Object.keys(terms).sort()).toEqual(haClusterHelper.podNames());

          Object.entries(baselineTerms).forEach(([node, baseline]) => {
            expect(
              terms[node],
              `Node "${node}" must reach a higher Raft term than the ${baseline} it held before the switch`,
            ).toBeGreaterThan(baseline);
          });
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      },
    );

    await pmmTest.step(
      `Verify changes(${HaApi.raftTermMetric}[15m]) counts the switch on every node`,
      async () => {
        await expect(async () => {
          const changes = await api.haApi.getRaftTermChanges();

          expect(Object.keys(changes).sort()).toEqual(haClusterHelper.podNames());

          Object.entries(changes).forEach(([node, count]) => {
            expect(count, `Node "${node}" must count the term change the switch caused`).toBeGreaterThan(0);
          });
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

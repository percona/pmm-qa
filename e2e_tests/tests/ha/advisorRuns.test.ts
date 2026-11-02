import AdvisorsApi from '@api/advisors.api';
import Api from '@api/api';
import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';
import { AdvisorRunStatus, AdvisorSchedule } from '@interfaces/advisors';
import { expect } from '@playwright/test';

const createdChecks: string[] = [];
const createdSchedules: string[] = [];
// The leader looks for runs queued and schedules changed on followers once a minute.
const leaderPollInterval = Timeouts.ONE_MINUTE;

// Each check runs for about 4 s, until the CPU limit of pmm-managed-starlark stops it.
const createSlowChecks = async (api: Api, count: number): Promise<string[]> => {
  const [service] = await api.advisorsApi.listServices();

  expect(service, 'PMM HA monitors no service to run checks on').toBeDefined();

  const prefix = AdvisorsApi.customCheckName();
  const names = Array.from({ length: count }, (_, i) => `${prefix}_${i}`);

  for (const name of names) {
    await api.advisorsApi.createCustomCheck({
      name,
      script: api.advisorsApi.endlessCheckScript,
      technology: service.technology,
    });
    createdChecks.push(name);
  }

  return names;
};

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest.afterEach(async ({ api }) => {
  for (const scheduleId of createdSchedules.splice(0)) await api.advisorsApi.deleteSchedule(scheduleId);

  await api.advisorsApi.waitForNoActiveRun();

  for (const name of createdChecks.splice(0)) await api.advisorsApi.deleteCheck(name);
});

pmmTest(
  'PMM-Txxxx - Verify the HA leader runs a run requested on a follower and allows one run at a time @pmm-ha',
  async ({ api, haClusterHelper }) => {
    const names = await createSlowChecks(api, 16);
    const leader = haClusterHelper.leaderFromPods();
    const follower = haClusterHelper.podNames().find((podName) => podName !== leader) as string;
    const queued = haClusterHelper.requestFromPod(follower, 'POST', apiEndpoints.advisors.start, {
      names,
      service_ids: [],
    });

    expect(queued.status, queued.body).toEqual(200);

    const { run_id: runId } = JSON.parse(queued.body) as { run_id: string };

    await pmmTest.step('The leader refuses another run while the first waits for it', async () => {
      expect((await api.advisorsApi.getRun(runId))?.status).toEqual(AdvisorRunStatus.queued);

      const refused = await api.advisorsApi.requestStartChecks(names);

      expect(refused.status()).toEqual(400);
      expect(await refused.text()).toMatch(/Advisor checks are already running \(started .+ by a user\)/);
    });

    await pmmTest.step('The leader starts the run at its next poll and completes it', async () => {
      await api.advisorsApi.waitForRun(runId, Timeouts.FIVE_MINUTES);
    });
  },
);

pmmTest(
  'PMM-Txxxx - Verify the HA leader runs a schedule created on a follower when it falls due @pmm-ha',
  async ({ api, haClusterHelper }) => {
    const [check] = await createSlowChecks(api, 1);
    const due = AdvisorsApi.nextDueMinute();
    const follower = haClusterHelper
      .podNames()
      .find((podName) => podName !== haClusterHelper.leaderFromPods()) as string;
    const created = haClusterHelper.requestFromPod(
      follower,
      'POST',
      apiEndpoints.advisors.schedules,
      AdvisorsApi.scheduleInput({
        check_names: [check],
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        time_of_day: due.time,
      }),
    );

    expect(created.status, created.body).toEqual(200);

    const { schedule } = JSON.parse(created.body) as { schedule: AdvisorSchedule };

    createdSchedules.push(schedule.schedule_id);

    const run = await api.advisorsApi.waitForScheduledRun(
      schedule.schedule_id,
      Timeouts.TWO_MINUTES + leaderPollInterval,
    );

    expect(Date.parse(run.scheduled_for as string)).toEqual(due.at.getTime());
  },
);

pmmTest(
  'PMM-Txxxx - Verify an HA leader failover interrupts the open run and starts no run of its own @pmm-ha',
  async ({ api, haClusterHelper }) => {
    pmmTest.setTimeout(Timeouts.FIFTEEN_MINUTES);

    const runId = await api.advisorsApi.startChecks(await createSlowChecks(api, 40));

    await expect
      .poll(async () => (await api.advisorsApi.getRun(runId))?.status, {
        message: `Advisor run ${runId} did not start`,
        timeout: Timeouts.TWO_MINUTES + leaderPollInterval,
      })
      .toEqual(AdvisorRunStatus.running);

    const failoverAt = Date.now();

    await haClusterHelper.failoverLeader(api.haApi);

    await pmmTest.step('The new leader closes the open run as interrupted', async () => {
      await expect
        .poll(async () => (await api.advisorsApi.getRun(runId))?.status, { timeout: Timeouts.TWO_MINUTES })
        .toEqual(AdvisorRunStatus.interrupted);
    });

    await pmmTest.step('The new leader starts no run once its start delay is over', async () => {
      // The new leader waits a minute after taking over before it starts anything.
      await expect
        .poll(() => Date.now(), { timeout: Timeouts.FIVE_MINUTES })
        .toBeGreaterThan(failoverAt + Timeouts.TWO_MINUTES + leaderPollInterval);

      const started = (await api.advisorsApi.listRuns()).filter(
        ({ schedule_id, started_at }) => !schedule_id && Date.parse(started_at) >= failoverAt,
      );

      expect(started.map(({ id }) => id)).toEqual([]);
    });
  },
);

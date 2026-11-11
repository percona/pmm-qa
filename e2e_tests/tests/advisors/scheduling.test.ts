import AdvisorsApi from '@api/advisors.api';
import MailpitApi from '@api/mailpit.api';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import {
  AdvisorCheckResultStatus,
  AdvisorInsight,
  AdvisorRun,
  AdvisorRunStatus,
  AdvisorTriggeredBy,
} from '@interfaces/advisors';
import { expect } from '@playwright/test';

const notificationsOn = {
  advisor_notification_email_addresses: { values: [MailpitApi.recipient('scheduling-settings')] },
  enable_advisor_notifications: true,
};
const createdChecks: string[] = [];
const createdNodes = new Set<string>();
const createdSchedules: string[] = [];
let notifications: Record<string, unknown>;
let pmmManagedStopped = false;

pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
  notifications = await api.settingsApi.getAdvisorNotifications();
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ api, cliHelper }) => {
  if (pmmManagedStopped) {
    cliHelper.supervisorctl('start');
    await api.serverApi.waitForReady();
    pmmManagedStopped = false;
  }
  if (!(await api.settingsApi.getSettings()).settings.advisor_enabled) {
    await api.settingsApi.updateSettings({ enable_advisor: true });
  }

  for (const scheduleId of createdSchedules.splice(0)) await api.advisorsApi.deleteSchedule(scheduleId);
  for (const nodeId of createdNodes) await api.inventoryApi.deleteNode(nodeId, true);

  createdNodes.clear();
  // A run a failed test left queued outlives restarts and would start during the next test.
  await api.advisorsApi.waitForNoActiveRun();

  for (const name of createdChecks.splice(0)) await api.advisorsApi.deleteCheck(name);

  await api.settingsApi.updateSettings(notifications);
});

pmmTest.describe('Advisor schedules falling due', () => {
  pmmTest(
    'PMM-T2611 - Verify a schedule runs when it falls due and emails its report @advisor-scheduling',
    async ({ advisorRunsPage, advisorSchedulerPage, api, page }) => {
      const recipient = MailpitApi.recipient('due');
      const service = await api.advisorsApi.getMysqlService();
      const check = await api.advisorsApi.createCustomCheck();
      const due = AdvisorsApi.nextDueMinute();

      createdChecks.push(check.name);

      const schedule = await api.advisorsApi.createDueSchedule(due.at, {
        check_names: [check.name],
        service_ids: [service.service_id],
        ...AdvisorsApi.warningEmailTo(recipient),
      });

      createdSchedules.push(schedule.schedule_id);
      await api.settingsApi.updateSettings(notificationsOn);

      const run = await pmmTest.step('The schedule starts a run at its time', async () => {
        const scheduled = await api.advisorsApi.waitForScheduledRun(schedule.schedule_id);
        const startedAfter = Date.parse(scheduled.started_at) - due.at.getTime();

        expect(scheduled).toMatchObject({
          check_names: [check.name],
          findings_count: 3,
          schedule_name: schedule.name,
          service_ids: [service.service_id],
          triggered_by: AdvisorTriggeredBy.scheduler,
          waited_for_run: null,
        });
        expect(Date.parse(scheduled.scheduled_for as string)).toEqual(due.at.getTime());
        expect(startedAfter).toBeGreaterThanOrEqual(0);
        expect(startedAfter).toBeLessThan(Timeouts.ONE_MINUTE);

        return scheduled;
      });

      await pmmTest.step('The report email says the schedule ran it', async () => {
        const email = await api.mailpitApi.waitForMessageTo(recipient);

        expect(email.Subject).toEqual(`PMM Advisor Insights: 3 finding(s) for ${schedule.name}`);
        expect(email.Text).toContain(
          `This report covers run ${run.id}, which was run automatically by the schedule '${schedule.name}'.`,
        );
      });

      await pmmTest.step('The Scheduler links the run, which Run history shows as on time', async () => {
        const openLastRun = advisorSchedulerPage.builders.openLastRun(schedule.schedule_id);

        await page.goto(advisorSchedulerPage.url);
        await expect(openLastRun).toHaveText('3 findings');
        await openLastRun.click();
        await expect(page).toHaveURL(new RegExp(`/advisors/runs\\?runId=${run.id}$`));
        await expect(advisorRunsPage.builders.row(run.id)).toContainText(schedule.name);
        await expect(advisorRunsPage.builders.row(run.id)).not.toContainText('User ·');
        await expect(advisorRunsPage.builders.startedLate(run.id)).toBeHidden();
      });
    },
  );

  pmmTest(
    'PMM-T2612 - Verify schedules that fall due during a run wait for it and start late @advisor-scheduling',
    async ({ advisorRunsPage, api, page }) => {
      const recipients = [MailpitApi.recipient('wait-first'), MailpitApi.recipient('wait-second')];
      const service = await api.advisorsApi.getMysqlService();
      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);

      const slowChecks = await api.advisorsApi.createEndlessChecks(40);
      const base = AdvisorsApi.scheduleName();
      const due = AdvisorsApi.nextDueMinute();

      createdChecks.push(...slowChecks);
      await api.settingsApi.updateSettings(notificationsOn);

      // Created in reverse, since schedules due in the same minute start by name.
      const [second, first] = [
        await api.advisorsApi.createDueSchedule(due.at, {
          check_names: [check.name],
          name: `${base} B`,
          service_ids: [service.service_id],
          ...AdvisorsApi.warningEmailTo(recipients[1]),
        }),
        await api.advisorsApi.createDueSchedule(due.at, {
          check_names: [check.name],
          name: `${base} A`,
          service_ids: [service.service_id],
          ...AdvisorsApi.warningEmailTo(recipients[0]),
        }),
      ];

      createdSchedules.push(second.schedule_id, first.schedule_id);

      // Each slow check takes at least 4 s, so the run ends at least 80 s after the schedules fall due:
      // a scheduled run that starts more than a minute late reports the run it waited for.
      const slowCount = Math.ceil((due.at.getTime() - Date.now() + 80_000) / Timeouts.FOUR_SECONDS);
      const userRunId = await api.advisorsApi.startChecks(slowChecks.slice(0, slowCount));
      const firstRun = await api.advisorsApi.waitForScheduledRun(first.schedule_id, Timeouts.FIVE_MINUTES);
      const secondRun = await api.advisorsApi.waitForScheduledRun(second.schedule_id);
      const userRun = (await api.advisorsApi.getRun(userRunId)) as AdvisorRun;

      await pmmTest.step('The schedules start after the user run, one after another by name', async () => {
        expect(Date.parse(userRun.started_at)).toBeLessThan(due.at.getTime());

        for (const run of [firstRun, secondRun]) {
          expect(Date.parse(run.scheduled_for as string)).toEqual(due.at.getTime());
        }

        expect(Date.parse(firstRun.started_at)).toBeGreaterThanOrEqual(
          Date.parse(userRun.finished_at as string),
        );
        expect(Date.parse(secondRun.started_at)).toBeGreaterThanOrEqual(
          Date.parse(firstRun.finished_at as string),
        );
        expect(firstRun.waited_for_run).toMatchObject({
          run_id: userRun.id,
          triggered_by: AdvisorTriggeredBy.user,
        });
        expect(secondRun.waited_for_run).toMatchObject({
          run_id: firstRun.id,
          schedule_name: first.name,
          triggered_by: AdvisorTriggeredBy.scheduler,
        });
      });

      await pmmTest.step('Each run emails its own schedule recipients', async () => {
        for (const [schedule, recipient] of [
          [first, recipients[0]],
          [second, recipients[1]],
        ] as const) {
          const email = await api.mailpitApi.waitForMessageTo(recipient);

          expect(email.Subject).toEqual(`PMM Advisor Insights: 3 finding(s) for ${schedule.name}`);
          expect(await api.mailpitApi.messagesTo(recipient)).toHaveLength(1);
        }
      });

      await pmmTest.step(
        'Run history marks both runs as started late and names the run they waited for',
        async () => {
          for (const [run, blocker, who] of [
            [firstRun, userRun, 'a user run'],
            [secondRun, firstRun, first.name],
          ] as const) {
            await page.goto(`${advisorRunsPage.url}?runId=${run.id}`);
            await advisorRunsPage.builders.startedLate(run.id).hover();
            await expect(advisorRunsPage.elements.tooltip).toHaveText(
              advisorRunsPage.startedLateTooltip(run, blocker, who),
            );
          }
        },
      );
    },
  );

  pmmTest(
    'PMM-T2613 - Verify a schedule with nothing to check records no run @advisor-scheduling',
    async ({ advisorSchedulerPage, api, page }) => {
      const service = await api.advisorsApi.getMysqlService();
      const check = await api.advisorsApi.createCustomCheck({ script: api.advisorsApi.passingCheckScript });
      const removed = await api.managementApi.addUnreachableMysql(`qa-unreachable-${Date.now()}`);

      createdChecks.push(check.name);
      createdNodes.add(removed.node_id);

      const base = AdvisorsApi.scheduleName();
      const due = AdvisorsApi.nextDueMinute();
      // Due in the same minute, the empty schedule starts first and the control one after it.
      const empty = await api.advisorsApi.createDueSchedule(due.at, {
        check_names: [check.name],
        name: `${base} A`,
        service_ids: [removed.service_id],
      });
      const control = await api.advisorsApi.createDueSchedule(due.at, {
        check_names: [check.name],
        name: `${base} B`,
        service_ids: [service.service_id],
      });

      createdSchedules.push(empty.schedule_id, control.schedule_id);
      await api.inventoryApi.deleteNode(removed.node_id, true);
      createdNodes.delete(removed.node_id);

      await pmmTest.step('Once the control schedule has run, the empty one has no run', async () => {
        await api.advisorsApi.waitForScheduledRun(control.schedule_id);
        expect(await api.advisorsApi.listRuns({ schedule_id: empty.schedule_id })).toEqual([]);
      });

      await pmmTest.step('The Scheduler shows the empty schedule never ran', async () => {
        await page.goto(advisorSchedulerPage.url);
        await expect(advisorSchedulerPage.builders.openLastRun(control.schedule_id)).toHaveText('0 findings');
        await expect(advisorSchedulerPage.builders.row(empty.schedule_id)).toContainText('Never run');
      });
    },
  );
});

pmmTest.describe('Advisor runs across pmm-managed restarts', () => {
  pmmTest(
    'PMM-T2614 - Verify a restart interrupts a run, which keeps the insights it saved @advisor-scheduling',
    async ({ advisorInsightsPage, advisorRunsPage, api, cliHelper, page }) => {
      const recipient = MailpitApi.recipient('interrupted');
      const service = await api.advisorsApi.getMysqlService();
      // A run executes its checks in name order, so this one runs before the slow ones.
      const prefix = AdvisorsApi.customCheckName();
      const check = await api.advisorsApi.createCustomCheck({ name: `${prefix}_a` });

      createdChecks.push(check.name);

      const slowChecks = await api.advisorsApi.createEndlessChecks(15, { namePrefix: `${prefix}_b` });
      // Disabled schedules never fall due, and a run of one emails the schedule's recipients.
      const emailed = {
        enabled: false,
        service_ids: [service.service_id],
        ...AdvisorsApi.warningEmailTo(recipient),
      };
      const interrupted = await api.advisorsApi.createSchedule({
        check_names: [check.name, ...slowChecks],
        ...emailed,
      });
      const following = await api.advisorsApi.createSchedule({ check_names: [check.name], ...emailed });

      createdChecks.push(...slowChecks);
      createdSchedules.push(interrupted.schedule_id, following.schedule_id);
      await api.settingsApi.updateSettings(notificationsOn);
      cliHelper.supervisorctl('restart');
      await api.serverApi.waitForReady();

      const runId = await api.advisorsApi.runSchedule(interrupted.schedule_id);
      const runInsights = async () => await api.advisorsApi.listInsights({ page_size: '100', run_id: runId });

      await pmmTest.step('Until PMM starts its run loop, the run is queued', async () => {
        expect((await api.advisorsApi.getRun(runId))?.status).toEqual(AdvisorRunStatus.queued);
        await page.goto(`${advisorRunsPage.url}?runId=${runId}`);
        await advisorRunsPage.builders.queuedLabel(runId).hover();
        await expect(advisorRunsPage.elements.tooltip).toHaveText(advisorRunsPage.tooltips.queued);
      });

      await pmmTest.step('Once it runs, the checks it has not reached are pending', async () => {
        await expect(advisorRunsPage.builders.row(runId)).toContainText('Running…', {
          timeout: Timeouts.TWO_MINUTES,
        });
        await page.goto(advisorInsightsPage.runUrl(runId));
        await expect(advisorInsightsPage.builders.rowsWithText('Pending')).not.toHaveCount(0);
      });

      const saved = await pmmTest.step('A restart after the first check interrupts the run', async () => {
        let insights: AdvisorInsight[] = [];

        await expect
          .poll(async () =>
            (insights = (await runInsights()).filter(({ check_name }) => check_name === check.name)).map(
              ({ status }) => status,
            ),
          )
          .toContain(AdvisorCheckResultStatus.failed);
        cliHelper.supervisorctl('restart');
        await api.serverApi.waitForReady();

        return insights;
      });

      await pmmTest.step(
        'The run keeps its findings and marks the checks it did not reach Not run',
        async () => {
          await expect
            .poll(async () => (await api.advisorsApi.getRun(runId))?.status)
            .toEqual(AdvisorRunStatus.interrupted);

          const insights = await runInsights();
          const kept = insights.filter(({ check_name }) => check_name === check.name);
          const notRun = insights.filter(({ status }) => status === AdvisorCheckResultStatus.notRun);

          expect((await api.advisorsApi.getRun(runId))?.findings_count).toEqual(3);
          expect(kept.map(({ id }) => id).sort()).toEqual(saved.map(({ id }) => id).sort());
          expect(kept.map(({ status }) => status)).toEqual(kept.map(() => AdvisorCheckResultStatus.failed));
          expect(insights.map(({ status }) => status)).not.toContain(AdvisorCheckResultStatus.pending);
          expect(notRun.length).toBeGreaterThan(0);

          for (const { outcome } of notRun) {
            expect(outcome).toEqual(
              'The run ended before executing the check, for example because PMM restarted.',
            );
          }

          await page.goto(`${advisorRunsPage.url}?runId=${runId}`);
          await advisorRunsPage.builders.interrupted(runId).hover();
          await expect(advisorRunsPage.elements.tooltip).toHaveText(advisorRunsPage.tooltips.interrupted);
          await page.goto(advisorInsightsPage.runUrl(runId));
          await expect(advisorInsightsPage.builders.row(kept[0].id)).toBeVisible();
          await expect(advisorInsightsPage.builders.row(notRun[0].id)).toContainText('Not run');
        },
      );

      await pmmTest.step('Only the next run, which completes, is emailed', async () => {
        const next = await api.advisorsApi.waitForRun(
          await api.advisorsApi.runSchedule(following.schedule_id),
        );
        const email = await api.mailpitApi.waitForMessageTo(recipient);

        expect(email.Text).toContain(`This report covers run ${next.id},`);
        expect(await api.mailpitApi.messagesTo(recipient)).toHaveLength(1);
      });
    },
  );

  pmmTest(
    'PMM-T2615 - Verify PMM starts no run of its own after a restart and skips a schedule missed while stopped @advisor-scheduling',
    async ({ advisorSchedulerPage, api, cliHelper, page }) => {
      const service = await api.advisorsApi.getMysqlService();
      const check = await api.advisorsApi.createCustomCheck({ script: api.advisorsApi.passingCheckScript });
      const base = AdvisorsApi.scheduleName();
      const due = AdvisorsApi.nextDueMinute();
      const controlDueAt = due.at.getTime() + Timeouts.ONE_MINUTE;

      createdChecks.push(check.name);

      const missed = await api.advisorsApi.createDueSchedule(due.at, {
        check_names: [check.name],
        name: `${base} missed`,
        service_ids: [service.service_id],
      });
      const control = await api.advisorsApi.createDueSchedule(new Date(controlDueAt), {
        check_names: [check.name],
        name: `${base} control`,
        service_ids: [service.service_id],
      });
      const stoppedAt = Date.now();

      createdSchedules.push(missed.schedule_id, control.schedule_id);
      cliHelper.supervisorctl('stop');
      pmmManagedStopped = true;

      await pmmTest.step('pmm-managed is stopped when the first schedule falls due', async () => {
        await expect
          .poll(() => Date.now(), { timeout: Timeouts.TWO_MINUTES })
          .toBeGreaterThan(due.at.getTime() + Timeouts.FIVE_SECONDS);
        cliHelper.supervisorctl('start');
        pmmManagedStopped = false;
        await api.serverApi.waitForReady();
      });

      await pmmTest.step('Turning Advisors off and on before the next schedule falls due', async () => {
        for (const enabled of [false, true]) {
          await api.settingsApi.updateSettings({ enable_advisor: enabled });
        }
      });

      await pmmTest.step('Only the schedule falling due after the start runs', async () => {
        const run = await api.advisorsApi.waitForScheduledRun(control.schedule_id);
        const ours = [missed.schedule_id, control.schedule_id];
        const runsSinceStop = (await api.advisorsApi.listRuns()).filter(
          ({ schedule_id, started_at }) =>
            Date.parse(started_at) >= stoppedAt && (!schedule_id || ours.includes(schedule_id)),
        );
        const missedNow = await api.advisorsApi.findSchedule(missed.name);

        expect(Date.parse(run.scheduled_for as string)).toEqual(controlDueAt);
        expect(runsSinceStop.map(({ id }) => id)).toEqual([run.id]);
        expect(Date.parse(missedNow?.next_run_at as string)).toEqual(
          due.at.getTime() + 24 * Timeouts.SIXTY_MINUTES,
        );
      });

      await pmmTest.step('The Scheduler shows the missed schedule never ran', async () => {
        await page.goto(advisorSchedulerPage.url);
        await expect(advisorSchedulerPage.builders.openLastRun(control.schedule_id)).toHaveText('0 findings');
        await expect(advisorSchedulerPage.builders.row(missed.schedule_id)).toContainText('Never run');
      });
    },
  );
});

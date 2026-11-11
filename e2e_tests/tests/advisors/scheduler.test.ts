import pmmTest from '@fixtures/pmmTest';
import AdvisorsApi from '@api/advisors.api';
import {
  AdvisorCheckResultStatus,
  AdvisorCheckTechnology,
  AdvisorSchedule,
  AdvisorScheduleEmailMode,
} from '@interfaces/advisors';
import { expect } from '@playwright/test';

const defaultSchedule = {
  check_names: [],
  days_of_week: [0, 1, 2, 3, 4, 5, 6],
  email_mode: AdvisorScheduleEmailMode.settings,
  enabled: true,
  name: 'All checks daily',
  service_ids: [],
  time_of_day: '06:00',
};

pmmTest.describe('Advisor scheduler', () => {
  const createdChecks: string[] = [];
  const createdNodes = new Set<string>();
  const createdSchedules: string[] = [];
  const weekdays = [1, 2, 3, 4, 5];
  let savedSchedules: AdvisorSchedule[] | undefined;

  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest.afterEach(async ({ api }) => {
    if (!(await api.settingsApi.getSettings()).settings.advisor_enabled) {
      await api.settingsApi.updateSettings({ enable_advisor: true });
    }
    if (savedSchedules) await api.advisorsApi.restoreSchedules(savedSchedules);

    savedSchedules = undefined;

    for (const scheduleId of createdSchedules.splice(0)) await api.advisorsApi.deleteSchedule(scheduleId);
    for (const nodeId of createdNodes) await api.inventoryApi.deleteNode(nodeId, true);

    createdNodes.clear();
    await api.advisorsApi.waitForNoActiveRun();

    for (const name of createdChecks.splice(0)) await api.advisorsApi.deleteCheck(name);
  });

  pmmTest(
    'PMM-Txxxx - Verify the default "All checks daily" schedule @advisors',
    async ({ advisorSchedulerPage, api, page }) => {
      const schedule = await api.advisorsApi.findSchedule(defaultSchedule.name);

      expect(schedule, 'The default schedule is missing').toMatchObject(defaultSchedule);

      await page.goto(advisorSchedulerPage.url);

      const row = advisorSchedulerPage.builders.row((schedule as AdvisorSchedule).schedule_id);

      await expect(advisorSchedulerPage.elements.title).toBeVisible();

      for (const text of ['Every day, 06:00 UTC', 'All checks', 'All services', 'Settings recipients']) {
        await expect(row).toContainText(text);
      }

      await expect(advisorSchedulerPage.messages.notificationsOff).toBeVisible();
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify the empty Scheduler and turning Advisors off and on @advisors',
    async ({ advisorSchedulerPage, api, leftNavigation, page }) => {
      const { advisorsMenu } = leftNavigation.elements;

      savedSchedules = await api.advisorsApi.listSchedules();

      await pmmTest.step('Without schedules the page offers to create the default one', async () => {
        await api.advisorsApi.deleteAllSchedules();
        await page.goto(advisorSchedulerPage.url);
        await expect(advisorSchedulerPage.elements.empty).toContainText('No schedules');
        await expect(advisorSchedulerPage.messages.emptyWeek).toBeVisible();
        await advisorSchedulerPage.buttons.restoreDefault.click();
        await expect(advisorSchedulerPage.elements.empty).toBeHidden();
        await expect
          .poll(() => api.advisorsApi.findSchedule(defaultSchedule.name))
          .toMatchObject(defaultSchedule);
      });

      await pmmTest.step('With Advisors off, schedules are kept and nothing runs', async () => {
        const { schedule_id } = (await api.advisorsApi.findSchedule(defaultSchedule.name)) as AdvisorSchedule;

        await api.settingsApi.updateSettings({ enable_advisor: false });
        await page.reload();
        await expect(advisorSchedulerPage.messages.advisorsOff).toBeVisible();
        await expect(advisorSchedulerPage.builders.row(schedule_id)).toContainText('Advisors are off');
        await expect(advisorSchedulerPage.messages.offWeek).toBeVisible();
        await expect(advisorsMenu).toBeHidden();

        const start = await api.advisorsApi.requestStartChecks();

        expect(start.status()).toEqual(400);
        expect(await start.text()).toContain('advisor checks are disabled.');
      });

      await pmmTest.step('Turning Advisors on without schedules creates the default one', async () => {
        await api.advisorsApi.deleteAllSchedules();
        await api.settingsApi.updateSettings({ enable_advisor: true });
        expect(await api.advisorsApi.findSchedule(defaultSchedule.name)).toMatchObject(defaultSchedule);
        await page.reload();
        await expect(advisorSchedulerPage.elements.advisorsOffBanner).toBeHidden();
        await expect(advisorsMenu).toBeVisible();
      });
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify user schedules survive turning Advisors off and on @advisors',
    async ({ advisorSchedulerPage, api, page }) => {
      const schedule = await api.advisorsApi.createSchedule({
        days_of_week: [1, 3, 5],
        time_of_day: '11:30',
      });
      const row = advisorSchedulerPage.builders.row(schedule.schedule_id);

      createdSchedules.push(schedule.schedule_id);

      const before = await api.advisorsApi.listSchedules();

      await pmmTest.step('With Advisors off, the Scheduler keeps the schedule', async () => {
        await api.settingsApi.updateSettings({ enable_advisor: false });
        await page.goto(advisorSchedulerPage.url);
        await expect(row).toContainText(schedule.name);
        await expect(row).toContainText('Advisors are off');
      });

      await pmmTest.step('Turning Advisors on brings the schedules back unchanged', async () => {
        await api.settingsApi.updateSettings({ enable_advisor: true });

        const after = await api.advisorsApi.listSchedules();

        expect(after.map(({ schedule_id }) => schedule_id)).toEqual(
          before.map(({ schedule_id }) => schedule_id),
        );
        expect(after.find(({ schedule_id }) => schedule_id === schedule.schedule_id)).toMatchObject({
          days_of_week: [1, 3, 5],
          enabled: true,
          name: schedule.name,
          time_of_day: '11:30',
        });
        await page.reload();
        await expect(advisorSchedulerPage.elements.advisorsOffBanner).toBeHidden();
        await expect(row).toContainText(schedule.name);
      });
    },
  );

  pmmTest('PMM-Txxxx - Verify creating a schedule @advisors', async ({ advisorSchedulerPage, api, page }) => {
    const check = await api.advisorsApi.createCustomCheck();
    const service = await api.advisorsApi.getMysqlService();
    const name = AdvisorsApi.scheduleName();
    const { editor } = advisorSchedulerPage;

    createdChecks.push(check.name);
    await page.goto(advisorSchedulerPage.url);

    await pmmTest.step('Create a weekday schedule for one check and one service', async () => {
      await advisorSchedulerPage.buttons.newSchedule.click();
      await expect(editor.messages.createTitle).toBeVisible();
      await editor.fill({
        checkNames: [check.name],
        days: weekdays,
        name,
        serviceIds: [service.service_id],
        time: '10:00',
      });
      await expect(editor.elements.preview).toContainText(editor.weekdayPreview('10:00'));
      await editor.buttons.save.click();
      await expect(advisorSchedulerPage.builders.created(name)).toBeVisible();
    });

    const schedule = await pmmTest.step('The API returns the new schedule', async () => {
      const created = await api.advisorsApi.findSchedule(name);

      expect(created).toMatchObject({
        check_names: [check.name],
        days_of_week: weekdays,
        enabled: true,
        service_ids: [service.service_id],
        time_of_day: '10:00',
      });
      createdSchedules.push((created as AdvisorSchedule).schedule_id);

      return created as AdvisorSchedule;
    });

    await pmmTest.step('The table and the week view show the schedule', async () => {
      const row = advisorSchedulerPage.builders.row(schedule.schedule_id);

      for (const text of ['Mon–Fri, 10:00 UTC', '1 check', '1 service', service.service_name, '10:00 UTC']) {
        await expect(row).toContainText(text);
      }

      await expect(advisorSchedulerPage.builders.weekMarks(schedule.schedule_id)).toHaveCount(
        weekdays.length,
      );
    });
  });

  pmmTest(
    'PMM-Txxxx - Verify schedule editor validation @advisors',
    async ({ advisorSchedulerPage, api, page }) => {
      const existing = await api.advisorsApi.createSchedule();
      const { editor } = advisorSchedulerPage;
      const takenName = existing.name.toUpperCase();

      createdSchedules.push(existing.schedule_id);

      const scheduleCount = (await api.advisorsApi.listSchedules()).length;

      await page.goto(advisorSchedulerPage.url);
      await advisorSchedulerPage.buttons.newSchedule.click();

      await pmmTest.step('Saving an empty form highlights every field', async () => {
        await editor.setDays([]);
        await editor.inputs.time.fill('');
        await editor.builders.scope('Selected checks').check();
        await editor.builders.scope('Selected services').check();
        await editor.inputs.ownRecipients.check();
        await editor.inputs.severitiesOnlyThese.check();
        await editor.builders.severity('critical').uncheck();
        await editor.builders.severity('error').uncheck();
        await editor.buttons.save.click();

        for (const message of [
          editor.messages.nameRequired,
          editor.messages.noDays,
          editor.messages.timeInvalid,
          editor.messages.noChecks,
          editor.messages.noServices,
          editor.messages.emailRequired,
          editor.messages.noSeverities,
        ]) {
          await expect(message).toBeVisible();
        }

        await expect(
          editor.builders.fixFields(['name', 'days', 'time', 'checks', 'services', 'email', 'severities']),
        ).toBeVisible();
      });

      await pmmTest.step('Names are unique ignoring case and at most 100 characters', async () => {
        await editor.inputs.name.fill(takenName);
        await expect(editor.builders.nameTaken(takenName)).toBeVisible();
        await editor.inputs.name.fill('a'.repeat(101));
        await expect(editor.inputs.name).toHaveValue('a'.repeat(100));
      });

      await pmmTest.step('Recipients must be valid addresses, at most 20', async () => {
        await editor.inputs.emailAddresses.fill('qa@example.com, not-an-email');
        await expect(editor.builders.emailInvalid('not-an-email')).toBeVisible();
        await editor.inputs.emailAddresses.fill(
          Array.from({ length: 21 }, (_, i) => `qa${i}@example.com`).join(' '),
        );
        await expect(editor.builders.emailMax(21)).toBeVisible();
      });

      await pmmTest.step('Nothing is saved while a field is invalid', async () => {
        await editor.buttons.save.click();
        await expect(
          editor.builders.fixFields(['days', 'time', 'checks', 'services', 'email', 'severities']),
        ).toBeVisible();
        await editor.buttons.cancel.click();
        await expect(editor.elements.editor).toBeHidden();
        expect(await api.advisorsApi.listSchedules()).toHaveLength(scheduleCount);
      });
    },
  );

  pmmTest('PMM-Txxxx - Verify editing a schedule @advisors', async ({ advisorSchedulerPage, api, page }) => {
    const schedule = await api.advisorsApi.createSchedule();
    const service = await api.advisorsApi.getMysqlService();
    const { editor } = advisorSchedulerPage;
    const row = advisorSchedulerPage.builders.row(schedule.schedule_id);

    createdSchedules.push(schedule.schedule_id);
    await page.goto(advisorSchedulerPage.url);

    await pmmTest.step('Change the days, the time and the services', async () => {
      await advisorSchedulerPage.openAction(schedule.schedule_id, 'edit');
      await expect(editor.messages.editTitle).toBeVisible();
      await expect(editor.inputs.name).toHaveValue(schedule.name);
      await editor.fill({
        days: [1, 3, 5],
        name: schedule.name,
        serviceIds: [service.service_id],
        time: '11:30',
      });
      await editor.buttons.save.click();
      await expect(advisorSchedulerPage.builders.saved(schedule.name)).toBeVisible();
    });

    await pmmTest.step('The table and the API show the change', async () => {
      for (const text of ['Mon, Wed, Fri, 11:30 UTC', '1 service', service.service_name]) {
        await expect(row).toContainText(text);
      }

      expect(await api.advisorsApi.findSchedule(schedule.name)).toMatchObject({
        days_of_week: [1, 3, 5],
        service_ids: [service.service_id],
        time_of_day: '11:30',
      });
    });
  });

  pmmTest(
    'PMM-Txxxx - Verify pausing and enabling a schedule @advisors',
    async ({ advisorSchedulerPage, api, page }) => {
      const schedule = await api.advisorsApi.createSchedule();
      const enabledSwitch = advisorSchedulerPage.builders.enabledSwitch(schedule.schedule_id);
      const marks = advisorSchedulerPage.builders.weekMarks(schedule.schedule_id);

      createdSchedules.push(schedule.schedule_id);
      await page.goto(advisorSchedulerPage.url);
      await expect(enabledSwitch).toBeChecked();
      await expect(marks).toHaveCount(weekdays.length);

      await pmmTest.step('Pause the schedule', async () => {
        await enabledSwitch.click();
        await expect(advisorSchedulerPage.builders.paused(schedule.name)).toBeVisible();
        await expect(enabledSwitch).not.toBeChecked();
        await expect(advisorSchedulerPage.builders.row(schedule.schedule_id)).toContainText('Paused');
        await expect(marks).toHaveCount(0);
        expect((await api.advisorsApi.findSchedule(schedule.name))?.enabled).toBe(false);
      });

      await pmmTest.step('Enable the schedule', async () => {
        await enabledSwitch.click();
        await expect(advisorSchedulerPage.builders.enabled(schedule.name)).toBeVisible();
        await expect(enabledSwitch).toBeChecked();
        await expect(marks).toHaveCount(weekdays.length);
        expect((await api.advisorsApi.findSchedule(schedule.name))?.enabled).toBe(true);
      });
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify a duplicated schedule starts paused @advisors',
    async ({ advisorSchedulerPage, api, page }) => {
      const service = await api.advisorsApi.getMysqlService();
      const schedule = await api.advisorsApi.createSchedule({
        email_addresses: ['qa@example.com'],
        email_mode: AdvisorScheduleEmailMode.custom,
        service_ids: [service.service_id],
      });
      const copyName = `${schedule.name} (copy)`;

      createdSchedules.push(schedule.schedule_id);
      await page.goto(advisorSchedulerPage.url);
      await advisorSchedulerPage.openAction(schedule.schedule_id, 'duplicate');
      await expect(advisorSchedulerPage.builders.duplicated(copyName)).toBeVisible();

      const copy = (await api.advisorsApi.findSchedule(copyName)) as AdvisorSchedule;

      expect(copy, `${copyName} was not created`).toBeDefined();
      createdSchedules.push(copy.schedule_id);
      expect(copy).toMatchObject({
        check_names: schedule.check_names,
        days_of_week: schedule.days_of_week,
        email_addresses: schedule.email_addresses,
        email_mode: schedule.email_mode,
        enabled: false,
        service_ids: schedule.service_ids,
        time_of_day: schedule.time_of_day,
      });
      await expect(advisorSchedulerPage.builders.enabledSwitch(copy.schedule_id)).not.toBeChecked();
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify Run now, View runs and deleting a schedule that has run @advisors',
    async ({ advisorRunsPage, advisorSchedulerPage, api, page }) => {
      const check = await api.advisorsApi.createCustomCheck();
      const service = await api.advisorsApi.getMysqlService();
      const schedule = await api.advisorsApi.createSchedule({
        check_names: [check.name],
        service_ids: [service.service_id],
      });

      createdChecks.push(check.name);
      createdSchedules.push(schedule.schedule_id);
      await page.goto(advisorSchedulerPage.url);

      const run = await pmmTest.step('Run now covers only the schedule scope', async () => {
        const started = page.waitForResponse(
          (response) => response.url().endsWith(`${schedule.schedule_id}:run`) && response.ok(),
        );

        await advisorSchedulerPage.openAction(schedule.schedule_id, 'runNow');
        await expect(advisorSchedulerPage.builders.started(schedule.name)).toBeVisible();

        const completed = await api.advisorsApi.waitForRun(
          ((await (await started).json()) as { run_id: string }).run_id,
        );

        expect(completed).toMatchObject({
          check_names: [check.name],
          planned_checks_count: 1,
          planned_services_count: 1,
          schedule_id: schedule.schedule_id,
          schedule_name: schedule.name,
        });

        return completed;
      });

      await pmmTest.step('View runs opens Run history filtered by the schedule', async () => {
        await advisorSchedulerPage.openAction(schedule.schedule_id, 'viewRuns');
        await expect(page).toHaveURL(new RegExp(`scheduleId=${schedule.schedule_id}`));
        await expect(advisorRunsPage.inputs.schedule).toHaveText(schedule.name);
        await expect(advisorRunsPage.builders.row(run.id)).toContainText(`User · ${schedule.name}`);
        await expect(advisorRunsPage.elements.rows).toHaveCount(1);
      });

      await pmmTest.step('Delete the schedule', async () => {
        await page.goto(advisorSchedulerPage.url);
        await advisorSchedulerPage.openAction(schedule.schedule_id, 'delete');
        await expect(advisorSchedulerPage.builders.deleteTitle(schedule.name)).toBeVisible();
        await expect(advisorSchedulerPage.messages.deleteNotLast).toBeVisible();
        await advisorSchedulerPage.buttons.confirmDelete.click();
        await expect(advisorSchedulerPage.builders.deleted(schedule.name)).toBeVisible();
        await expect(advisorSchedulerPage.builders.row(schedule.schedule_id)).toBeHidden();
        expect(await api.advisorsApi.findSchedule(schedule.name)).toBeUndefined();
      });

      await pmmTest.step('Run history keeps the run under the old name', async () => {
        await page.goto(`${advisorRunsPage.url}?scheduleId=${schedule.schedule_id}`);
        await expect(advisorRunsPage.inputs.schedule).toHaveText('Deleted schedule');
        await advisorRunsPage.buttons.clearFilters.click();
        await advisorRunsPage.runIdFilter.apply(run.id);
        await expect(advisorRunsPage.builders.row(run.id)).toContainText(`User · ${schedule.name}`);
      });
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify a second run cannot start while one is active @advisors',
    async ({ advisorsCatalogPage, advisorSchedulerPage, api, page }) => {
      const schedule = await api.advisorsApi.createSchedule();

      createdSchedules.push(schedule.schedule_id);

      // About 30 s of checks, so the run outlasts the test.
      const slowChecks = await api.advisorsApi.createEndlessChecks(8);

      createdChecks.push(...slowChecks);

      const runId = await api.advisorsApi.startChecks(slowChecks);

      await pmmTest.step('The API refuses to start another run', async () => {
        for (const response of [
          await api.advisorsApi.requestStartChecks(),
          await api.advisorsApi.requestRunSchedule(schedule.schedule_id),
        ]) {
          expect(response.status()).toEqual(400);
          expect(await response.text()).toMatch(
            /Advisor checks are already running \(started .+ by a user\)/,
          );
        }
      });

      await pmmTest.step('The Scheduler shows the active run and blocks Run now', async () => {
        await page.goto(advisorSchedulerPage.url);
        await expect(advisorSchedulerPage.messages.runActiveProgress).toBeVisible();
        await advisorSchedulerPage.builders.actionsButton(schedule.schedule_id).click();
        await expect(advisorSchedulerPage.buttons.runNow).toBeDisabled();
        await page.keyboard.press('Escape');
        await advisorSchedulerPage.buttons.openActiveRun.click();
        await expect(page).toHaveURL(new RegExp(`/advisors/runs\\?runId=${runId}$`));
      });

      await pmmTest.step('Run all in the Catalog reports the active run', async () => {
        await page.goto(advisorsCatalogPage.url);
        await advisorsCatalogPage.buttons.runAll.click();
        await expect(advisorsCatalogPage.messages.checksAlreadyRunning).toBeVisible();
      });
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify a schedule resolves its checks and services when it runs @advisors',
    async ({ advisorRunsPage, advisorSchedulerPage, api, page }) => {
      const queryCheck = await api.advisorsApi.createCustomCheck({
        queries: [{ query: '1', type: 'MYSQL_SELECT' }],
        script: api.advisorsApi.passingCheckScript,
      });
      const disabledCheck = await api.advisorsApi.createCustomCheck();

      createdChecks.push(queryCheck.name, disabledCheck.name);

      const first = await api.managementApi.addUnreachableMysql(`qa-unreachable-${Date.now()}-1`);
      const second = await api.managementApi.addUnreachableMysql(`qa-unreachable-${Date.now()}-2`);

      createdNodes.add(first.node_id).add(second.node_id);

      const byServices = await api.advisorsApi.createSchedule({
        check_names: [queryCheck.name, disabledCheck.name],
        service_ids: [first.service_id, second.service_id],
      });
      const byCheck = await api.advisorsApi.createSchedule({ check_names: [queryCheck.name] });

      createdSchedules.push(byServices.schedule_id, byCheck.schedule_id);

      await pmmTest.step(
        'A run skips checks disabled in the Catalog and reports unreachable services',
        async () => {
          await api.advisorsApi.changeCheck(disabledCheck.name, { enable: false });

          const run = await api.advisorsApi.waitForRun(
            await api.advisorsApi.runSchedule(byServices.schedule_id),
          );
          const insights = await api.advisorsApi.listInsights({ run_id: run.id });

          expect(run).toMatchObject({ planned_checks_count: 1, planned_services_count: 2 });
          expect(insights).toHaveLength(2);

          for (const insight of insights) {
            expect(insight).toMatchObject({
              check_name: queryCheck.name,
              status: AdvisorCheckResultStatus.error,
            });
            expect(insight.outcome).toContain('connect: connection refused');
          }
        },
      );

      await pmmTest.step('A service added after the schedule was saved joins its next run', async () => {
        const { planned_services_count: servicesBefore } = await api.advisorsApi.waitForRun(
          await api.advisorsApi.runSchedule(byCheck.schedule_id),
        );
        const third = await api.managementApi.addUnreachableMysql(`qa-unreachable-${Date.now()}-3`);

        createdNodes.add(third.node_id);

        const run = await api.advisorsApi.waitForRun(await api.advisorsApi.runSchedule(byCheck.schedule_id));

        expect(run.planned_services_count).toEqual(servicesBefore + 1);
        await page.goto(`${advisorRunsPage.url}?runId=${run.id}`);
        await expect(advisorRunsPage.builders.services(run.id)).toHaveText(
          new RegExp(`/${servicesBefore + 1}$`),
        );
      });

      await pmmTest.step('Removed services are flagged on the schedule', async () => {
        const services = advisorSchedulerPage.builders.row(byServices.schedule_id);

        await page.goto(advisorSchedulerPage.url);
        await expect(services).toContainText('2 services');
        await api.inventoryApi.deleteNode(first.node_id, true);
        createdNodes.delete(first.node_id);
        await page.reload();
        await expect(services).toContainText('1 of 2 services');
        await api.inventoryApi.deleteNode(second.node_id, true);
        createdNodes.delete(second.node_id);
        await page.reload();
        await expect(advisorSchedulerPage.builders.targetsNothing(byServices.schedule_id)).toHaveText(
          advisorSchedulerPage.targetsNoService,
        );
      });

      await pmmTest.step('A removed check is flagged on the schedule', async () => {
        await expect(advisorSchedulerPage.builders.targetsNothing(byCheck.schedule_id)).toBeHidden();
        await api.advisorsApi.deleteCheck(queryCheck.name);
        await page.reload();
        await expect(advisorSchedulerPage.builders.targetsNothing(byCheck.schedule_id)).toHaveText(
          advisorSchedulerPage.targetsNoCheck,
        );
      });
    },
  );
});

pmmTest.describe('Advisor schedule editor in another time zone', () => {
  // Japan has no daylight saving time, so 23:00 UTC is always 08:00 the next day there.
  pmmTest.use({ timezoneId: 'Asia/Tokyo' });

  const createdChecks: string[] = [];

  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest.afterEach(async ({ api }) => {
    for (const name of createdChecks.splice(0)) await api.advisorsApi.deleteCheck(name);
  });

  pmmTest(
    'PMM-Txxxx - Verify the schedule editor shows local times and coverage warnings @advisors',
    async ({ advisorSchedulerPage, api, page }) => {
      const mysqlCheck = await api.advisorsApi.createCustomCheck();
      const postgresqlCheck = await api.advisorsApi.createCustomCheck({
        technology: AdvisorCheckTechnology.postgresql,
      });
      const service = await api.advisorsApi.getMysqlService();
      const { editor } = advisorSchedulerPage;

      createdChecks.push(mysqlCheck.name, postgresqlCheck.name);
      await page.goto(advisorSchedulerPage.url);
      await advisorSchedulerPage.buttons.newSchedule.click();

      await pmmTest.step('The preview shows each run in UTC and in the local time zone', async () => {
        await editor.fill({ days: [1, 2, 3, 4, 5], name: AdvisorsApi.scheduleName(), time: '23:00' });
        await expect(editor.elements.preview).toContainText(
          editor.weekdayPreview('23:00', { time: '08:00', zone: 'Asia/Tokyo' }),
        );
        await expect(editor.elements.preview).toContainText(editor.nextDayNote);
        await expect(editor.elements.preview).not.toContainText('daylight saving');
        await expect(editor.elements.previewRuns).toContainText('08:00 your time');
      });

      await pmmTest.step('A check with no service of its technology is flagged', async () => {
        expect(
          (await api.advisorsApi.listServices()).map(({ technology }) => technology),
          'PMM Server must monitor no PostgreSQL service',
        ).not.toContain(AdvisorCheckTechnology.postgresql);
        await editor.fill({ checkNames: [mysqlCheck.name, postgresqlCheck.name] });
        await expect(editor.elements.coverageIdle).toHaveText(editor.idleChecksWarning(1, 'PostgreSQL'));
      });

      await pmmTest.step('Checks that apply to none of the selected services are flagged', async () => {
        await editor.builders.checkOption(mysqlCheck.name).uncheck();
        await editor.fill({ serviceIds: [service.service_id] });
        await expect(editor.elements.coverageNothing).toHaveText(editor.nothingToDoWarning('MySQL'));
        await editor.buttons.cancel.click();
      });
    },
  );
});

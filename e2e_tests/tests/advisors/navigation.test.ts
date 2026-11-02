import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.describe('Advisors navigation and settings', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-Txxxx - Verify the Advisors menu opens Insights, Catalog, Run history and Scheduler @advisors',
    async ({
      advisorInsightsPage,
      advisorRunsPage,
      advisorsCatalogPage,
      advisorSchedulerPage,
      leftNavigation,
      page,
    }) => {
      await page.goto('pmm-ui');

      await leftNavigation.selectMenuItem('advisors.insights');
      await expect(page).toHaveURL(/\/pmm-ui\/advisors\/insights$/);
      await expect(advisorInsightsPage.elements.title).toBeVisible();

      await leftNavigation.selectMenuItem('advisors.catalog');
      await expect(page).toHaveURL(/\/pmm-ui\/advisors$/);
      await expect(advisorsCatalogPage.elements.title).toBeVisible();

      await leftNavigation.selectMenuItem('advisors.runHistory');
      await expect(page).toHaveURL(/\/pmm-ui\/advisors\/runs$/);
      await expect(advisorRunsPage.elements.title).toBeVisible();

      await leftNavigation.selectMenuItem('advisors.scheduler');
      await expect(page).toHaveURL(/\/pmm-ui\/advisors\/scheduler$/);
      await expect(advisorSchedulerPage.elements.title).toBeVisible();
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify double-clicking a row on every Advisor table and the schedule details link @advisors',
    async ({
      advisorInsightsPage,
      advisorRunsPage,
      advisorsCatalogPage,
      advisorSchedulerPage,
      api,
      page,
    }) => {
      const check = await api.advisorsApi.createCustomCheck();
      let scheduleId = '';

      try {
        const run = await api.advisorsApi.runChecksAndWait([check.name]);
        const [insight] = await api.advisorsApi.listInsights({ run_id: run.id });
        const schedule = await api.advisorsApi.createSchedule({ check_names: [check.name] });

        scheduleId = schedule.schedule_id;

        await pmmTest.step('Catalog: a row opens the check details', async () => {
          await page.goto(advisorsCatalogPage.url);
          await advisorsCatalogPage.inputs.search.fill(check.summary);
          await advisorsCatalogPage.builders.row(check.name).dblclick();
          await expect(advisorsCatalogPage.elements.detailsPane).toBeVisible();
          await expect(page).toHaveURL(new RegExp(`details=${check.name}`));
        });

        await pmmTest.step('Insights: a row opens the insight details', async () => {
          await page.goto(advisorInsightsPage.runUrl(run.id));
          await advisorInsightsPage.builders.row(insight.id).dblclick();
          await expect(advisorInsightsPage.elements.detailsPane).toBeVisible();
          await expect(page).toHaveURL(new RegExp(`insight=${insight.id}`));
        });

        await pmmTest.step('Run history: a row opens the insights of the run', async () => {
          await page.goto(advisorRunsPage.url);
          await advisorRunsPage.filterByRunId(run.id);
          await advisorRunsPage.builders.row(run.id).dblclick();
          await expect(page).toHaveURL(advisorInsightsPage.runUrl(run.id));
          await expect(advisorInsightsPage.builders.row(insight.id)).toBeVisible();
        });

        await pmmTest.step('Scheduler: a row opens the schedule details', async () => {
          await page.goto(advisorSchedulerPage.url);
          await advisorSchedulerPage.builders.row(scheduleId).dblclick();
          await expect(advisorSchedulerPage.elements.detailsPane).toBeVisible();
          await expect(page).toHaveURL(new RegExp(`details=${scheduleId}`));
        });

        await pmmTest.step('Scheduler: the details link opens the same pane', async () => {
          await page.goto(advisorSchedulerPage.detailsUrl(scheduleId));
          await expect(advisorSchedulerPage.elements.detailsPane).toContainText(schedule.name);
          await expect(advisorSchedulerPage.builders.detailsSection('summary')).toContainText(
            'Mon–Fri at 10:00 UTC',
          );
          await expect(advisorSchedulerPage.builders.detailsSection('summary')).toContainText('1 selected');

          for (const section of ['next-runs', 'coverage', 'checks', 'recent-runs'] as const) {
            await expect(advisorSchedulerPage.builders.detailsSection(section)).toBeVisible();
          }

          await expect(advisorSchedulerPage.builders.detailsSection('recent-runs')).toContainText(
            'This schedule has not run yet.',
          );
        });
      } finally {
        if (scheduleId) await api.advisorsApi.deleteSchedule(scheduleId);

        await api.advisorsApi.deleteCheck(check.name);
      }
    },
  );

  pmmTest('PMM-Txxxx - Verify legacy Advisors URLs redirect to the new pages @advisors', async ({ page }) => {
    const redirects = [
      { from: 'graph/advisors', to: /\/pmm-ui\/advisors$/ },
      { from: 'graph/advisors/configuration', to: /\/pmm-ui\/advisors$/ },
      { from: 'graph/advisors/insights', to: /\/pmm-ui\/advisors\/insights$/ },
      { from: 'graph/pmm-database-checks', to: /\/pmm-ui\/advisors\/insights$/ },
      { from: 'graph/pmm-database-checks/all-checks', to: /\/pmm-ui\/advisors$/ },
    ];

    for (const { from, to } of redirects) {
      await pmmTest.step(`${from} redirects`, async () => {
        await page.goto(from);
        await expect(page).toHaveURL(to);
      });
    }
  });

  pmmTest('PMM-Txxxx - Verify the Advisors settings tab @advisors', async ({ page, settingsPage }) => {
    await page.goto(settingsPage.url);
    await settingsPage.tabs.advisors.click();
    await expect(page).toHaveURL(new RegExp(`${settingsPage.urls.advisors}$`));

    await pmmTest.step('Verify the default state of the tab', async () => {
      for (const element of [
        settingsPage.elements.advisorsLabel,
        settingsPage.elements.advisorRetentionLabel,
        settingsPage.elements.advisorNotificationsLabel,
        settingsPage.inputs.advisorRetention,
      ]) {
        await expect(element).toBeVisible();
      }

      await expect(settingsPage.buttons.toggles.advisors.input).toBeChecked();
      await expect(settingsPage.buttons.toggles.advisorNotifications.input).not.toBeChecked();
      await expect(settingsPage.buttons.applyAdvisorsChanges).toBeDisabled();
    });

    await pmmTest.step('Turning notifications on shows the email defaults', async () => {
      await settingsPage.buttons.toggles.advisorNotifications.input.click();

      for (const severity of ['critical', 'error'] as const) {
        await expect(settingsPage.builders.advisorSeverity(severity)).toBeChecked();
      }

      for (const severity of ['warning', 'info'] as const) {
        await expect(settingsPage.builders.advisorSeverity(severity)).not.toBeChecked();
      }

      await expect(settingsPage.inputs.advisorRecipients).toHaveValue('');
      await expect(settingsPage.elements.advisorSchedulerLink).toHaveAttribute(
        'href',
        /\/advisors\/scheduler$/,
      );
      await expect(settingsPage.buttons.sendAdvisorTestEmail).toBeDisabled();
    });
  });
});

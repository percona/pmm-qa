import { readFile } from 'fs/promises';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { AdvisorCheckTechnology } from '@interfaces/advisors';
import { expect } from '@playwright/test';

pmmTest.describe('Advisor runs', () => {
  const createdChecks: string[] = [];

  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest.afterEach(async ({ api }) => {
    await api.advisorsApi.waitForNoActiveRun();

    for (const name of createdChecks.splice(0)) await api.advisorsApi.deleteCheck(name);
  });

  pmmTest(
    'PMM-T2573 - Verify a check run from the catalog is recorded in run history @advisors',
    async ({ advisorInsightsPage, advisorRunsPage, advisorsCatalogPage, api, page }) => {
      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);

      const runId = await pmmTest.step('Run the check from the catalog', async () => {
        await page.goto(advisorsCatalogPage.url);
        await advisorsCatalogPage.inputs.search.fill(check.summary);

        const started = await advisorsCatalogPage.runCheck(check.name);

        await expect(advisorsCatalogPage.builders.checkStarted(check.summary)).toBeVisible();

        return started;
      });

      await pmmTest.step('Verify the run in run history', async () => {
        await page.goto(advisorRunsPage.url);
        await advisorRunsPage.runIdFilter.apply(runId);
        await expect(advisorRunsPage.builders.row(runId)).toContainText('User');
        await expect(advisorRunsPage.elements.rows).toHaveCount(1);
        await expect(async () => {
          await advisorRunsPage.buttons.refresh.click();
          await expect(advisorRunsPage.builders.row(runId)).toContainText('1/1', {
            timeout: Timeouts.TWO_SECONDS,
          });
        }).toPass({ timeout: Timeouts.ONE_MINUTE });
      });

      await pmmTest.step('Open the insights of the run', async () => {
        await advisorRunsPage.builders.actionsButton(runId).click();
        await advisorRunsPage.buttons.viewInsights.click();
        await expect(page).toHaveURL(advisorInsightsPage.runUrl(runId));
        await expect(advisorInsightsPage.builders.rowsWithText('Finding')).not.toHaveCount(0);
      });
    },
  );

  pmmTest(
    'PMM-T2574 - Verify run history filters by trigger and run ID @advisors',
    async ({ advisorRunsPage, api, leftNavigation, page }) => {
      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);

      const run = await api.advisorsApi.runChecksAndWait([check.name]);

      await page.goto(advisorRunsPage.url);

      await pmmTest.step('Verify the run list and its columns', async () => {
        await expect(advisorRunsPage.elements.title).toBeVisible();
        await expect(advisorRunsPage.builders.row(run.id)).toBeVisible();

        for (const column of [
          'Started',
          'Duration',
          'Triggered by',
          'Checks',
          'Findings',
          'Errors',
          'Services',
        ]) {
          await expect(advisorRunsPage.elements.header).toContainText(column);
        }
      });

      await pmmTest.step('Filter by the Scheduler trigger hides the user run', async () => {
        await advisorRunsPage.selectTriggeredBy('Scheduler');
        await expect(advisorRunsPage.builders.row(run.id)).toBeHidden();
      });

      await pmmTest.step('Filter by run ID shows only that run', async () => {
        await advisorRunsPage.buttons.clearFilters.click();
        await expect(advisorRunsPage.inputs.triggeredBy).toHaveText('All');
        await advisorRunsPage.runIdFilter.apply(run.id);
        await expect(advisorRunsPage.builders.row(run.id)).toContainText(String(run.findings_count));
        await expect(advisorRunsPage.elements.rows).toHaveCount(1);
      });

      await pmmTest.step('The menu restores the trigger filter and page size, not the run ID', async () => {
        await advisorRunsPage.selectTriggeredBy('User');
        await advisorRunsPage.selectRowsPerPage(100);
        await leftNavigation.selectMenuItem('advisors.catalog');
        await expect(page).toHaveURL(/\/pmm-ui\/advisors$/);
        await leftNavigation.selectMenuItem('advisors.runHistory');
        await expect(page).toHaveURL(/pageSize=100/);
        await expect(page).not.toHaveURL(/runId=/);
        await expect(advisorRunsPage.inputs.triggeredBy).toHaveText('User');
        await expect(advisorRunsPage.inputs.rowsPerPage).toHaveText('100');
        await expect(advisorRunsPage.runIdFilter.inputs.runId).toHaveValue('');
      });
    },
  );

  pmmTest(
    'PMM-T2594 - Verify exporting the insights of a run as CSV @advisors',
    async ({ advisorRunsPage, api, page }) => {
      const failing = await api.advisorsApi.createCustomCheck();
      const passing = await api.advisorsApi.createCustomCheck({ script: api.advisorsApi.passingCheckScript });
      // No MongoDB service is monitored, so a run of this check covers nothing.
      const idle = await api.advisorsApi.createCustomCheck({
        script: api.advisorsApi.passingCheckScript,
        technology: AdvisorCheckTechnology.mongodb,
      });

      createdChecks.push(failing.name, passing.name, idle.name);

      const run = await api.advisorsApi.runChecksAndWait([failing.name, passing.name]);
      const insights = await api.advisorsApi.listInsights({ run_id: run.id });
      const failed = insights.filter(({ check_name }) => check_name === failing.name);
      const passed = insights.filter(({ check_name }) => check_name === passing.name);
      const idleRun = await api.advisorsApi.runChecksAndWait([idle.name]);

      expect(failed.length, 'No MySQL service is monitored').toBeGreaterThan(0);
      expect(passed.length, 'The passing check recorded no insights').toBeGreaterThan(0);
      await page.goto(advisorRunsPage.url);
      await advisorRunsPage.runIdFilter.apply(run.id);

      await pmmTest.step('Export all downloads every insight of the run', async () => {
        const download = await advisorRunsPage.exportInsights(run.id, 'all');
        const csv = await readFile(await download.path(), 'utf8');

        expect(download.suggestedFilename()).toMatch(/^advisor_run_insights_\d{8}_\d{6}\.csv$/);
        expect(csv.split('\n')[0]).toContain('check_name');

        for (const { id } of insights) expect(csv).toContain(id);
      });

      await pmmTest.step('Export failed leaves out the passing insights', async () => {
        const download = await advisorRunsPage.exportInsights(run.id, 'failed');
        const csv = await readFile(await download.path(), 'utf8');

        expect(download.suggestedFilename()).toMatch(/^advisor_run_failed_insights_\d{8}_\d{6}\.csv$/);

        for (const { id } of failed) expect(csv).toContain(id);
        for (const { id } of passed) expect(csv).not.toContain(id);
      });

      await pmmTest.step('A run without insights has nothing to export', async () => {
        await advisorRunsPage.runIdFilter.apply(idleRun.id);
        await advisorRunsPage.builders.actionsButton(idleRun.id).click();
        await advisorRunsPage.buttons.exportAllInsights.click();
        await expect(advisorRunsPage.messages.noInsightsToExport).toBeVisible();
        await advisorRunsPage.builders.actionsButton(idleRun.id).click();
        await advisorRunsPage.buttons.exportFailedInsights.click();
        await expect(advisorRunsPage.messages.noFailedInsightsToExport).toBeVisible();
      });
    },
  );

  pmmTest(
    'PMM-T2595 - Verify Copy run ID, Run again and following a run in progress @advisors',
    async ({ advisorRunsPage, api, context, page }) => {
      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);

      const run = await api.advisorsApi.runChecksAndWait([check.name]);

      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto(advisorRunsPage.url);
      await advisorRunsPage.runIdFilter.apply(run.id);

      await pmmTest.step('Copy run ID', async () => {
        await advisorRunsPage.builders.actionsButton(run.id).click();
        await advisorRunsPage.buttons.copyRunId.click();
        await expect(advisorRunsPage.messages.runIdCopied).toBeVisible();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toEqual(run.id);
      });

      await pmmTest.step('Run again repeats the checks of the run', async () => {
        await advisorRunsPage.builders.actionsButton(run.id).click();

        const { runId } = await advisorRunsPage.startRun(advisorRunsPage.buttons.runAgain);

        await expect(advisorRunsPage.messages.checksStarted).toBeVisible();

        const rerun = await api.advisorsApi.waitForRun(runId);

        expect(rerun.id).not.toEqual(run.id);
        expect(rerun.check_names).toEqual([check.name]);
      });

      await pmmTest.step('The list follows a run in progress without Refresh', async () => {
        const names = (await api.advisorsApi.listChecks())
          .filter(
            ({ disabled_service_ids, enabled, technology, user_defined }) =>
              technology === AdvisorCheckTechnology.mysql &&
              !user_defined &&
              enabled &&
              !disabled_service_ids.length,
          )
          .slice(0, 20)
          .map(({ name }) => name);

        expect(names.length, 'No enabled built-in MySQL check found').toBeGreaterThan(0);

        // About a second per check on one service: long enough to see the run in progress.
        const runId = await api.advisorsApi.startChecks(names);

        await advisorRunsPage.runIdFilter.apply(runId);
        await expect(advisorRunsPage.builders.inProgress(runId)).toBeVisible();
        await expect(advisorRunsPage.builders.inProgress(runId)).toBeHidden({
          timeout: Timeouts.ONE_MINUTE,
        });
        await expect(advisorRunsPage.builders.row(runId)).toContainText(`${names.length}/${names.length}`);
      });
    },
  );
});

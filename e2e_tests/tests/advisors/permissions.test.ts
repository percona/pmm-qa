import AdvisorsApi from '@api/advisors.api';
import MailpitApi from '@api/mailpit.api';
import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';
import { AdvisorSchedule, AdvisorScheduleEmailMode } from '@interfaces/advisors';
import { expect } from '@playwright/test';

pmmTest.describe.configure({ mode: 'default' });

const password = 'password';
const suffix = Date.now();
const users = { editor: `advisors_editor_${suffix}`, viewer: `advisors_viewer_${suffix}` } as const;
const noAccess = 'Insufficient access permissions.';
const createdUserIds: number[] = [];

pmmTest.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  const grafanaHelper = new GrafanaHelper(page);

  createdUserIds.push(await grafanaHelper.createUser(users.viewer, password));

  const editorId = await grafanaHelper.createUser(users.editor, password);

  createdUserIds.push(editorId);
  await grafanaHelper.promoteToEditor(editorId);
  await page.close();
});

pmmTest.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  const grafanaHelper = new GrafanaHelper(page);

  for (const userId of createdUserIds.splice(0)) {
    expect.soft((await grafanaHelper.deleteUser(userId)).status(), `Delete user ${userId}`).toEqual(200);
  }

  await page.close();
});

pmmTest(
  'PMM-Txxxx - Verify a viewer has no access to Advisors @advisors',
  async ({
    advisorInsightsPage,
    advisorRunsPage,
    advisorsCatalogPage,
    advisorSchedulerPage,
    api,
    grafanaHelper,
    leftNavigation,
    page,
  }) => {
    await grafanaHelper.authorize(users.viewer, password);

    await pmmTest.step('The Advisors menu is hidden', async () => {
      await page.goto('pmm-ui');
      await expect(leftNavigation.elements.sidebar).toBeVisible();
      await expect(leftNavigation.elements.advisorsMenu).toBeHidden();
    });

    for (const { elements, url } of [
      advisorsCatalogPage,
      advisorInsightsPage,
      advisorRunsPage,
      advisorSchedulerPage,
    ]) {
      await pmmTest.step(`${url} is unauthorized`, async () => {
        await page.goto(url);
        await expect(elements.unauthorized).toContainText(noAccess);
      });
    }

    await pmmTest.step('The Advisors API rejects the viewer', async () => {
      const viewerAuth = GrafanaHelper.getAuthHeader(users.viewer, password);

      for (const endpoint of [apiEndpoints.advisors.checks, apiEndpoints.advisors.schedules]) {
        expect([401, 403], endpoint).toContain(
          (await api.advisorsApi.requestGet(endpoint, viewerAuth)).status(),
        );
      }
    });
  },
);

pmmTest(
  'PMM-Txxxx - Verify an editor can run Advisors but not author checks or open its settings @advisors',
  async ({
    advisorInsightsPage,
    advisorRunsPage,
    advisorsCatalogPage,
    advisorSchedulerPage,
    api,
    grafanaHelper,
    page,
    settingsPage,
  }) => {
    const check = await api.advisorsApi.createCustomCheck();
    const editorAuth = GrafanaHelper.getAuthHeader(users.editor, password);
    let scheduleId = '';

    try {
      await pmmTest.step('The editor reads, creates and runs schedules through the API', async () => {
        for (const endpoint of [
          apiEndpoints.advisors.schedules,
          apiEndpoints.advisors.services,
          apiEndpoints.advisors.notificationSettings,
        ]) {
          expect((await api.advisorsApi.requestGet(endpoint, editorAuth)).status(), endpoint).toEqual(200);
        }

        const created = await api.advisorsApi.requestCreateSchedule(
          {
            check_names: [check.name],
            days_of_week: [1],
            email_mode: AdvisorScheduleEmailMode.off,
            name: AdvisorsApi.scheduleName(),
            time_of_day: '10:00',
          },
          editorAuth,
        );

        expect(created.status(), await created.text()).toEqual(200);
        scheduleId = ((await created.json()) as { schedule: AdvisorSchedule }).schedule.schedule_id;

        await api.advisorsApi.waitForRun(await api.advisorsApi.runSchedule(scheduleId, editorAuth));
      });

      await pmmTest.step('The API refuses to let the editor author or test a check', async () => {
        const newName = AdvisorsApi.customCheckName();
        const service = await api.advisorsApi.getMysqlService();
        const statuses = [
          await api.advisorsApi.requestCreateCheck({ name: newName }, editorAuth),
          await api.advisorsApi.requestUpdateCheck(check.name, { ...check, summary: 'Changed' }, editorAuth),
          await api.advisorsApi.requestDeleteCheck(check.name, editorAuth),
          await api.advisorsApi.requestTestCheck(service.service_id, check, editorAuth),
        ].map((response) => response.status());

        expect(statuses).toEqual([403, 403, 403, 403]);
        expect(await api.advisorsApi.findCheck(newName)).toBeUndefined();
        expect((await api.advisorsApi.findCheck(check.name))?.summary).toEqual(check.summary);
      });

      await grafanaHelper.authorize(users.editor, password);

      await pmmTest.step('The catalog offers the editor no Add, Edit or Delete', async () => {
        await page.goto(advisorsCatalogPage.url);
        await advisorsCatalogPage.inputs.search.fill(check.summary);
        await expect(advisorsCatalogPage.builders.runButton(check.name)).toBeVisible();
        await expect(advisorsCatalogPage.buttons.addAdvisor).toBeHidden();
        await expect(advisorsCatalogPage.builders.editButton(check.name)).toBeHidden();
        await expect(advisorsCatalogPage.builders.deleteButton(check.name)).toBeHidden();
      });

      await pmmTest.step('The details pane shows the script but no Edit, Clone or Test', async () => {
        await page.goto(advisorsCatalogPage.detailsUrl(check.name));
        await expect(advisorsCatalogPage.elements.checkCode).toContainText('def check_context');
        await expect(advisorsCatalogPage.buttons.editCheck).toBeHidden();
        await expect(advisorsCatalogPage.buttons.cloneCheck).toBeHidden();
        await expect(advisorsCatalogPage.checkForm.buttons.test).toBeHidden();
      });

      await pmmTest.step('The editor runs a check from the catalog', async () => {
        await page.goto(advisorsCatalogPage.url);
        await advisorsCatalogPage.inputs.search.fill(check.summary);

        const runId = await advisorsCatalogPage.runCheck(check.name);

        await expect(advisorsCatalogPage.messages.checkStarted(check.summary)).toBeVisible();
        await api.advisorsApi.waitForRun(runId);
      });

      for (const { elements, url } of [advisorInsightsPage, advisorRunsPage, advisorSchedulerPage]) {
        await pmmTest.step(`${url} is available`, async () => {
          await page.goto(url);
          await expect(elements.title).toBeVisible();
          await expect(elements.unauthorized).toBeHidden();
        });
      }

      await pmmTest.step('The Advisors settings tab is admin-only', async () => {
        await page.goto(settingsPage.urls.advisors);
        await expect(settingsPage.elements.unauthorized).toContainText(noAccess);
      });

      await pmmTest.step('The API serves the editor, including test notifications', async () => {
        const recipient = MailpitApi.recipient('editor');
        const withoutSeverity = await api.advisorsApi.requestTestNotification([recipient], [], editorAuth);
        const withSeverity = await api.advisorsApi.requestTestNotification(
          [recipient],
          ['SEVERITY_CRITICAL'],
          editorAuth,
        );

        expect((await api.advisorsApi.requestGet(apiEndpoints.advisors.checks, editorAuth)).status()).toEqual(
          200,
        );
        expect(withoutSeverity.status()).toEqual(400);
        expect(await withoutSeverity.text()).toContain('At least one severity is required.');
        expect(withSeverity.status(), await withSeverity.text()).toEqual(200);
      });
    } finally {
      if (scheduleId) await api.advisorsApi.deleteSchedule(scheduleId);

      await api.advisorsApi.deleteCheck(check.name);
    }
  },
);

import AdvisorsApi from '@api/advisors.api';
import MailpitApi from '@api/mailpit.api';
import pmmTest from '@fixtures/pmmTest';
import { AdvisorScheduleEmailMode, AdvisorScheduleInput } from '@interfaces/advisors';
import { expect } from '@playwright/test';

const defaultSeverities = ['SEVERITY_CRITICAL', 'SEVERITY_ERROR'];

pmmTest.describe('Advisor notifications', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest.afterEach(async ({ api }) => {
    const response = await api.settingsApi.putSettings({
      advisor_notification_email_addresses: { values: [] },
      advisor_notification_severities: defaultSeverities,
      enable_advisor_notifications: false,
    });

    expect(response.status(), await response.text()).toEqual(200);
  });

  pmmTest(
    'PMM-Txxxx - Verify Advisor notification settings validation @advisors',
    async ({ api, page, settingsPage }) => {
      const recipients = settingsPage.inputs.advisorRecipients;
      const apply = settingsPage.buttons.applyAdvisorsChanges;
      const tooMany = Array.from({ length: 21 }, (_, i) => `qa${i}@example.com`);

      await pmmTest.step('The API rejects missing, too many and invalid recipients', async () => {
        for (const [addresses, error] of [
          [[], 'at least one recipient is required while Advisor notifications are enabled.'],
          [tooMany, 'at most 20 addresses are allowed, got 21.'],
          [['not-an-email'], "invalid address 'not-an-email'."],
        ] as const) {
          const response = await api.settingsApi.putSettings({
            advisor_notification_email_addresses: { values: addresses },
            enable_advisor_notifications: true,
          });

          expect(response.status()).toEqual(400);
          expect(await response.text()).toContain(error);
        }
      });

      await page.goto(settingsPage.urls.advisors);

      await pmmTest.step('Notifications cannot be turned on without recipients', async () => {
        await settingsPage.buttons.toggles.advisorNotifications.input.click();

        for (const severity of ['critical', 'error'] as const) {
          await expect(settingsPage.builders.advisorSeverity(severity)).toBeChecked();
        }

        await expect(recipients).toHaveValue('');
        await expect(apply).toBeDisabled();
        await recipients.fill('qa@example.com');
        await recipients.fill('');
        await expect(settingsPage.messages.advisorRecipientsRequired).toBeVisible();
      });

      await pmmTest.step('Recipients must be valid addresses, at most 20', async () => {
        await recipients.fill(tooMany.join(', '));
        await expect(settingsPage.messages.advisorRecipientsMax).toBeVisible();
        await expect(apply).toBeDisabled();
        await recipients.fill('qa@example.com, not-an-email');
        await expect(settingsPage.messages.advisorRecipientInvalid('not-an-email')).toBeVisible();
        await expect(apply).toBeDisabled();
      });

      await pmmTest.step('At least one severity is required', async () => {
        await settingsPage.builders.advisorSeverity('critical').uncheck();
        await settingsPage.builders.advisorSeverity('error').uncheck();
        await expect(settingsPage.messages.advisorSeveritiesRequired).toBeVisible();
        await settingsPage.builders.advisorSeverity('critical').check();
        await settingsPage.builders.advisorSeverity('error').check();
        await expect(settingsPage.messages.advisorSeveritiesRequired).toBeHidden();
      });

      await pmmTest.step(
        'Commas and spaces both separate recipients, and duplicates are merged',
        async () => {
          await recipients.fill('qa@example.com, dba@example.com qa@example.com');
          await apply.click();
          await expect(settingsPage.messages.settingsUpdated).toBeVisible();
          expect((await api.settingsApi.getSettings()).settings).toMatchObject({
            advisor_notification_email_addresses: ['dba@example.com', 'qa@example.com'],
            advisor_notification_severities: defaultSeverities,
            advisor_notifications_enabled: true,
          });
          await page.reload();
          await expect(recipients).toHaveValue('dba@example.com, qa@example.com');
        },
      );

      await pmmTest.step('Clearing the recipients needs notifications turned off', async () => {
        await recipients.fill('');
        await expect(settingsPage.messages.advisorRecipientsRequired).toBeVisible();
        await expect(apply).toBeDisabled();
        await settingsPage.buttons.toggles.advisorNotifications.input.click();
        await apply.click();
        await expect(settingsPage.messages.settingsUpdated).toBeVisible();
        expect((await api.settingsApi.getSettings()).settings).toMatchObject({
          advisor_notification_email_addresses: [],
          advisor_notifications_enabled: false,
        });
      });
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify sending a test email from the API, Settings and the schedule editor @advisors',
    async ({ advisorSchedulerPage, api, page, settingsPage }) => {
      await pmmTest.step(
        'The API requires a severity and sends one sample finding per severity',
        async () => {
          const recipient = MailpitApi.recipient('test-api');
          const withoutSeverity = await api.advisorsApi.requestTestNotification([recipient]);
          const withSeverity = await api.advisorsApi.requestTestNotification(
            [recipient],
            ['SEVERITY_CRITICAL'],
          );

          expect(withoutSeverity.status()).toEqual(400);
          expect(await withoutSeverity.text()).toContain('At least one severity is required.');
          expect(withSeverity.status(), await withSeverity.text()).toEqual(200);

          const email = await api.mailpitApi.waitForMessageTo(recipient);

          expect(email.Subject).toEqual('[Test] PMM Advisor Insights: 1 sample finding(s)');
          expect(email.Text).toContain('Findings by severity:\n  Critical: 1\n\n');
        },
      );

      await pmmTest.step('Settings sends to the unsaved recipients and severities', async () => {
        const recipient = MailpitApi.recipient('test-settings');
        const settingsBefore = (await api.settingsApi.getSettings()).settings;

        await page.goto(settingsPage.urls.advisors);
        await settingsPage.buttons.toggles.advisorNotifications.input.click();
        await settingsPage.inputs.advisorRecipients.fill(recipient);
        await settingsPage.builders.advisorSeverity('error').uncheck();
        await settingsPage.builders.advisorSeverity('critical').uncheck();
        await expect(settingsPage.buttons.sendAdvisorTestEmail).toBeDisabled();
        await settingsPage.builders.advisorSeverity('warning').check();
        await settingsPage.buttons.sendAdvisorTestEmail.click();
        await expect(settingsPage.messages.advisorTestEmailSent(recipient)).toBeVisible();

        const email = await api.mailpitApi.waitForMessageTo(recipient);

        expect(email.Subject).toMatch(/^\[Test\] /);
        expect(email.Text).toContain('Findings by severity:\n  Warning: 1\n\n');
        expect((await api.settingsApi.getSettings()).settings).toEqual(settingsBefore);
      });

      await pmmTest.step('The schedule editor sends to its own recipients and severities', async () => {
        const recipient = MailpitApi.recipient('test-schedule');
        const { editor } = advisorSchedulerPage;

        await page.goto(advisorSchedulerPage.url);
        await advisorSchedulerPage.buttons.newSchedule.click();
        await editor.inputs.ownRecipients.check();
        await editor.inputs.emailAddresses.fill(recipient);
        await editor.inputs.severitiesOnlyThese.check();
        await editor.builders.severity('critical').uncheck();
        await editor.buttons.testEmail.click();
        await expect(editor.messages.testEmailSent(recipient, 'Error')).toBeVisible();

        const email = await api.mailpitApi.waitForMessageTo(recipient);

        expect(email.Subject).toMatch(/^\[Test\] /);
        expect(email.Text).toContain('Findings by severity:\n  Error: 1\n\n');
        await editor.buttons.cancel.click();
      });
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify the report emails of a user run and of a schedule @advisors',
    async ({ api }) => {
      const settingsRecipient = MailpitApi.recipient('report-settings');
      const scheduleRecipient = MailpitApi.recipient('report-schedule');
      const service = await api.advisorsApi.getMysqlService();
      // Three findings per service: one error and two warnings.
      const check = await api.advisorsApi.createCustomCheck({
        script: AdvisorsApi.findingsScript(3, 'error'),
      });
      let scheduleId = '';

      try {
        const enabled = await api.settingsApi.putSettings({
          advisor_notification_email_addresses: { values: [settingsRecipient] },
          enable_advisor_notifications: true,
        });

        expect(enabled.status(), await enabled.text()).toEqual(200);

        await pmmTest.step('A user run emails its findings at the Settings severities', async () => {
          const run = await api.advisorsApi.runChecksAndWait([check.name]);
          const errors = run.services_count;
          const email = await api.mailpitApi.waitForMessageTo(settingsRecipient);

          expect(email.Subject).toEqual(`PMM Advisor Insights: ${errors} finding(s) for run ${run.id}`);

          for (const text of [
            `This report covers run ${run.id}, which was triggered manually by an operator.`,
            'with the selected severities (Critical, Error)',
            `Findings by severity:\n  Critical: 0\n  Error: ${errors}\n\n`,
            `Findings by technology:\n  MySQL: ${errors}\n  PostgreSQL: 0\n  MongoDB: 0\n`,
          ]) {
            expect(email.Text).toContain(text);
          }

          expect(await api.mailpitApi.messagesTo(settingsRecipient)).toHaveLength(1);
        });

        await pmmTest.step('A schedule run emails its own recipients and severities', async () => {
          const schedule = await api.advisorsApi.createSchedule({
            check_names: [check.name],
            email_addresses: [scheduleRecipient],
            email_mode: AdvisorScheduleEmailMode.custom,
            email_severities: ['SEVERITY_WARNING'],
            service_ids: [service.service_id],
          });

          scheduleId = schedule.schedule_id;
          await api.advisorsApi.waitForRun(await api.advisorsApi.runSchedule(scheduleId));

          const email = await api.mailpitApi.waitForMessageTo(scheduleRecipient);

          expect(email.Subject).toEqual(`PMM Advisor Insights: 2 finding(s) for ${schedule.name}`);
          expect(email.Text).toContain(
            `triggered manually by an operator from the schedule '${schedule.name}'`,
          );
          expect(email.Text).toContain('Findings by severity:\n  Warning: 2\n\n');
          expect(await api.mailpitApi.messagesTo(settingsRecipient)).toHaveLength(1);
        });
      } finally {
        if (scheduleId) await api.advisorsApi.deleteSchedule(scheduleId);

        await api.advisorsApi.deleteCheck(check.name);
      }
    },
  );

  pmmTest('PMM-Txxxx - Verify each schedule emails as it is set to @advisors', async ({ api }) => {
    const settingsRecipient = MailpitApi.recipient('modes-settings');
    const ownRecipient = MailpitApi.recipient('modes-own');
    const deletedRecipient = MailpitApi.recipient('modes-deleted');
    const service = await api.advisorsApi.getMysqlService();
    // One error and one warning on the service; the default severities email only the error.
    const check = await api.advisorsApi.createCustomCheck({ script: AdvisorsApi.findingsScript(2, 'error') });
    const slowChecks = [
      await api.advisorsApi.createCustomCheck({ script: api.advisorsApi.endlessCheckScript }),
      await api.advisorsApi.createCustomCheck({ script: api.advisorsApi.endlessCheckScript }),
    ];
    const scheduleIds: string[] = [];

    const createSchedule = async (overrides: Partial<AdvisorScheduleInput>) => {
      const schedule = await api.advisorsApi.createSchedule({
        check_names: [check.name],
        service_ids: [service.service_id],
        ...overrides,
      });

      scheduleIds.push(schedule.schedule_id);

      return schedule;
    };

    try {
      const enabled = await api.settingsApi.putSettings({
        advisor_notification_email_addresses: { values: [settingsRecipient] },
        enable_advisor_notifications: true,
      });

      expect(enabled.status(), await enabled.text()).toEqual(200);

      await pmmTest.step(
        'A schedule without email sends none, one on Settings emails the defaults',
        async () => {
          const silent = await createSchedule({ email_mode: AdvisorScheduleEmailMode.off });
          const defaults = await createSchedule({ email_mode: AdvisorScheduleEmailMode.settings });

          // Runs finish one after another, so an email from the first would arrive before the second.
          await api.advisorsApi.waitForRun(await api.advisorsApi.runSchedule(silent.schedule_id));
          await api.advisorsApi.waitForRun(await api.advisorsApi.runSchedule(defaults.schedule_id));

          const email = await api.mailpitApi.waitForMessageTo(settingsRecipient);

          expect(email.Subject).toEqual(`PMM Advisor Insights: 1 finding(s) for ${defaults.name}`);
          expect(await api.mailpitApi.messagesTo(settingsRecipient)).toHaveLength(1);
        },
      );

      await pmmTest.step('Own recipients get the findings at the Settings severities', async () => {
        const own = await createSchedule({
          email_addresses: [ownRecipient],
          email_mode: AdvisorScheduleEmailMode.custom,
        });

        await api.advisorsApi.waitForRun(await api.advisorsApi.runSchedule(own.schedule_id));

        const email = await api.mailpitApi.waitForMessageTo(ownRecipient);

        expect(email.Subject).toEqual(`PMM Advisor Insights: 1 finding(s) for ${own.name}`);
        expect(email.Text).toContain('Findings by severity:\n  Critical: 0\n  Error: 1\n\n');
        expect(await api.mailpitApi.messagesTo(settingsRecipient)).toHaveLength(1);
      });

      await pmmTest.step('A schedule deleted during its run emails the Settings recipients', async () => {
        const deleted = await createSchedule({
          check_names: [check.name, ...slowChecks.map(({ name }) => name)],
          email_addresses: [deletedRecipient],
          email_mode: AdvisorScheduleEmailMode.custom,
        });
        const runId = await api.advisorsApi.runSchedule(deleted.schedule_id);

        await api.advisorsApi.deleteSchedule(deleted.schedule_id);
        await api.advisorsApi.waitForRun(runId);
        await expect
          .poll(async () =>
            (await api.mailpitApi.messagesTo(settingsRecipient)).map(({ Subject }) => Subject),
          )
          .toContain(`PMM Advisor Insights: 1 finding(s) for ${deleted.name}`);
        expect(await api.mailpitApi.messagesTo(deletedRecipient)).toHaveLength(0);
      });
    } finally {
      for (const scheduleId of scheduleIds) await api.advisorsApi.deleteSchedule(scheduleId);
      for (const { name } of [check, ...slowChecks]) await api.advisorsApi.deleteCheck(name);
    }
  });
});

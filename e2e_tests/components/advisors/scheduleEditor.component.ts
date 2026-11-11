import BasePage from '@pages/base.page';

export type ScheduleScope = 'All checks' | 'All services' | 'Selected checks' | 'Selected services';

export interface ScheduleFormValues {
  checkNames?: string[];
  days?: number[];
  name?: string;
  serviceIds?: string[];
  time?: string;
}

export default class ScheduleEditorComponent extends BasePage {
  nextDayNote = 'In your time zone this lands on the next day. Days are picked in UTC.';
  builders = {
    checkOption: (checkName: string) => this.page.getByTestId(`schedule-checks-picker-item-${checkName}`),
    day: (day: number) => this.page.getByTestId(`schedule-day-${day}`),
    emailInvalid: (addresses: string) => this.builders.error(`Not a valid address: ${addresses}`),
    emailMax: (count: number) => this.builders.error(`Up to 20 addresses; there are ${count}.`),
    error: (text: string) => this.elements.editor.locator('.Mui-error', { hasText: text }),
    fixFields: (fields: string[]) =>
      this.elements.footerMessage.filter({
        hasText: `Fix the highlighted ${fields.length > 1 ? 'fields' : 'field'}: ${fields.join(', ')}.`,
      }),
    nameTaken: (name: string) => this.builders.error(`A schedule named "${name}" already exists.`),
    scope: (scope: ScheduleScope) =>
      this.elements.editor.getByRole('radio', { name: new RegExp(`^${scope}`) }),
    serviceOption: (serviceId: string) => this.page.getByTestId(`schedule-services-picker-item-${serviceId}`),
    severity: (severity: 'critical' | 'error' | 'info' | 'warning') =>
      this.page.getByTestId(`schedule-severity-${severity}`),
    testEmailSent: (recipients: string, severities: string) =>
      this.alertWithText(
        `Sent a test report to ${recipients} with sample ${severities} findings. No checks were run.`,
      ),
  };
  buttons = {
    cancel: this.page.getByTestId('schedule-editor-cancel'),
    everyDay: this.page.getByTestId('schedule-days-preset-0'),
    save: this.page.getByTestId('schedule-editor-save'),
    testEmail: this.page.getByTestId('schedule-test-email'),
    weekdays: this.page.getByTestId('schedule-days-preset-1'),
  };
  elements = {
    coverageIdle: this.page.getByTestId('schedule-coverage-idle'),
    coverageNothing: this.page.getByTestId('schedule-coverage-nothing'),
    editor: this.page.getByTestId('schedule-editor'),
    footerMessage: this.page.getByTestId('schedule-editor-message'),
    preview: this.page.getByTestId('schedule-preview'),
    previewRuns: this.page.getByTestId('schedule-preview-runs'),
  };
  inputs = {
    emailAddresses: this.page.getByTestId('schedule-email-addresses'),
    name: this.page.getByTestId('schedule-name'),
    ownRecipients: this.elements.editor.getByRole('radio', { name: /^These recipients/ }),
    severitiesOnlyThese: this.elements.editor.getByRole('radio', { name: /^Only these/ }),
    time: this.page.getByTestId('schedule-time'),
  };
  messages = {
    createTitle: this.elements.editor.getByRole('heading', { exact: true, name: 'New schedule' }),
    editTitle: this.elements.editor.getByRole('heading', { exact: true, name: 'Edit schedule' }),
    emailRequired: this.builders.error('Enter at least one address, or choose Settings recipients.'),
    nameRequired: this.builders.error('Give the schedule a name.'),
    noChecks: this.builders.error('Pick at least one check, or choose All checks.'),
    noDays: this.elements.editor.getByText('Pick at least one day.'),
    noServices: this.builders.error('Pick at least one service, or choose All services.'),
    noSeverities: this.builders.error('Pick at least one severity, or choose Same as Settings.'),
    timeInvalid: this.builders.error('Enter a time as HH:MM.'),
  };

  fill = async ({ checkNames, days, name, serviceIds, time }: ScheduleFormValues) => {
    if (name) await this.inputs.name.fill(name);
    if (days) await this.setDays(days);
    if (time) await this.inputs.time.fill(time);
    if (checkNames) {
      await this.builders.scope('Selected checks').check();

      for (const checkName of checkNames) await this.builders.checkOption(checkName).check();
    }
    if (serviceIds) {
      await this.builders.scope('Selected services').check();

      for (const serviceId of serviceIds) await this.builders.serviceOption(serviceId).check();
    }
  };

  idleChecksWarning = (count: number, technology: string) =>
    `${count} ${technology} check${count === 1 ? '' : 's'} won't run: there is no ${technology} service in Inventory.`;

  nothingToDoWarning = (technology: string) =>
    'None of the selected checks applies to the selected services, so every run would have nothing to do. ' +
    `Pick checks for ${technology}, or other services.`;

  setDays = async (days: number[]) => {
    for (const day of [0, 1, 2, 3, 4, 5, 6]) {
      const pressed = (await this.builders.day(day).getAttribute('aria-pressed')) === 'true';

      if (pressed !== days.includes(day)) await this.builders.day(day).click();
    }
  };

  weekdayPreview = (utcTime: string, local?: { time: string; zone: string }) =>
    `Runs every weekday at ${utcTime} UTC${local ? `, ${local.time} in your time zone (${local.zone}` : ''}`;
}

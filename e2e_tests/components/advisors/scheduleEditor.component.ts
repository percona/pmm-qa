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
  builders = {
    checkOption: (checkName: string) => this.page.getByTestId(`schedule-checks-picker-item-${checkName}`),
    day: (day: number) => this.page.getByTestId(`schedule-day-${day}`),
    error: (text: string) => this.elements.editor.locator('.Mui-error', { hasText: text }),
    scope: (scope: ScheduleScope) =>
      this.elements.editor.getByRole('radio', { name: new RegExp(`^${scope}`) }),
    serviceOption: (serviceId: string) => this.page.getByTestId(`schedule-services-picker-item-${serviceId}`),
    severity: (severity: 'critical' | 'error' | 'info' | 'warning') =>
      this.page.getByTestId(`schedule-severity-${severity}`),
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
    emailInvalid: (addresses: string) => this.builders.error(`Not a valid address: ${addresses}`),
    emailMax: (count: number) => this.builders.error(`Up to 20 addresses; there are ${count}.`),
    emailRequired: this.builders.error('Enter at least one address, or choose Settings recipients.'),
    fixFields: (fields: string[]) =>
      this.elements.footerMessage.filter({
        hasText: `Fix the highlighted ${fields.length > 1 ? 'fields' : 'field'}: ${fields.join(', ')}.`,
      }),
    nameRequired: this.builders.error('Give the schedule a name.'),
    nameTaken: (name: string) => this.builders.error(`A schedule named "${name}" already exists.`),
    noChecks: this.builders.error('Pick at least one check, or choose All checks.'),
    noDays: this.elements.editor.getByText('Pick at least one day.'),
    noServices: this.builders.error('Pick at least one service, or choose All services.'),
    noSeverities: this.builders.error('Pick at least one severity, or choose Same as Settings.'),
    testEmailSent: (recipients: string, severities: string) =>
      this.page.getByRole('alert', { includeHidden: true }).filter({
        hasText: `Sent a test report to ${recipients} with sample ${severities} findings. No checks were run.`,
      }),
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

  setDays = async (days: number[]) => {
    for (const day of [0, 1, 2, 3, 4, 5, 6]) {
      const pressed = (await this.builders.day(day).getAttribute('aria-pressed')) === 'true';

      if (pressed !== days.includes(day)) await this.builders.day(day).click();
    }
  };
}

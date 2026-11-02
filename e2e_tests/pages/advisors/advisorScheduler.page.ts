import BasePage from '@pages/base.page';
import ScheduleEditorComponent from '@components/advisors/scheduleEditor.component';

export default class AdvisorSchedulerPage extends BasePage {
  readonly url = 'pmm-ui/advisors/scheduler';
  readonly editor = new ScheduleEditorComponent(this.page);
  builders = {
    actionsButton: (scheduleId: string) => this.page.getByTestId(`schedule-${scheduleId}-actions`),
    detailsSection: (section: 'checks' | 'coverage' | 'next-runs' | 'recent-runs' | 'summary') =>
      this.elements.detailsPane.getByTestId(`schedule-pane-${section}`),
    enabledSwitch: (scheduleId: string) =>
      this.page.getByTestId(`schedule-${scheduleId}-enabled`).locator('input'),
    lastRun: (scheduleId: string) => this.builders.row(scheduleId).getByTestId('schedule-last-run'),
    openLastRun: (scheduleId: string) =>
      this.builders.lastRun(scheduleId).getByRole('button', { name: 'Open this run in Run history' }),
    row: (scheduleId: string) => this.page.getByTestId(`schedule-row-${scheduleId}`),
    snackbar: (text: string) =>
      this.page.getByRole('alert', { includeHidden: true }).filter({ hasText: text }),
    targetsNothing: (scheduleId: string) => this.page.getByTestId(`schedule-${scheduleId}-targets-nothing`),
    weekMarks: (scheduleId: string) => this.page.getByTestId(`schedule-mark-${scheduleId}`),
  };
  buttons = {
    confirmDelete: this.page.getByTestId('schedule-delete-confirm'),
    delete: this.page.getByTestId('schedule-action-delete'),
    duplicate: this.page.getByTestId('schedule-action-duplicate'),
    edit: this.page.getByTestId('schedule-action-edit'),
    newSchedule: this.page.getByTestId('schedule-new'),
    openActiveRun: this.page
      .getByTestId('schedules-run-active')
      .getByRole('button', { name: 'Open in Run history' }),
    refresh: this.page.getByTestId('schedules-refresh'),
    restoreDefault: this.page.getByTestId('schedules-restore-default'),
    runNow: this.page.getByTestId('schedule-action-run'),
    viewRuns: this.page.getByTestId('schedule-action-runs'),
  };
  elements = {
    advisorsOffBanner: this.page.getByTestId('schedules-advisors-off'),
    deleteDialog: this.page.getByTestId('schedule-delete-dialog'),
    detailsPane: this.page.getByTestId('schedule-details-pane'),
    empty: this.page.getByTestId('schedules-empty'),
    notificationsOffBanner: this.page.getByTestId('schedules-notifications-off'),
    runActiveBanner: this.page.getByTestId('schedules-run-active'),
    title: this.page.getByRole('heading', { name: 'Advisor schedules' }),
    unauthorized: this.page.getByTestId('unauthorized'),
    week: this.page.getByTestId('schedule-week'),
    weekEmpty: this.page.getByTestId('schedule-week-empty'),
  };
  inputs = {};
  messages = {
    advisorsOff: this.elements.advisorsOffBanner.filter({
      hasText: 'Advisors are turned off, so no schedule runs. Schedules are kept.',
    }),
    created: (name: string) => this.builders.snackbar(`Created "${name}". Next run: `),
    deleted: (name: string) => this.builders.snackbar(`Deleted "${name}".`),
    deleteNotLast: this.elements.deleteDialog.getByText(
      'Its future runs are cancelled. Past runs stay in Run history under this name.',
    ),
    deleteTitle: (name: string) =>
      this.elements.deleteDialog.getByRole('heading', { exact: true, name: `Delete "${name}"?` }),
    duplicated: (name: string) =>
      this.builders.snackbar(
        `Duplicated as "${name}". It stays paused until you enable it, so nothing runs twice.`,
      ),
    emptyWeek: this.elements.weekEmpty.filter({
      hasText: 'Nothing is scheduled. Advisor checks run only when someone starts them.',
    }),
    enabled: (name: string) => this.builders.snackbar(`Enabled "${name}". Next run: `),
    notificationsOff: this.elements.notificationsOffBanner.filter({
      hasText: 'Advisor email notifications are turned off, so no schedule sends email.',
    }),
    offWeek: this.elements.weekEmpty.filter({ hasText: 'Nothing runs while Advisors are turned off.' }),
    paused: (name: string) => this.builders.snackbar(`Paused "${name}". It won't run until you enable it.`),
    runActive: this.elements.runActiveBanner.filter({ hasText: /is (queued|running)/ }),
    runActiveProgress: this.elements.runActiveBanner.filter({
      hasText: /is (queued and starts within a minute|running: \d+ of \d+ checks done, started)/,
    }),
    saved: (name: string) => this.builders.snackbar(`Saved "${name}". Next run: `),
    started: (name: string) => this.builders.snackbar(`Started "${name}". Follow it in Run history.`),
  };

  detailsUrl = (scheduleId: string) => `${this.url}?details=${encodeURIComponent(scheduleId)}`;

  openAction = async (
    scheduleId: string,
    action: 'delete' | 'duplicate' | 'edit' | 'runNow' | 'viewRuns',
  ) => {
    await this.builders.actionsButton(scheduleId).click();
    await this.buttons[action].click();
  };
}

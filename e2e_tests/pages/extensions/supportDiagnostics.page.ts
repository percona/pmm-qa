import { expect } from '@playwright/test';
import BasePage from '@pages/base.page';
import { logExtractorTitle, supportDiagnosticsIncident } from '@testdata/supportDiagnostics';

type PickerListbox = 'hours' | 'meridiem' | 'minutes';

export default class SupportDiagnosticsPage extends BasePage {
  readonly host = 'pmm-server';
  readonly incidentUrl = `pmm-ui/extensions/atw/${supportDiagnosticsIncident.id}`;
  readonly logExtractorTitle = logExtractorTitle;
  readonly pickedTime = { day: '15', hour: '10', meridiem: 'AM', minute: '30' };
  builders = {
    categoryChip: (category: string) =>
      this.page.getByRole('button', { name: new RegExp(`^${category} \\(\\d+\\)$`) }),
    executionRow: (snippetTitle: string) =>
      this.page.getByRole('heading', { level: 3, name: new RegExp(`${snippetTitle} —`) }),
    hostOption: (host: string) => this.page.getByRole('option', { name: host }),
    pickerDay: (day: string) =>
      this.elements.dateTimePicker.getByRole('gridcell', { exact: true, name: day }),
    pickerListbox: (listbox: PickerListbox) =>
      this.elements.dateTimePicker.getByRole('listbox', { name: `Select ${listbox}` }),
    pickerMonth: (label: string) => this.elements.dateTimePicker.getByText(label, { exact: true }),
    pickerOption: (listbox: PickerListbox, name: string) =>
      this.builders.pickerListbox(listbox).getByRole('option', { exact: true, name }),
    scriptOption: (title: string) => this.page.getByRole('option', { name: new RegExp(`^${title}`) }),
  };
  buttons = {
    choosePickerDate: this.page.getByRole('button', { name: 'Choose date' }),
    executeBatch: this.page.getByRole('button', { name: 'Execute batch' }),
    pickerOk: this.page.getByRole('dialog').getByRole('button', { exact: true, name: 'OK' }),
  };
  elements = {
    collectHeading: this.page.getByRole('heading', { name: 'Collect' }),
    dateTimePicker: this.page.getByRole('dialog'),
    executionCheckboxes: this.page.getByRole('checkbox', { name: /^Select (?!all finished executions)/ }),
    resultsHeading: this.page.getByRole('heading', { name: 'Results' }),
    selectAllCheckbox: this.page.getByRole('checkbox', {
      name: 'Select all finished executions on this page',
    }),
    selectedCounter: this.page.getByText(/^\d+ selected$/),
  };
  inputs = {
    executionHost: this.page.getByRole('combobox', { name: 'Execution Host' }),
    issueTime: this.page.getByRole('textbox', { name: 'Issue Time' }),
    logFilePath: this.page.getByRole('textbox', { name: 'Log file path' }),
    minutes: this.page.getByRole('spinbutton', { name: 'Minutes' }),
    searchScripts: this.page.getByRole('combobox', { name: 'Search scripts' }),
  };
  messages = {
    startedOneScript: this.page.getByText('Started 1 script', { exact: true }),
  };

  getExpectedIssueTime = () => {
    const { month, year } = this.getCurrentMonth();
    const { day, hour, meridiem, minute } = this.pickedTime;

    return `${month}/${day}/${year} ${hour}:${minute} ${meridiem}`;
  };

  getExpectedMonthLabel = () =>
    new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());

  getExpectedRequestTime = () => {
    const { month, year } = this.getCurrentMonth();
    const { day, hour, minute } = this.pickedTime;

    return `${year}-${month}-${day}T${hour}:${minute}`;
  };

  openIssueTimePicker = async () => {
    await this.buttons.choosePickerDate.click();
    await this.waitForPickerIdle();
  };

  pickIssueTime = async () => {
    const { day, hour, minute } = this.pickedTime;

    await this.builders.pickerDay(day).click();
    await this.waitForPickerIdle();
    await this.builders.pickerOption('hours', `${hour} hours`).click();
    await this.waitForPickerIdle();
    await this.builders.pickerOption('minutes', `${minute} minutes`).click();
    await this.waitForPickerIdle();
  };

  selectScript = async (category: string, snippetTitle: string) => {
    await this.builders.categoryChip(category).click();
    await this.inputs.searchScripts.click();
    await this.builders.scriptOption(snippetTitle).click();
  };

  private getCurrentMonth = () => {
    const now = new Date();

    return { month: String(now.getMonth() + 1).padStart(2, '0'), year: now.getFullYear() };
  };

  // Clicking while the popup is still animating is swallowed or closes it.
  private waitForPickerIdle = async () => {
    await expect
      .poll(() =>
        this.elements.dateTimePicker.evaluate((popup) => popup.getAnimations({ subtree: true }).length),
      )
      .toBe(0);
  };
}

import { Locator } from '@playwright/test';
import BasePage from '@pages/base.page';
import { AdvisorCheckDefinition } from '@interfaces/advisors';

export type AdvisorTechnologyLabel = 'MongoDB' | 'MySQL' | 'PostgreSQL';

export interface AdvisorCheckFormValues extends Pick<
  AdvisorCheckDefinition,
  'category' | 'description' | 'name' | 'script' | 'summary'
> {
  query?: { text: string; type: string };
  technology?: AdvisorTechnologyLabel;
}

export default class AdvisorCheckFormComponent extends BasePage {
  builders = {
    fieldError: (text: string) => this.elements.form.locator('.Mui-error', { hasText: text }),
    option: (name: string) => this.page.getByRole('option', { exact: true, name }),
    parameterAdd: (queryIndex: number) => this.page.getByTestId(`check-query-${queryIndex}-parameter-add`),
    parameterName: (queryIndex: number, index: number) =>
      this.page
        .getByTestId(`check-query-${queryIndex}-parameter-${index}`)
        .getByRole('combobox', { name: 'Parameter' }),
    queryRemove: (index: number) => this.page.getByTestId(`check-query-${index}-remove`),
    queryText: (index: number) => this.page.getByTestId(`check-query-${index}-text`),
    queryType: (index: number) =>
      this.page.getByTestId(`check-query-${index}-type-select`).getByRole('combobox'),
  };
  buttons = {
    addQuery: this.page.getByTestId('check-query-add'),
    cancel: this.page.getByTestId('advisor-check-form-cancel'),
    close: this.page.getByTestId('advisor-check-form-close'),
    save: this.page.getByTestId('advisor-check-form-save'),
    test: this.page.getByTestId('advisor-check-form-test'),
  };
  elements = {
    form: this.page.getByTestId('advisor-check-form'),
    testError: this.page.getByTestId('advisor-check-form-test-error'),
    testOutput: this.page.getByTestId('advisor-check-form-test-output'),
    testResults: this.page.getByTestId('advisor-check-form-test-results'),
    testScriptOutput: this.page.getByTestId('advisor-check-form-test-script-output'),
    testServiceOptions: this.page.getByRole('option'),
    testStatus: this.page.getByTestId('advisor-check-form-test-status'),
  };
  inputs = {
    category: this.elements.form.getByRole('combobox', { name: 'Category' }),
    description: this.page.getByTestId('check-description'),
    name: this.page.getByTestId('check-name'),
    script: this.elements.form.locator('textarea[name="script"]'),
    summary: this.page.getByTestId('check-summary'),
    technology: this.page.getByTestId('check-technology-select').getByRole('combobox'),
    testService: this.page.getByTestId('advisor-check-form-test-service').getByRole('combobox'),
  };
  messages = {
    addTitle: this.elements.form.getByRole('heading', { exact: true, name: 'Add advisor check' }),
    cloneTitle: this.elements.form.getByRole('heading', { exact: true, name: 'Clone advisor check' }),
    duplicateParameter: this.builders.fieldError('This parameter is already set for the query.'),
    editTitle: this.elements.form.getByRole('heading', { exact: true, name: 'Edit advisor check' }),
    invalidName: this.builders.fieldError('Enter a valid name: letters, digits and underscores'),
    nameTooLong: this.builders.fieldError('Name must be at most 128 characters.'),
    nameWithoutPrefix: this.builders.fieldError('Custom check names must start with "custom_".'),
    requiredField: this.builders.fieldError('This field is required.'),
    testFailed: this.elements.testStatus.filter({ hasText: /^Error$/ }),
    testFindings: (count: number) =>
      this.elements.testResults.getByText(
        `· ${count === 0 ? 'no findings' : `${count} finding${count === 1 ? '' : 's'}`}`,
      ),
    testSucceeded: this.elements.testStatus.filter({ hasText: /^Success$/ }),
  };

  fill = async (values: AdvisorCheckFormValues) => {
    await this.inputs.name.fill(values.name);
    await this.inputs.summary.fill(values.summary);
    await this.inputs.description.fill(values.description);
    await this.inputs.category.fill(values.category);
    await this.inputs.category.press('Tab');

    if (values.technology) await this.selectOption(this.inputs.technology, values.technology);
    if (values.query) {
      await this.selectOption(this.builders.queryType(0), values.query.type);
      await this.builders.queryText(0).fill(values.query.text);
    }

    await this.inputs.script.fill(values.script);
  };

  selectOption = async (select: Locator, option: string) => {
    await select.click();
    await this.builders.option(option).click();
  };

  testOnService = async (serviceName: string) => {
    await this.selectOption(this.inputs.testService, serviceName);
    await this.buttons.test.click();
  };
}

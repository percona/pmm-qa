import { Timeouts } from '@helpers/timeouts';
import BasePage from '@pages/base.page';
import { AlertSeverity } from '@interfaces/alerting';
import { expect, Locator } from '@playwright/test';

export default class AlertingPage extends BasePage {
  url = 'pmm-ui/alerting/status';
  urls = {
    alertGroups: 'graph/alerting/groups',
    alertRuleFromTemplate: 'graph/alerting/new-from-template',
    alertRules: 'graph/alerting/list',
    alertSettings: 'graph/alerting/admin',
    contactPoints: 'graph/alerting/notifications',
    notificationPolicies: 'graph/alerting/routes',
    silences: '/graph/alerting/silences',
    templates: 'graph/alerting/alert-rule-templates',
  };
  builders = {
    alertMessage: (text: string) =>
      this.grafanaIframe()
        .getByRole('status')
        .or(this.grafanaIframe().getByRole('alert'))
        .filter({ hasText: text }),
    alertRow: (alertName: string) => this.page.getByRole('row').filter({ hasText: alertName }),
    columnHeader: (header: string) => this.page.getByRole('columnheader', { name: header }),
    createRuleFromTemplate: (templateName: string) =>
      this.builders.templateRow(templateName).getByTestId('create-from-template-button'),
    deleteTemplate: (templateName: string) =>
      this.builders.templateRow(templateName).getByTestId('delete-template-button'),
    editTemplate: (templateName: string) =>
      this.builders.templateRow(templateName).getByTestId('edit-template-button'),
    folderOption: (folder: string) =>
      this.grafanaIframe().getByTestId('folder-picker').getByRole('treeitem', { exact: true, name: folder }),
    rowActions: (alertName: string) =>
      this.builders.alertRow(alertName).getByRole('button', { name: 'Row Actions' }),
    ruleFilter: (filter: string) => this.grafanaIframe().getByRole('radio', { exact: true, name: filter }),
    ruleGroupToggle: (folder: string) =>
      this.grafanaIframe()
        .getByTestId('rule-group-header')
        .filter({ hasText: folder })
        .getByTestId('data-testid group-collapse-toggle'),
    ruleListHeader: (header: string) =>
      this.grafanaIframe().getByTestId('header').filter({ hasText: header }),
    ruleMoreMenu: (ruleName: string) =>
      this.grafanaIframe()
        .getByTestId('row')
        .filter({ hasText: ruleName })
        .getByRole('button', { exact: true, name: 'More' }),
    ruleState: (state: string) => this.grafanaIframe().getByTestId('row').getByText(state),
    selectOption: (option: string) =>
      this.grafanaIframe()
        .getByTestId('data-testid Select option')
        .filter({ has: this.page.getByText(option, { exact: true }) }),
    severityCell: (alertName: string) => this.builders.alertRow(alertName).getByRole('cell').nth(5),
    stateCell: (alertName: string) =>
      this.builders.alertRow(alertName).getByRole('cell').nth(1).locator('[class*="filled"]'),
    templateColumnHeader: (header: string) =>
      this.grafanaIframe().getByRole('columnheader', { exact: true, name: header }),
    templateRow: (templateName: string) =>
      this.grafanaIframe()
        .getByRole('row')
        .filter({ has: this.page.getByText(templateName, { exact: true }) }),
    templateRowsBySource: (source: string) =>
      this.grafanaIframe()
        .getByRole('row')
        .filter({ has: this.page.getByTitle(source, { exact: true }) }),
  };
  buttons = {
    addTemplate: this.grafanaIframe().getByTestId('alert-rule-template-add-modal-button'),
    cancelModal: this.grafanaIframe().getByRole('dialog').getByRole('button', { name: 'Cancel' }),
    cancelTemplate: this.grafanaIframe().getByTestId('alert-rule-template-cancel-button'),
    closeModal: this.grafanaIframe().getByTestId('modal-close-button'),
    confirmDelete: this.grafanaIframe().getByTestId('confirm-delete-modal-button'),
    confirmModal: this.grafanaIframe().getByTestId('data-testid Confirm Modal Danger Button'),
    createEvaluationGroup: this.grafanaIframe().getByTestId(
      'data-testid alert-rule new-evaluation-group-create-button',
    ),
    deleteRule: this.grafanaIframe().getByRole('menuitem', { name: 'Delete' }),
    editAlertRule: this.page.getByRole('menuitem', { name: 'Edit alert rule' }),
    editRule: this.grafanaIframe().getByRole('link', { exact: true, name: 'Edit' }),
    expandRow: this.grafanaIframe().getByRole('button', { name: 'Expand row' }),
    newAlertRule: this.grafanaIframe().getByRole('link', { exact: true, name: 'New alert rule' }),
    newAlertRuleFromTemplate: this.grafanaIframe().getByRole('link', {
      exact: true,
      name: 'New alert rule from template',
    }),
    newChildPolicy: this.grafanaIframe().getByRole('button', { name: 'New child policy' }),
    newContactPoint: this.grafanaIframe().getByRole('link', { name: 'add contact point' }),
    newEvaluationGroup: this.grafanaIframe().getByTestId(
      'data-testid alert-rule new-evaluation-group-button',
    ),
    newSilence: this.grafanaIframe().getByRole('link', { name: /^(add|create) silence$/i }),
    save: this.grafanaIframe().getByRole('button', { exact: true, name: 'Save' }),
    saveRule: this.grafanaIframe().getByTestId('save-rule'),
    saveRuleAndExit: this.grafanaIframe().getByRole('button', { exact: true, name: 'Save rule and exit' }),
    saveSilence: this.grafanaIframe().getByRole('button', { name: 'Save silence' }),
    saveTemplate: this.grafanaIframe().getByTestId('alert-rule-template-edit-button'),
    selectFolder: this.grafanaIframe().getByRole('button', { name: 'Select folder' }),
    settingsLink: this.page.getByTestId('settings-link'),
    silence: this.page.getByRole('menuitem', { exact: true, name: 'Silence' }),
    submitTemplate: this.grafanaIframe().getByTestId('alert-rule-template-add-button'),
    uploadFile: this.grafanaIframe().getByTestId('alert-rule-template-upload-button'),
    viewAlertRule: this.page.getByRole('menuitem', { name: 'View alert rule' }),
    viewConfiguration: this.grafanaIframe().getByRole('button', { name: 'View configuration' }),
  };
  elements = {
    alertingDisabled: this.page.getByTestId('empty-block-card'),
    dataSourcePicker: this.grafanaIframe().getByTestId('data-testid Data source picker select container'),
    deleteModalMessage: this.grafanaIframe().getByTestId('modal-content').getByRole('heading', { level: 4 }),
    dialog: this.grafanaIframe().getByRole('dialog'),
    groupByContainer: this.grafanaIframe().getByTestId('group-by-container'),
    labelSearch: this.grafanaIframe().getByTestId('search-query-input'),
    learnMore: this.grafanaIframe().getByRole('link', { name: 'Learn more' }),
    modalHeader: this.grafanaIframe().getByTestId('modal-header'),
    modalWarning: this.grafanaIframe().getByTestId('alert-rule-name-warning'),
    noAlerts: this.page.getByRole('heading', { name: 'Nothing to show here yet' }),
    pageContent: this.grafanaIframe().getByRole('main'),
    ruleDetails: this.grafanaIframe().getByTestId('data-testid expanded-content'),
    ruleName: this.grafanaIframe().locator('[data-column="Name"]'),
    templateNames: this.grafanaIframe().locator('//tr/td[1]'),
    templatesLoader: this.grafanaIframe().getByTestId('template-select-input').getByText('Choose'),
    templatesTable: this.grafanaIframe().getByTestId('table-tbody'),
    unauthorized: this.grafanaIframe().getByTestId('unauthorized'),
  };
  inputs = {
    duration: this.grafanaIframe().getByRole('textbox', { name: 'Duration' }),
    evaluationGroupName: this.grafanaIframe().getByTestId('data-testid alert-rule new-evaluation-group-name'),
    name: this.grafanaIframe().getByTestId('data-testid alert-rule name-field'),
    pendingPeriod: this.grafanaIframe().getByRole('textbox', { name: 'Pending period' }),
    ruleExpression: this.grafanaIframe().getByPlaceholder('Math operations on one or more queries'),
    ruleName: this.grafanaIframe().getByRole('textbox', { name: 'Name' }),
    severity: this.grafanaIframe().getByTestId('severity-select-input'),
    template: this.grafanaIframe().getByTestId('yaml-textarea-input'),
    templateFile: this.grafanaIframe().getByTestId('modal-content').locator('input[type="file"]'),
    templateSelect: this.grafanaIframe().getByTestId('template-select-input'),
    threshold: this.grafanaIframe().locator('input[name="threshold"]'),
  };
  messages = {
    popUp: this.grafanaIframe().getByRole('status').or(this.grafanaIframe().getByRole('alert')),
  };

  attachTemplateFile = async (path: string) => {
    await this.buttons.addTemplate.click();
    await this.inputs.templateFile.setInputFiles(path);
  };

  chooseOption = async (select: Locator, option: string) => {
    await select.click();
    await this.builders.selectOption(option).click();
  };

  completeRuleFromTemplate = async (severity: keyof typeof AlertSeverity) => {
    await this.chooseOption(this.inputs.severity, severity);
    await this.buttons.selectFolder.click();
    await this.builders.folderOption('Experimental').click();
    await this.buttons.newEvaluationGroup.click();
    await this.inputs.evaluationGroupName.fill('1m');
    await this.buttons.createEvaluationGroup.click();
  };

  createTemplate = async (yaml: string) => {
    await this.buttons.addTemplate.click();
    await this.inputs.template.fill(yaml);
    await this.buttons.submitTemplate.click();
  };

  deleteTemplate = async (summary: string) => {
    await this.builders.deleteTemplate(summary).click();
    await expect(this.elements.modalHeader).toContainText('Delete Alert Rule Template', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(this.elements.deleteModalMessage).toHaveText(
      `Are you sure you want to delete the alert rule template "${summary}"?`,
    );
    await this.buttons.confirmDelete.click();
    await expect(this.messages.popUp).toContainText(
      `Alert rule template "${summary}" successfully deleted.`,
      {
        timeout: Timeouts.THIRTY_SECONDS,
      },
    );
    await expect(this.builders.deleteTemplate(summary)).toBeHidden();
  };

  silenceAlert = async (alertName: string) => {
    await this.builders.rowActions(alertName).click();
    await this.buttons.silence.click();
    await this.buttons.saveSilence.click();
  };
}

import fs from 'node:fs';
import BasePage from '@pages/base.page';

export default class AlertingPage extends BasePage {
  url = 'pmm-ui/alerting/status';
  urls = {
    alertGroups: 'graph/alerting/groups',
    alertRules: 'graph/alerting/list',
    alertSettings: 'graph/alerting/admin',
    contactPoints: 'graph/alerting/notifications',
    notificationPolicies: 'graph/alerting/routes',
    silences: '/graph/alerting/silences',
    templates: 'graph/alerting/alert-rule-templates',
  };
  builders = {
    alertRow: (alertName: string) => this.page.getByRole('row').filter({ hasText: alertName }),
    columnHeader: (header: string) => this.page.getByRole('columnheader', { name: header }),
    createRuleFromTemplate: (templateName: string) =>
      this.builders.templateRow(templateName).getByTestId('create-from-template-button'),
    deleteTemplate: (templateName: string) =>
      this.builders.templateRow(templateName).getByTestId('delete-template-button'),
    editTemplate: (templateName: string) =>
      this.builders.templateRow(templateName).getByTestId('edit-template-button'),
    rowActions: (alertName: string) =>
      this.builders.alertRow(alertName).getByRole('button', { name: 'Row Actions' }),
    severityCell: (alertName: string) => this.builders.alertRow(alertName).getByRole('cell').nth(5),
    stateCell: (alertName: string) =>
      this.builders.alertRow(alertName).getByRole('cell').nth(1).locator('[class*="filled"]'),
    templateColumnHeader: (header: string) =>
      this.grafanaIframe().getByRole('columnheader', { exact: true, name: header }),
    templateRow: (templateName: string) =>
      this.grafanaIframe()
        .getByRole('row')
        .filter({ has: this.page.getByText(templateName, { exact: true }) }),
  };
  buttons = {
    addTemplate: this.grafanaIframe().getByTestId('alert-rule-template-add-modal-button'),
    cancelTemplate: this.grafanaIframe().getByTestId('alert-rule-template-cancel-button'),
    closeModal: this.grafanaIframe().getByTestId('modal-close-button'),
    confirmDelete: this.grafanaIframe().getByTestId('confirm-delete-modal-button'),
    editAlertRule: this.page.getByRole('menuitem', { name: 'Edit alert rule' }),
    newAlertRule: this.grafanaIframe().getByRole('link', { exact: true, name: 'New alert rule' }),
    newChildPolicy: this.grafanaIframe().getByRole('button', { name: 'New child policy' }),
    newContactPoint: this.grafanaIframe().getByRole('link', { name: 'add contact point' }),
    newSilence: this.grafanaIframe().getByRole('link', { name: /^(add|create) silence$/i }),
    save: this.grafanaIframe().getByRole('button', { exact: true, name: 'Save' }),
    saveRule: this.grafanaIframe().getByTestId('save-rule'),
    saveRuleAndExit: this.grafanaIframe().getByRole('button', { exact: true, name: 'Save rule and exit' }),
    saveSilence: this.grafanaIframe().getByRole('button', { name: 'Save silence' }),
    saveTemplate: this.grafanaIframe().getByTestId('alert-rule-template-edit-button'),
    settingsLink: this.page.getByTestId('settings-link'),
    silence: this.page.getByRole('menuitem', { exact: true, name: 'Silence' }),
    submitTemplate: this.grafanaIframe().getByTestId('alert-rule-template-add-button'),
    uploadFile: this.grafanaIframe().getByTestId('alert-rule-template-upload-button'),
    viewAlertRule: this.page.getByRole('menuitem', { name: 'View alert rule' }),
    viewConfiguration: this.grafanaIframe().getByRole('button', { name: 'View configuration' }),
  };
  elements = {
    alertingDisabled: this.page.getByTestId('empty-block-card'),
    deleteModalMessage: this.grafanaIframe().getByTestId('modal-content').getByRole('heading', { level: 4 }),
    groupByContainer: this.grafanaIframe().getByTestId('group-by-container'),
    modalHeader: this.grafanaIframe().getByTestId('modal-header'),
    modalWarning: this.grafanaIframe().getByTestId('alert-rule-name-warning'),
    noAlerts: this.page.getByRole('heading', { name: 'Nothing to show here yet' }),
    templateNames: this.grafanaIframe().locator('//tr/td[1]'),
    templatesTable: this.grafanaIframe().getByTestId('table-tbody'),
  };
  inputs = {
    ruleExpression: this.grafanaIframe().getByPlaceholder('Math operations on one or more queries'),
    template: this.grafanaIframe().getByTestId('yaml-textarea-input'),
    templateFile: this.grafanaIframe().getByTestId('modal-content').locator('input[type="file"]'),
  };
  messages = {
    popUp: this.grafanaIframe().getByRole('status').or(this.grafanaIframe().getByRole('alert')),
  };

  attachTemplateFile = async (path: string) => {
    await this.buttons.addTemplate.click();
    await this.inputs.templateFile.setInputFiles(path);
  };

  createTemplate = async (yaml: string) => {
    await this.buttons.addTemplate.click();
    await this.inputs.template.fill(yaml);
    await this.buttons.submitTemplate.click();
  };

  normalizeTemplate = (yaml: string) => yaml.replaceAll(/ +(?= )/g, '');

  readTemplateFile = (path: string) => {
    const content = fs.readFileSync(path, 'utf8');
    const templates = content
      .split(/^(?= {2}- name: )/m)
      .slice(1)
      .map((chunk) => ({
        name: chunk.match(/^ {2}- name: (.+)$/m)?.[1] ?? '',
        summary: chunk.match(/^ {4}summary: (.+)$/m)?.[1] ?? '',
        yaml: `templates:\n${chunk.trimEnd()}\n`,
      }));

    return { content, templates };
  };

  silenceAlert = async (alertName: string) => {
    await this.builders.rowActions(alertName).click();
    await this.buttons.silence.click();
    await this.buttons.saveSilence.click();
  };
}

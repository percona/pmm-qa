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
    rowActions: (alertName: string) =>
      this.builders.alertRow(alertName).getByRole('button', { name: 'Row Actions' }),
    severityCell: (alertName: string) => this.builders.alertRow(alertName).getByRole('cell').nth(5),
    stateCell: (alertName: string) =>
      this.builders.alertRow(alertName).getByRole('cell').nth(1).locator('[class*="filled"]'),
  };
  buttons = {
    addTemplate: this.grafanaIframe().getByTestId('alert-rule-template-add-modal-button'),
    editAlertRule: this.page.getByRole('menuitem', { name: 'Edit alert rule' }),
    newAlertRule: this.grafanaIframe().getByRole('link', { exact: true, name: 'New alert rule' }),
    newChildPolicy: this.grafanaIframe().getByRole('button', { name: 'New child policy' }),
    newContactPoint: this.grafanaIframe().getByRole('link', { name: 'add contact point' }),
    newSilence: this.grafanaIframe().getByRole('link', { name: /^(add|create) silence$/i }),
    saveRule: this.grafanaIframe().getByTestId('save-rule'),
    saveSilence: this.grafanaIframe().getByRole('button', { name: 'Save silence' }),
    settingsLink: this.page.getByTestId('settings-link'),
    silence: this.page.getByRole('menuitem', { exact: true, name: 'Silence' }),
    viewAlertRule: this.page.getByRole('menuitem', { name: 'View alert rule' }),
    viewConfiguration: this.grafanaIframe().getByRole('button', { name: 'View configuration' }),
  };
  elements = {
    alertingDisabled: this.page.getByTestId('empty-block-card'),
    groupByContainer: this.grafanaIframe().getByTestId('group-by-container'),
    noAlerts: this.page.getByRole('heading', { name: 'Nothing to show here yet' }),
  };
  inputs = {
    ruleExpression: this.grafanaIframe().getByPlaceholder('Math operations on one or more queries'),
  };
  messages = {
    popUp: this.grafanaIframe().getByRole('status').or(this.grafanaIframe().getByRole('alert')),
  };

  silenceAlert = async (alertName: string) => {
    await this.builders.rowActions(alertName).click();
    await this.buttons.silence.click();
    await this.buttons.saveSilence.click();
  };
}

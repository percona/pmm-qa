const { I } = inject();
const assert = require('assert');

const alertRow = (alertName) => `//tbody/tr[td[contains(., "${alertName}")]]`;

module.exports = {
  url: 'pmm-ui/alerting/status',
  columnHeaders: ['State', 'Name', 'Node', 'Service', 'Triggered at'],
  alertStatus: {
    firing: 'Firing',
    silenced: 'Silenced',
    pending: 'Pending',
    inactive: 'Inactive',
    normal: 'Normal',
  },
  elements: {
    pageHeader: 'h3[text()="Alert status"]',
    alertRow: (alertName) => alertRow(alertName),
    stateCell: (alertName) => locate(`${alertRow(alertName)}/td[2]`).find('[class*="filled"]'),
    severityCell: (alertName) => `${alertRow(alertName)}/td[6]`,
    criticalSeverity: '//td[6][contains(., "Critical")]',
    errorSeverity: '//td[6][contains(., "Error")]',
    noticeSeverity: '//td[6][contains(., "Notice")]',
    warningSeverity: '//td[6][contains(., "Warning")]',
    emergencySeverity: '//td[6][contains(., "Emergency")]',
    alertSeverity: '//td[6][contains(., "Alert")]',
    debugSeverity: '//td[6][contains(., "Debug")]',
    infoSeverity: '//td[6][contains(., "Info")]',
    columnHeaderLocator: (columnHeaderText) => `//th//div[contains(text(), "${columnHeaderText}")]`,
    noAlerts: locate('h6').withText('Nothing to show here yet'),
    firedAlertLink: (alertName) => `//a[text()="${alertName}"]`,
  },
  buttons: {
    // silenceActivate returns silence/activate button locator for a given alert name
    silenceActivate: (alertName) => `${alertRow(alertName)}[1]/td//a[span[text()="Silence"]]`,
    silenceButton: locate('[role="menuitem"]').withText('Silence'),
    viewAlertRule: locate('[role="menuitem"]').withText('View alert rule'),
    editAlertRule: locate('[role="menuitem"]').withText('Edit alert rule'),
    submitSilence: locate('button').withText('Save silence'),
    arrowIcon: (alertName) => locate(`${alertRow(alertName)}`).find('$show-details'),
    rowActions: (alertName) => locate(alertRow(alertName)).find('[aria-label="Row Actions"]'),
  },
  messages: {
    noAlertsFound: 'No alerts',
    successfullySilenced: 'Silence created',
    successfullyActivated: 'Alert activated',
  },
  colors: {
    critical: 'rgb(212, 74, 58)',
    error: 'rgb(235, 123, 24)',
    notice: 'rgb(50, 116, 217)',
    warning: 'rgb(236, 187, 19)',
    silence: 'rgb(204, 204, 220)',
  },

  openRowActions(alertName) {
    I.waitForVisible(this.buttons.rowActions(alertName), 10);
    I.click(this.buttons.rowActions(alertName));
    I.waitForVisible(this.buttons.viewAlertRule);
  },

  async silenceAlert(alertName) {
    this.openRowActions(alertName);

    I.waitForVisible(this.buttons.silenceButton, 10);
    I.click(this.buttons.silenceButton);
    I.switchTo('#grafana-iframe');
    I.waitForVisible(this.buttons.submitSilence, 10);
    I.click(this.buttons.submitSilence);
    I.verifyPopUpMessage(this.messages.successfullySilenced);
  },

  async navigateToEditAlertRule(alertName) {
    this.openRowActions(alertName);

    I.waitForVisible(this.buttons.editAlertRule);
    I.click(this.buttons.editAlertRule);
  },

  async verifyAlert(alertName, silenced = false) {
    I.waitForVisible(this.elements.alertRow(alertName), 10);

    if (silenced) {
      I.see(this.alertStatus.silenced, this.elements.stateCell(alertName));
    } else {
      I.see(this.alertStatus.firing, this.elements.stateCell(alertName));
    }
  },

  // TODO: move to silencesPage
  async activateAlert(alertName) {
    const title = await I.grabAttributeFrom(`${this.buttons.silenceActivate(alertName)}`, 'title');

    if (title === 'Activate') {
      const bgColorBeforeAction = await I.grabCssPropertyFrom(`${this.elements.alertRow(alertName)}/td`, 'background-color');

      I.click(`${this.buttons.silenceActivate(alertName)}`);
      I.verifyPopUpMessage(this.messages.successfullyActivated);
      I.seeTextEquals('Firing', this.elements.stateCell(alertName));
      const bgColorAfterAction = await I.grabCssPropertyFrom(`${this.elements.alertRow(alertName)}/td`, 'background-color');

      assert.ok(bgColorBeforeAction !== bgColorAfterAction, 'Cell background color should change after activating the alert');
    }
  },
};

const { I } = inject();
const assert = require('assert');

const alertRow = (alertName) => `//tr[td[contains(., "${alertName}")]]`;

module.exports = {
  url: 'graph/alerting/alerts',
  columnHeaders: ['Triggered by rule', 'State', 'Summary', 'Severity', 'Active since', 'Last triggered', 'Actions'],
  elements: {
    pageHeader: '//div[@class="page-header"]//h1[text()="Alerting"]',
    alertRow: (alertName) => alertRow(alertName),
    stateCell: (alertName) => `${alertRow(alertName)}/td[2]`,
    severityCell: (alertName) => `${alertRow(alertName)}/td[4]`,
    criticalSeverity: '//td[4]/span[text()="Critical"]',
    errorSeverity: '//td[4]/span[text()="Error"]',
    noticeSeverity: '//td[4]/span[text()="Notice"]',
    warningSeverity: '//td[4]/span[text()="Warning"]',
    emergencySeverity: '//td[4]/span[text()="Emergency"]',
    alertSeverity: '//td[4]/span[text()="Alert"]',
    debugSeverity: '//td[4]/span[text()="Debug"]',
    infoSeverity: '//td[4]/span[text()="Info"]',
    columnHeaderLocator: (columnHeaderText) => `//th[text()="${columnHeaderText}"]`,
    noAlerts: locate('$table-no-data').withText('No alerts detected'),
    firedAlertLink: (alertName) => `//a[text()="${alertName}"]`,
  },
  buttons: {
    // silenceActivate returns silence/activate button locator for a given alert name
    silenceActivate: (alertName) => `${alertRow(alertName)}[1]/td//a[span[text()="Silence"]]`,
    submitSilence: 'button[type=\'submit\']',
    arrowIcon: (alertName) => locate(`${alertRow(alertName)}`).find('$show-details'),
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

  async silenceAlert(alertName) {
    I.waitForVisible(this.buttons.silenceActivate(alertName, 10));
    I.click(this.buttons.silenceActivate(alertName));
    I.click(this.buttons.submitSilence);
    I.verifyPopUpMessage(this.messages.successfullySilenced);
  },

  async verifyAlert(alertName, silenced = false) {
    I.waitForVisible(this.elements.alertRow(alertName), 10);
    const bgColor = await I.grabCssPropertyFrom(
      `${this.elements.alertRow(alertName)}/td`,
      'background-color',
    );

    if (silenced) {
      I.seeTextEquals('Silenced', this.elements.stateCell(alertName));

      assert.ok(
        bgColor !== 'rgb(24, 27, 31)',
        `Silenced alert should have different background color. Found ${bgColor}.`,
      );
    } else {
      I.see('Active', this.elements.stateCell(alertName));

      assert.ok(
        bgColor === 'rgb(24, 27, 31)',
        `Active alert should have different background color. Expected rgb(24, 27, 31) but found ${bgColor}.`,
      );
    }
  },

  // TODO: move to silencesPage
  async activateAlert(alertName) {
    const title = await I.grabAttributeFrom(`${this.buttons.silenceActivate(alertName)}`, 'title');

    if (title === 'Activate') {
      const bgColorBeforeAction = await I.grabCssPropertyFrom(
        `${this.elements.alertRow(alertName)}/td`,
        'background-color',
      );

      I.click(`${this.buttons.silenceActivate(alertName)}`);
      I.verifyPopUpMessage(this.messages.successfullyActivated);
      I.seeTextEquals('Firing', this.elements.stateCell(alertName));
      const bgColorAfterAction = await I.grabCssPropertyFrom(
        `${this.elements.alertRow(alertName)}/td`,
        'background-color',
      );

      assert.ok(
        bgColorBeforeAction !== bgColorAfterAction,
        'Cell background color should change after activating the alert',
      );
    }
  },
};

const contactPointsAPI = require('./pages/api/contactPointsAPI');
const { users } = require('../helper/constants');

const ruleName = 'PSQL immortal rule';
const ruleFolder = 'PostgreSQL';
const rulesForAlerts = [
  {
    severity: 'SEVERITY_CRITICAL',
    text: 'Critical',
  },
  {
    severity: 'SEVERITY_ERROR',
    text: 'Error',
  },
  {
    severity: 'SEVERITY_NOTICE',
    text: 'Notice',
  },
  {
    severity: 'SEVERITY_WARNING',
    text: 'Warning',
  },
  {
    severity: 'SEVERITY_ALERT',
    text: 'Alert',
  },
  {
    severity: 'SEVERITY_INFO',
    text: 'Info',
  },
  {
    severity: 'SEVERITY_DEBUG',
    text: 'Debug',
  },
  {
    severity: 'SEVERITY_EMERGENCY',
    text: 'Emergency',
  },
];

Feature('Alerting: Alerts');

Before(async ({ I }) => {
  await I.Authorize();
});

BeforeSuite(async ({ I, rulesAPI, settingsAPI }) => {
  await settingsAPI.apiEnableIA();
  await rulesAPI.removeAllAlertRules();
  await contactPointsAPI.createContactPoints();
  await rulesAPI.createAlertRule({ ruleName }, ruleFolder);
  const viewerId = await I.createUser(users.viewer.username, users.viewer.password);
  const editorId = await I.createUser(users.editor.username, users.editor.password);

  await I.setRole(viewerId);
  await I.setRole(editorId, 'Editor');
});

AfterSuite(async ({ rulesAPI, I }) => {
  await rulesAPI.removeAllAlertRules();
});

Scenario('PMM-T1482 PMM-T1494 + PMM-T1495 - Verify fired alert in Pager Duty and Webhook @ia', async ({ I, alertsPage, rulesAPI, alertsAPI }) => {
  await alertsAPI.waitForAlerts(24, 1);
  await I.amOnPage(alertsPage.url);
  alertsPage.columnHeaders.forEach((header) => {
    const columnHeader = alertsPage.elements.columnHeaderLocator(header);

    I.waitForVisible(columnHeader, 10);
  });

  // Verify there are no duplicate alerts
  await I.seeNumberOfElements(alertsPage.elements.alertRow(ruleName), 1);
  // Wait for the firing alert to arrive in webhook and PD
  await I.wait(60);

  // Verify fired alert in Webhook
  const file = './testdata/ia/scripts/alert.txt';
  const alertUID = await rulesAPI.getAlertUID(ruleName, ruleFolder);

  await alertsAPI.waitForAlerts(24, 1);
  await contactPointsAPI.createContactPoints();
  // Webhook notification check
  I.waitForFile(file, 180);
  I.seeFile(file);

  // Pager Duty notification check
  // await alertsAPI.verifyAlertInPagerDuty(alertUID);
});

Scenario('PMM-T1997 - verify viewer can not silence alert @ia', async ({ I, alertsPage, alertsAPI }) => {
  await I.Authorize(users.viewer.username, users.viewer.password);

  await alertsAPI.waitForAlerts(24, 1);

  I.amOnPage(alertsPage.url);
  I.waitForElement(alertsPage.elements.alertRow(ruleName), 20);
  I.seeNumberOfElements(alertsPage.elements.alertRow(ruleName), 1);
  await alertsPage.openRowActions(ruleName);
  I.dontSeeElement(alertsPage.buttons.silenceButton);
  I.dontSeeElement(alertsPage.buttons.editAlertRule);
});

Scenario(
  'PMM-T1998 - verify editor is able to silence and unsilence alert @ia',
  async ({
    I, alertsPage, alertmanagerAPI, alertsAPI,
  }) => {
    await I.Authorize(users.editor.username, users.editor.password);

    await alertsAPI.waitForAlerts(24, 1);
    I.amOnPage(alertsPage.url);
    await alertsPage.verifyAlert(ruleName);
    await alertsPage.silenceAlert(ruleName);
    I.amOnPage(alertsPage.url);
    await alertsPage.verifyAlert(ruleName, true);
    const silences = await alertmanagerAPI.getSilenced();

    await alertmanagerAPI.deleteSilences(silences);
    I.amOnPage(alertsPage.url);
    await alertsPage.verifyAlert(ruleName, false);
  },
);

Scenario(
  'PMM-T1496 + PMM-T1497 - Verify it is possible to silence and unsilence alert @ia',
  async ({
    I, alertsPage, alertmanagerAPI, alertsAPI,
  }) => {
    await alertsAPI.waitForAlerts(24, 1);
    I.amOnPage(alertsPage.url);
    await alertsPage.verifyAlert(ruleName);
    await alertsPage.silenceAlert(ruleName);
    I.amOnPage(alertsPage.url);
    await alertsPage.verifyAlert(ruleName, true);
    const silences = await alertmanagerAPI.getSilenced();

    await alertmanagerAPI.deleteSilences(silences);
    I.amOnPage(alertsPage.url);
    await alertsPage.verifyAlert(ruleName, false);
  },
);

Scenario(
  'PMM-T1498 - Verify firing alerts disappear when the condition is fixed @ia',
  async ({ I, alertsPage, alertRulesPage }) => {
    I.amOnPage(alertsPage.url);
    I.waitForVisible(alertsPage.elements.alertRow(ruleName));

    alertsPage.navigateToEditAlertRule(ruleName);
    I.switchTo('#grafana-iframe');
    I.waitForVisible(alertRulesPage.fields.editRuleThreshold, 10);
    I.scrollTo(alertRulesPage.fields.editRuleThreshold);
    I.waitForVisible(alertRulesPage.fields.editRuleExpression, 10);
    I.clearField(alertRulesPage.fields.editRuleExpression);
    I.fillField(alertRulesPage.fields.editRuleExpression, '$A > 10');
    I.click(alertRulesPage.buttons.saveEditRule);

    I.amOnPage(alertsPage.url);
    await I.asyncWaitFor(async () => {
      const state = await I.grabTextFrom(alertsPage.elements.stateCell(ruleName));

      return state === alertsPage.alertStatus.normal;
    }, 100);
    I.see(alertsPage.alertStatus.normal, alertsPage.elements.stateCell(ruleName));
  },
);

// FIXME: Skip until https://jira.percona.com/browse/PMM-11130 is fixed
Scenario('PMM-T659 - Verify alerts are deleted after deleting rules @ia', async ({ I, alertsPage, rulesAPI }) => {
  // Deleting rules
  await rulesAPI.removeAllAlertRules();

  I.amOnPage(alertsPage.url);
  I.waitForElement(alertsPage.elements.noAlerts, 20);
});

Scenario.skip(
  'PMM-T1499 - Verify an alert with non-existing filter (label) does not show up in list @fb-alerting',
  async ({ I, alertsPage, rulesAPI }) => {
    await rulesAPI.removeAllAlertRules();
    const wrongFilterRule = {
      ruleName: 'wrongFilterRule',
      filters: [
        {
          label: 'service_name',
          regexp: 'wrong-service',
          type: 'FILTER_TYPE_MATCH',
        },
      ],
    };

    await rulesAPI.createAlertRule(wrongFilterRule, 'Insight');
    I.amOnPage(alertsPage.url);
    I.wait(100);
    I.seeElement(alertsPage.elements.noAlerts);
  },
);

Scenario('PMM-T564 - Verify fired alert severity colors @ia', async ({
  I, alertsPage, rulesAPI, alertsAPI,
}) => {
  await rulesAPI.removeAllAlertRules();
  for (const rule of rulesForAlerts) {
    await rulesAPI.createAlertRule({ ruleName: rule.severity, severity: rule.severity }, ruleFolder);
  }

  await alertsAPI.waitForAlerts(24, 8);
  await I.wait(10);
  await I.amOnPage(alertsPage.url);
  for (const rule of rulesForAlerts) {
    I.waitForElement(alertsPage.elements.alertRow(rule.severity), 10);
    I.waitForText(alertsPage.alertStatus.firing, 10, alertsPage.elements.stateCell(rule.severity));
    I.see(rule.text, alertsPage.elements.severityCell(rule.severity));
  }
});

Scenario('PMM-T1467 - Verify empty Fired alerts list @fb-alerting', async ({ I, alertsPage, rulesAPI }) => {
  await rulesAPI.removeAllAlertRules();
  I.amOnPage(alertsPage.url);
  I.waitForVisible(alertsPage.elements.noAlerts, 10);
  I.seeElement(alertsPage.elements.noAlerts);
});

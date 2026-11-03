const assert = require('assert');

Feature('PMM upgrade tests for alerting');

const ruleName = 'Alert Rule for upgrade';

Before(async ({ I }) => {
  I.Authorize();
});

Scenario(
  'PMM-T577 - Verify user is able to see IA alerts before upgrade @pre-advisors-alerting-upgrade',
  async ({
    settingsAPI, rulesAPI, alertsAPI,
  }) => {
    await settingsAPI.changeSettings({ alerting: true });
    await rulesAPI.removeAllAlertRules(true);
    const ruleFolder = 'MySQL';

    await rulesAPI.createAlertRule({ ruleName, filters: [{ label: 'node_name', regexp: 'pmm-server', type: 'FILTER_TYPE_MATCH' }] }, ruleFolder, 'pmm_node_high_cpu_load');

    // Wait for alert to appear
    await alertsAPI.waitForAlerts(60, 1);
  },
);

Scenario(
  'PMM-T577 Verify user can see IA alerts after upgrade @post-advisors-alerting-upgrade',
  async ({
    I, alertsPage, alertsAPI,
  }) => {
    const alertName = 'Node high CPU load';

    I.amOnPage(alertsPage.url);
    I.waitForElement(alertsPage.elements.alertRow(ruleName), 120);

    await alertsAPI.waitForAlerts(10, 1);
    const alerts = await alertsAPI.getAlertsList();

    assert.ok(alerts[0].annotations.summary.includes(alertName), `Didn't find alert with name ${alertName}`);

    I.waitForElement(alertsPage.elements.alertRow(ruleName), 60);
  },
);

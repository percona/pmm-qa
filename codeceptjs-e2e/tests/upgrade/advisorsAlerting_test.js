const assert = require('assert');

Feature('PMM upgrade tests for advisors and alerting');

const advisorName = 'Check for unsupported PostgreSQL';
const groupName = 'Version Configuration';
const ruleName = 'Alert Rule for upgrade';
const checkName = 'MongoDB version check';
const beforeUpgradePmmVersion = process.env.CLIENT_VERSION ? parseInt(process.env.CLIENT_VERSION.replace(/\./g, ''), 10) : 300;

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
    const ruleFolder = 'PostgreSQL';

    await rulesAPI.createAlertRule({ ruleName, filters: [{ label: 'node_name', regexp: 'pmm-server', type: 'FILTER_TYPE_MATCH' }] }, ruleFolder, 'pmm_node_high_cpu_load');
    // Wait for alert to appear
    await alertsAPI.waitForAlerts(60, 1);
  },
);

Scenario(
  'Change advisors intervals before the upgrade @pre-advisors-alerting-upgrade',
  async ({
    I,
    advisorsPage,
  }) => {
    I.amOnPage(advisorsPage.urlConfiguration);
    I.waitForVisible(advisorsPage.elements.advisorsGroupHeader(groupName));
    I.click(advisorsPage.elements.advisorsGroupHeader(groupName));
    I.click(advisorsPage.buttons.openChangeInterval(advisorName));
    I.click(advisorsPage.buttons.intervalValue('Frequent'));
    I.click(advisorsPage.buttons.applyIntervalChange);
    I.waitForText('Frequent', 5, advisorsPage.elements.intervalCellByName(advisorName));
  },
);

Scenario('Disable advisor before upgrade @pre-advisors-alerting-upgrade', async ({
  I,
  advisorsPage,
}) => {
  if (beforeUpgradePmmVersion > 340) {
    I.amOnPage(advisorsPage.urlConfiguration);
    I.waitForVisible(advisorsPage.elements.advisorsGroupHeader(groupName));
    I.click(advisorsPage.elements.advisorsGroupHeader(groupName));
    I.waitForVisible(advisorsPage.buttons.disableEnableCheck(checkName));
    I.click(advisorsPage.buttons.disableEnableCheck(checkName));
    I.seeTextEquals('Enable', advisorsPage.buttons.disableEnableCheck(checkName));
  }
});

Scenario(
  'Verify advisors intervals remain the same after upgrade @post-advisors-alerting-upgrade',
  async ({
    I,
    advisorsPage,
  }) => {
    I.amOnPage(advisorsPage.urlConfiguration);
    I.waitForVisible(advisorsPage.elements.advisorsGroupHeader(groupName));
    I.click(advisorsPage.elements.advisorsGroupHeader(groupName));
    const advisorInterval = await I.grabTextFrom(advisorsPage.elements.intervalCellByName(advisorName));

    I.assertTrue(advisorInterval === 'Frequent', `Expected advisor interval to be: "Frequent", but actual advisor interval is: ${advisorInterval}`);
  },
);

Scenario(
  'Verify disabled advisor remain disabled after upgrade @post-advisors-alerting-upgrade',
  async ({
    I,
    advisorsPage,
  }) => {
    if (beforeUpgradePmmVersion > 340) {
      I.amOnPage(advisorsPage.urlConfiguration);
      I.waitForVisible(advisorsPage.elements.advisorsGroupHeader(groupName));
      I.click(advisorsPage.elements.advisorsGroupHeader(groupName));

      I.waitForVisible(advisorsPage.buttons.disableEnableCheck(checkName));
      I.seeTextEquals('Enable', advisorsPage.buttons.disableEnableCheck(checkName));
    }
  },
);

const rareInterval = '48';
const standardInterval = '12';
const frequentInterval = '2';

Scenario(
  'Set settings for intervals before the upgrade @pre-advisors-alerting-upgrade',
  async ({
    I,
    pmmSettingsPage,
  }) => {
    I.amOnPage(pmmSettingsPage.advancedSettingsUrl);
    I.waitForVisible(pmmSettingsPage.fields.rareIntervalInput, 30);
    I.fillField(pmmSettingsPage.fields.rareIntervalInput, rareInterval);
    I.fillField(pmmSettingsPage.fields.standartIntervalInput, standardInterval);
    I.fillField(pmmSettingsPage.fields.frequentIntervalInput, frequentInterval);
    I.click(pmmSettingsPage.fields.advancedButton);
    I.waitForValue(pmmSettingsPage.fields.rareIntervalInput, rareInterval, 5);
    I.waitForValue(pmmSettingsPage.fields.standartIntervalInput, standardInterval, 5);
    I.waitForValue(pmmSettingsPage.fields.frequentIntervalInput, frequentInterval, 5);
  },
);

Scenario(
  'Verify settings for intervals remain the same after upgrade @post-advisors-alerting-upgrade',
  async ({
    I,
    pmmSettingsPage,
  }) => {
    I.amOnPage(pmmSettingsPage.advancedSettingsUrl);
    I.waitForVisible(pmmSettingsPage.fields.rareIntervalInput, 30);

    I.seeInField(pmmSettingsPage.fields.rareIntervalInput, rareInterval);
    I.seeInField(pmmSettingsPage.fields.standartIntervalInput, standardInterval);
    I.seeInField(pmmSettingsPage.fields.frequentIntervalInput, frequentInterval);
  },
);

Scenario(
  'PMM-T577 Verify user can see IA alerts after upgrade @post-advisors-alerting-upgrade',
  async ({
    I, alertsPage, alertsAPI,
  }) => {
    const alertName = 'Node high CPU load (pmm-server)';

    await alertsAPI.waitForAlerts(60, 1);
    const alerts = await alertsAPI.getAlertsList();

    assert.ok(alerts[0].annotations.summary === alertName, `Didn't find alert with name ${alertName}`);

    I.amOnPage(alertsPage.url);
    I.waitForElement(alertsPage.elements.alertRow(alertName), 30);
  },
);

Scenario(
  'PMM-T268 - Verify Failed check singlestats after upgrade from old versions @post-advisors-alerting-upgrade',
  async ({
    I, homePage,
  }) => {
    await homePage.open();
    I.dontSeeElement(homePage.fields.sttDisabledFailedChecksPanelSelector, 15);
    I.waitForVisible(homePage.fields.failedChecksPanelContent, 30);
  },
);

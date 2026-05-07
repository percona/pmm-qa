const assert = require('assert');
const page = require('./pages/alertRulesPage');
const rulesAPI = require('./pages/api/rulesAPI');
const { users } = require('../helper/constants');

const rules = new DataTable(['template', 'templateType', 'ruleName', 'threshold', 'thresholdUnit', 'duration',
  'severity', 'filters', 'channels', 'activate']);

Object.values(page.rules).forEach((rule) => {
  rules.add([rule.template, rule.templateType, rule.ruleName, rule.threshold,
    rule.thresholdUnit, rule.duration, rule.severity, rule.filters, rule.channels, rule.activate]);
});

const templates = new DataTable(['template', 'threshold', 'duration', 'severity', 'expression', 'alert']);

Object.values(page.templates).forEach((template) => {
  templates.add([template.template, template.threshold, template.duration, template.severity,
    template.expression, template.alert]);
});

Feature('Alerting: Alert rules');

BeforeSuite(async ({ I }) => {
  const viewerId = await I.createUser(users.viewer.username, users.viewer.password);
  const editorId = await I.createUser(users.editor.username, users.editor.password);

  await I.setRole(viewerId);
  await I.setRole(editorId, 'Editor');
});

Before(async ({ I }) => {
  await I.Authorize();
  await rulesAPI.removeAllAlertRules();
});

After(async () => {
  await rulesAPI.removeAllAlertRules();
});

Scenario(
  'PMM-T1384 - Verify empty alert rules list @fb-alerting @grafana-pr',
  async ({ I, alertRulesPage }) => {
    alertRulesPage.openAlertRulesTab();
    I.waitForText(alertRulesPage.messages.noRulesFound, 10, alertRulesPage.elements.noRules);
    I.waitForVisible(alertRulesPage.buttons.newAlertRule, 10);
    I.waitForVisible(alertRulesPage.elements.alertsLearnMoreLinks, 10);
    const link = await I.grabAttributeFrom(alertRulesPage.elements.alertsLearnMoreLinks, 'href');
    const expectedLink = 'https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/';

    assert.ok(link === expectedLink, `Redirect link ${link} is incorrect please check`);
  },
).retry(0);

Scenario(
  'PMM-T1385 - Verify alert rules elements @fb-alerting @grafana-pr',
  async ({ I, alertRulesPage, rulesAPI }) => {
    const ruleName = 'testRule';
    const ruleFolder = 'PostgreSQL';

    await rulesAPI.createAlertRule({ ruleName }, ruleFolder);

    alertRulesPage.openAlertRulesTab();
    I.seeElement(alertRulesPage.elements.searchByDataSourceDropdown);
    I.seeElement(alertRulesPage.elements.searchByLabel);
    alertRulesPage.alertRuleFilters.forEach((filter) => {
      const ruleFilter = alertRulesPage.elements.ruleFilterLocator(filter);

      I.waitForVisible(ruleFilter, 10);
    });
    I.waitForVisible(alertRulesPage.buttons.groupCollapseButton(ruleFolder), 10);
    I.click(alertRulesPage.buttons.groupCollapseButton(ruleFolder));
    alertRulesPage.columnHeaders.forEach((header) => {
      const columnHeader = alertRulesPage.elements.columnHeaderLocator(header);

      I.waitForVisible(columnHeader, 30);
    });
    I.seeElement(alertRulesPage.elements.alertRuleNameByName(ruleName));
    await rulesAPI.removeAlertRule(ruleFolder);
  },
);

Scenario(
  'PMM-T1996 - verify viewer cannot create alert rules @fb-alerting @grafana-pr',
  async ({ I, alertRulesPage }) => {
    await I.Authorize(users.viewer.username, users.viewer.password);
    I.amOnPage(alertRulesPage.url);
    I.waitForElement(alertRulesPage.elements.noRules);
    I.dontSeeElement(alertRulesPage.buttons.newAlertRule);

    I.amOnPage(alertRulesPage.newRuleFromTemplateUrl);
    I.waitForText('Insufficient access permissions.', 10, alertRulesPage.elements.unathorizedMessage);
  },
);

Scenario(
  'Verify opening New Alert Rule from Template @ia @grafana-pr',
  async ({ I, alertRulesPage }) => {
    alertRulesPage.openAlertRulesTab();
    I.waitForElement(alertRulesPage.buttons.newAlertRuleFromTemplate, 10);
    I.usePlaywrightTo('click New Alert Rule from Template button', async ({ page }) => {
      await page.click(alertRulesPage.buttons.newAlertRuleFromTemplate.value);
    });
    I.waitForElement(alertRulesPage.fields.templatesLoader, 10);
  },
).retry(2);

Scenario(
  'PMM-T1392 - Verify fields dynamically change value when template is changed @fb-alerting @grafana-pr',
  async ({ I, alertRulesPage }) => {
    alertRulesPage.openAlertRuleFromTemplatePage();
    await alertRulesPage.searchAndSelectResult('template', 'PostgreSQL down');
    I.waitForValue(alertRulesPage.fields.inputField('duration'), '60s');
    I.seeTextEquals('Critical', alertRulesPage.fields.dropdownValue('severity'));
    await alertRulesPage.searchAndSelectResult('template', 'MySQL restarted');
    I.waitForValue(alertRulesPage.fields.inputField('threshold'), 300);
    I.waitForValue(alertRulesPage.fields.inputField('duration'), '60s');
    I.seeTextEquals('Warning', alertRulesPage.fields.dropdownValue('severity'));
  },
).retry(2);

const usersTable = new DataTable(['username', 'password']);

usersTable.add(['admin', '']);
usersTable.add([users.editor.username, users.editor.password]);

Data(usersTable).Scenario(
  'PMM-T1420 + PMM-T1992 - Verify user can create Percona templated alert @fb-alerting',
  async ({
    I, alertRulesPage, rulesAPI, current,
  }) => {
    if (current.username !== 'admin') await I.Authorize(current.username, current.password);

    const rule = page.rules[15];
    const newRule = page.rules[0];

    newRule.ruleName = `${newRule.ruleName}_${current.username}`;

    alertRulesPage.openAlertRulesTab();
    I.waitForVisible(alertRulesPage.buttons.newAlertRuleFromTemplate);
    I.waitForEnabled(alertRulesPage.buttons.newAlertRuleFromTemplate);
    I.click(alertRulesPage.buttons.newAlertRuleFromTemplate);
    await alertRulesPage.fillPerconaAlert(rule, newRule);
    I.waitForEnabled(alertRulesPage.buttons.saveAndExit);
    I.click(alertRulesPage.buttons.saveAndExit);
    // FIXME: unskip after https://jira.percona.com/browse/PMM-11399 is fixed
    // I.verifyPopUpMessage(alertRulesPage.messages.successRuleCreate(newRule.ruleName));
    alertRulesPage.verifyRuleList(newRule.folder, newRule.ruleName);
    await alertRulesPage.verifyRuleState('Normal', 60);
    await rulesAPI.removeAlertRule(newRule.folder);
  },
).retry(1);

// TODO: unskip in scope of https://perconadev.atlassian.net/browse/PMM-12938
Scenario.skip(
  'PMM-T2282 - Verify Alerting is able to monitor for "PMM Agent Down" @fb-alerting',
  async ({ I, alertRulesPage, rulesAPI }) => {
    const rule = page.rules[29];
    const newRule = page.rules[30];

    alertRulesPage.openAlertRulesTab();
    I.waitForEnabled(alertRulesPage.buttons.newAlertRule, 10);
    I.click(alertRulesPage.buttons.newAlertRule);
    await alertRulesPage.fillPerconaAlert(rule, newRule);
    I.waitForEnabled(alertRulesPage.buttons.saveAndExit, 10);
    I.click(alertRulesPage.buttons.saveAndExit);
    // FIXME: unskip after https://jira.percona.com/browse/PMM-11399 is fixed
    // I.verifyPopUpMessage(alertRulesPage.messages.successRuleCreate(newRule.ruleName));
    await alertRulesPage.verifyRuleList(newRule.folder, newRule.ruleName);
    await I.verifyCommand('docker pause ms_pmm_8.0');
    await alertRulesPage.verifyRuleState('Pending', 180);
    // await I.waitForText('Pending', 180, alertRulesPage.elements.ruleState1);
    await alertRulesPage.verifyRuleState('Firing', 180);
    // await I.waitForText('Firing', 180, alertRulesPage.elements.ruleState2);
    await I.verifyCommand('docker unpause ms_pmm_8.0');
    // await I.waitForText('Normal', 180, alertRulesPage.elements.ruleState3);
    await alertRulesPage.verifyRuleState('Normal', 240);
    await rulesAPI.removeAlertRule(newRule.folder);
  },
);

// TODO: check ovf failure
Scenario(
  'PMM-T1430 - Verify user can edit Percona templated alert @fb-alerting @not-ovf',
  async ({
    I, alertRulesPage, rulesAPI,
  }) => {
    const ruleName = 'testRule';
    const ruleFolder = 'PostgreSQL';
    const editedRule = {
      ruleName: 'EDITED rule',
      duration: '2m',
      folder: 'PostgreSQL',
    };

    await rulesAPI.createAlertRule({ ruleName }, ruleFolder);
    alertRulesPage.openAlertRulesTab();
    alertRulesPage.verifyRuleList(ruleFolder, ruleName);
    I.waitForElement(alertRulesPage.buttons.ruleCollapseButton);
    I.click(alertRulesPage.buttons.ruleCollapseButton);
    I.click(alertRulesPage.buttons.editAlertRule);
    await alertRulesPage.editPerconaAlert(editedRule);
    await alertRulesPage.verifyRuleDetails(editedRule);
    await rulesAPI.removeAlertRule(editedRule.folder);
  },
);

Scenario(
  'PMM-T1433 - Verify user can delete Percona templated alert @fb-alerting',
  async ({
    I, alertRulesPage, rulesAPI, iaCommon,
  }) => {
    const ruleName = 'testRule';
    const ruleFolder = 'OS';

    await rulesAPI.createAlertRule({ ruleName }, ruleFolder);
    alertRulesPage.openAlertRulesTab();
    alertRulesPage.verifyRuleList(ruleFolder, ruleName);
    I.waitForElement(alertRulesPage.buttons.ruleCollapseButton);
    I.click(alertRulesPage.buttons.ruleCollapseButton);
    alertRulesPage.openMoreMenu(ruleName);
    I.click(alertRulesPage.buttons.deleteAlertRule);
    I.waitForText(alertRulesPage.messages.confirmDelete, iaCommon.elements.modalDialog);
    I.click(alertRulesPage.buttons.cancelModal);
    alertRulesPage.openMoreMenu(ruleName);
    I.click(alertRulesPage.buttons.deleteAlertRule);
    I.waitForElement(iaCommon.elements.modalDialog, 10);
    I.click(alertRulesPage.buttons.confirmModal);
    I.verifyPopUpMessage(alertRulesPage.messages.successfullyDeleted);
    I.dontSeeElement(alertRulesPage.buttons.groupCollapseButton(ruleFolder));
    I.waitForText(alertRulesPage.messages.noRulesFound, alertRulesPage.elements.noRules);
  },
);

// nightly candidate
// FIXME: flaky test fix and unskip
Scenario.skip(
  'PMM-T1434 - Verify validation errors when creating new alert rule @fb-alerting @grafana-pr',
  async ({
    I, alertRulesPage,
  }) => {
    const rule = page.rules[2];
    const wrongRule = {
      threshold: '-1',
      duration: '0',
    };

    alertRulesPage.openAlertRulesTab();
    I.click(alertRulesPage.buttons.openAddRuleModal);
    await alertRulesPage.fillPerconaAlert(rule, wrongRule);
    I.clearField(alertRulesPage.fields.inputField('name'));
    I.click(alertRulesPage.buttons.saveAndExit);
    I.verifyPopUpMessage(alertRulesPage.messages.failRuleCreate);
    I.seeElement(alertRulesPage.elements.ruleValidationError('Must enter an alert name'));
    I.seeElement(alertRulesPage.elements.ruleValidationError('Must be at least 0'));
    I.fillField(alertRulesPage.fields.inputField('name'), 'rule');
    I.dontSeeElement(alertRulesPage.elements.ruleValidationError('Must enter an alert name'));
    I.fillField(alertRulesPage.fields.inputField('threshold'), '0');
    I.dontSeeElement(alertRulesPage.elements.ruleValidationError('Must be at least 0'));
    I.click(alertRulesPage.buttons.saveAndExit);
    I.verifyPopUpMessage(alertRulesPage.messages.failRuleCreateDuration);
    I.fillField(alertRulesPage.fields.inputField('duration'), 's');
    I.seeElement(alertRulesPage.elements.ruleValidationError('Must be of format "(number)(unit)", for example "1m", or just "0". Available units: s, m, h, d, w'));
  },
);

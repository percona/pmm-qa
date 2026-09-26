import pmmTest from '@fixtures/pmmTest';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { AlertSeverity } from '@interfaces/alerting';
import { expect } from '@playwright/test';

pmmTest.describe.configure({ mode: 'default' });

const noRulesFound = "You haven't created any rules yet";
const testRule = {
  group: '10s',
  interval: '10s',
  name: 'testRule',
  pendingPeriod: '10s',
  serviceName: 'pmm-server-postgresql',
  severity: AlertSeverity.Critical,
  templateName: 'pmm_postgresql_too_many_connections',
  threshold: 0.01,
};
const viewer = { password: 'password', username: 'test_viewer' };
const editor = { password: 'password', username: 'test_editor' };
const users = [{ password: undefined, username: 'admin' }, editor];
const createdUserIds: number[] = [];

pmmTest.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  const grafanaHelper = new GrafanaHelper(page);
  const viewerUser = await grafanaHelper.findOrCreateUser(viewer.username, viewer.password);
  const editorUser = await grafanaHelper.findOrCreateUser(editor.username, editor.password);

  for (const { created, id } of [viewerUser, editorUser]) {
    if (created) createdUserIds.push(id);
  }

  await grafanaHelper.promoteToEditor(editorUser.id);
  await page.close();
});

pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
  await grafanaHelper.authorize();
  await api.alertingApi.removeAllAlertRules();
});

pmmTest.afterEach(async ({ api }) => {
  await api.alertingApi.removeAllAlertRules();
});

pmmTest.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  const grafanaHelper = new GrafanaHelper(page);

  for (const userId of createdUserIds.splice(0)) await grafanaHelper.deleteUser(userId);

  await page.close();
});

pmmTest(
  'PMM-T1384 - Verify empty alert rules list @fb-alerting @grafana-pr',
  async ({ alertingPage, page }) => {
    await page.goto(alertingPage.urls.alertRules);
    await expect(alertingPage.buttons.newAlertRule).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(alertingPage.elements.pageContent).toContainText(noRulesFound, {
      timeout: Timeouts.TEN_SECONDS,
    });
    await expect(alertingPage.elements.learnMore).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
    await expect(alertingPage.elements.learnMore).toHaveAttribute(
      'href',
      'https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/',
    );
  },
);

pmmTest(
  'PMM-T1385 - Verify alert rules elements @fb-alerting @grafana-pr',
  async ({ alertingPage, api, page }) => {
    await api.alertingApi.createRuleFromTemplate({
      ...testRule,
      folderUid: await api.grafanaApi.getFolderUid('PostgreSQL'),
    });
    await page.goto(alertingPage.urls.alertRules);
    await expect(alertingPage.buttons.newAlertRule).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(alertingPage.elements.dataSourcePicker).toBeVisible();
    await expect(alertingPage.elements.labelSearch).toBeVisible();

    for (const filter of ['Firing', 'Normal', 'Pending', 'Alert', 'Recording', 'List', 'Grouped', 'State']) {
      await expect(alertingPage.builders.ruleFilter(filter)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
    }

    await alertingPage.builders.ruleGroupToggle('PostgreSQL').click();

    for (const header of ['State', 'Name', 'Health', 'Summary']) {
      await expect(alertingPage.builders.ruleListHeader(header)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
    }

    await expect(alertingPage.elements.ruleName).toContainText(testRule.name);
  },
);

pmmTest(
  'PMM-T1996 - verify viewer cannot create alert rules @fb-alerting @grafana-pr',
  async ({ alertingPage, grafanaHelper, page }) => {
    await grafanaHelper.authorize(viewer.username, viewer.password);
    await page.goto(alertingPage.urls.alertRules);
    await expect(alertingPage.elements.pageContent).toContainText(noRulesFound, {
      timeout: Timeouts.ONE_MINUTE,
    });
    await expect(alertingPage.buttons.newAlertRule).toBeHidden();
    await expect(alertingPage.buttons.newAlertRuleFromTemplate).toBeHidden();
    await page.goto(alertingPage.urls.alertRuleFromTemplate);
    await expect(alertingPage.elements.unauthorized).toContainText('Insufficient access permissions.', {
      timeout: Timeouts.TEN_SECONDS,
    });
  },
);

pmmTest('Verify opening New Alert Rule from Template @ia @grafana-pr', async ({ alertingPage, page }) => {
  await page.goto(alertingPage.urls.alertRules);
  await expect(alertingPage.buttons.newAlertRule).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  await alertingPage.buttons.newAlertRuleFromTemplate.click();
  await expect(alertingPage.elements.templatesLoader).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
});

pmmTest(
  'PMM-T1392 - Verify fields dynamically change value when template is changed @fb-alerting @grafana-pr',
  async ({ alertingPage, page }) => {
    await page.goto(alertingPage.urls.alertRuleFromTemplate);
    await expect(alertingPage.elements.templatesLoader).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.chooseOption(alertingPage.inputs.templateSelect, 'PostgreSQL down');
    await expect(alertingPage.inputs.duration).toHaveValue('60s', { timeout: Timeouts.ONE_MINUTE });
    await expect(alertingPage.inputs.severity).toHaveText('Critical');
    await alertingPage.chooseOption(alertingPage.inputs.templateSelect, 'MySQL restarted');
    await expect(alertingPage.inputs.threshold).toHaveValue('300', { timeout: Timeouts.ONE_MINUTE });
    await expect(alertingPage.inputs.duration).toHaveValue('60s', { timeout: Timeouts.ONE_MINUTE });
    await expect(alertingPage.inputs.severity).toHaveText('Warning');
  },
);

for (const { password, username } of users) {
  pmmTest(
    `PMM-T1420 + PMM-T1992 - Verify user can create Percona templated alert @fb-alerting | ${username}`,
    async ({ alertingPage, grafanaHelper, page }) => {
      const ruleName = `Custom test pmm_postgresql_too_many_connections Alerting Rule_${username}`;

      await grafanaHelper.authorize(username, password);
      await page.goto(alertingPage.urls.alertRules);
      await expect(alertingPage.buttons.newAlertRule).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await alertingPage.buttons.newAlertRuleFromTemplate.click();
      await expect(alertingPage.elements.templatesLoader).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
      await alertingPage.chooseOption(alertingPage.inputs.templateSelect, 'PostgreSQL connections in use');
      await expect(alertingPage.inputs.ruleName).toHaveValue(
        'pmm_postgresql_too_many_connections Alerting Rule',
        {
          timeout: Timeouts.ONE_MINUTE,
        },
      );
      await alertingPage.inputs.ruleName.fill(ruleName);
      await expect(alertingPage.inputs.duration).toHaveValue('300s', { timeout: Timeouts.ONE_MINUTE });
      await alertingPage.inputs.duration.fill('301s');
      await expect(alertingPage.inputs.severity).toContainText('Warning');
      await alertingPage.completeRuleFromTemplate('Info');
      await alertingPage.buttons.saveRuleAndExit.click();
      await alertingPage.builders.ruleGroupToggle('Experimental').click({ timeout: Timeouts.ONE_MINUTE });
      await expect(alertingPage.elements.ruleName).toHaveText(ruleName);
      await expect(alertingPage.builders.ruleState('Normal')).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
    },
  );
}

// TODO: unskip in scope of https://perconadev.atlassian.net/browse/PMM-12938
// eslint-disable-next-line playwright/no-skipped-test -- PMM-T2282 is intentionally skipped until PMM-12938 is resolved.
pmmTest.skip(
  'PMM-T2282 - Verify Alerting is able to monitor for "PMM Agent Down" @fb-alerting',
  async ({ alertingPage, cliHelper, page }) => {
    const ruleName = 'Custom pmm_agent_down Alerting Rule';

    await page.goto(alertingPage.urls.alertRules);
    await expect(alertingPage.buttons.newAlertRule).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.buttons.newAlertRule.click();
    await expect(alertingPage.elements.templatesLoader).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
    await alertingPage.chooseOption(alertingPage.inputs.templateSelect, 'PMM agent down');
    await expect(alertingPage.inputs.ruleName).toHaveValue('pmm_agent_down Alerting Rule', {
      timeout: Timeouts.ONE_MINUTE,
    });
    await alertingPage.inputs.ruleName.fill(ruleName);
    await expect(alertingPage.inputs.duration).toHaveValue('60s', { timeout: Timeouts.ONE_MINUTE });
    await alertingPage.inputs.duration.fill('60s');
    await expect(alertingPage.inputs.severity).toContainText('Critical');
    await alertingPage.completeRuleFromTemplate('Critical');
    await alertingPage.buttons.saveRuleAndExit.click();
    await alertingPage.builders.ruleGroupToggle('Experimental').click({ timeout: Timeouts.ONE_MINUTE });
    await expect(alertingPage.elements.ruleName).toHaveText(ruleName);
    cliHelper.execute('docker pause ms_pmm_8.0').assertSuccess();
    await expect(alertingPage.builders.ruleState('Pending')).toBeVisible({ timeout: Timeouts.FIVE_MINUTES });
    await expect(alertingPage.builders.ruleState('Firing')).toBeVisible({ timeout: Timeouts.FIVE_MINUTES });
    cliHelper.execute('docker unpause ms_pmm_8.0').assertSuccess();
    await expect(alertingPage.builders.ruleState('Normal')).toBeVisible({ timeout: Timeouts.FIVE_MINUTES });
  },
);

pmmTest(
  'PMM-T1430 - Verify user can edit Percona templated alert @fb-alerting',
  async ({ alertingPage, api, page }) => {
    const editedName = 'EDITED rule';

    await api.alertingApi.createRuleFromTemplate({
      ...testRule,
      folderUid: await api.grafanaApi.getFolderUid('PostgreSQL'),
    });
    await page.goto(alertingPage.urls.alertRules);
    await expect(alertingPage.buttons.newAlertRule).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.builders.ruleGroupToggle('PostgreSQL').click({ timeout: Timeouts.ONE_MINUTE });
    await expect(alertingPage.elements.ruleName).toHaveText(testRule.name);
    await alertingPage.buttons.expandRow.click({ timeout: Timeouts.ONE_MINUTE });
    await alertingPage.buttons.editRule.click();
    await expect(alertingPage.inputs.name).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
    await alertingPage.inputs.name.fill(editedName);
    await alertingPage.inputs.pendingPeriod.fill('2m');
    await alertingPage.buttons.saveRule.click();
    await expect(alertingPage.builders.alertMessage('Rule updated successfully')).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await page.goto(alertingPage.urls.alertRules);
    await expect(alertingPage.buttons.newAlertRule).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.builders.ruleGroupToggle('PostgreSQL').click({ timeout: Timeouts.ONE_MINUTE });
    await expect(alertingPage.elements.ruleName).toHaveText(editedName);
    await alertingPage.buttons.expandRow.click();
    await expect(alertingPage.elements.ruleDetails).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
    await expect(alertingPage.elements.ruleDetails).toContainText('Pending period 2m', {
      useInnerText: true,
    });
  },
);

pmmTest(
  'PMM-T1433 - Verify user can delete Percona templated alert @fb-alerting',
  async ({ alertingPage, api, page }) => {
    await api.alertingApi.createRuleFromTemplate({
      ...testRule,
      folderUid: await api.grafanaApi.getFolderUid('OS'),
    });
    await page.goto(alertingPage.urls.alertRules);
    await expect(alertingPage.buttons.newAlertRule).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.builders.ruleGroupToggle('OS').click({ timeout: Timeouts.ONE_MINUTE });
    await expect(alertingPage.elements.ruleName).toHaveText(testRule.name);
    await alertingPage.buttons.expandRow.click({ timeout: Timeouts.ONE_MINUTE });
    await alertingPage.builders.ruleMoreMenu(testRule.name).click({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.buttons.deleteRule.click();
    await expect(alertingPage.elements.dialog).toContainText(
      'Are you sure you want to delete this rule? This rule will be recoverable from the Recently deleted page by a user with an admin role.',
      { timeout: Timeouts.ONE_MINUTE },
    );
    await alertingPage.buttons.cancelModal.click();
    await alertingPage.builders.ruleMoreMenu(testRule.name).click({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.buttons.deleteRule.click();
    await alertingPage.buttons.confirmModal.click();
    await expect(alertingPage.messages.popUp).toContainText('Rule successfully deleted', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(alertingPage.builders.ruleGroupToggle('OS')).toBeHidden();
    await expect(alertingPage.elements.pageContent).toContainText(noRulesFound, {
      timeout: Timeouts.ONE_MINUTE,
    });
  },
);

pmmTest(
  'PMM-T1434 - Verify validation errors when creating new alert rule @fb-alerting @grafana-pr',
  async ({ alertingPage, page }) => {
    const nameError = 'Must enter an alert name';

    await page.goto(alertingPage.urls.alertRules);
    await expect(alertingPage.buttons.newAlertRule).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.buttons.newAlertRuleFromTemplate.click();
    await expect(alertingPage.elements.templatesLoader).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
    await alertingPage.chooseOption(alertingPage.inputs.templateSelect, 'PostgreSQL connections in use');
    await alertingPage.completeRuleFromTemplate('Debug');
    await alertingPage.inputs.ruleName.clear();
    await alertingPage.buttons.saveRuleAndExit.click();
    await expect(
      alertingPage.builders.alertMessage('There are errors in the form. Please correct them and try again!'),
    ).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(alertingPage.builders.alertMessage(nameError)).toBeVisible();
    await alertingPage.inputs.ruleName.fill('rule');
    await expect(alertingPage.builders.alertMessage(nameError)).toBeHidden();
    await alertingPage.inputs.duration.fill('s');
    await expect(
      alertingPage.builders.alertMessage(
        'Must be of format "(number)(unit)", for example "1m", or just "0". Available units: s, m, h, d, w',
      ),
    ).toBeVisible();
    await alertingPage.inputs.duration.fill('0');
    await alertingPage.buttons.saveRuleAndExit.click();
    await expect(
      alertingPage.builders.alertMessage(
        "Duration (0s) can't be shorter than evaluation interval for the given group (1m0s).",
      ),
    ).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  },
);

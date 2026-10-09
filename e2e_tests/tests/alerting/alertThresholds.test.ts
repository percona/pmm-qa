import pmmTest from '@fixtures/pmmTest';
import { overridableTemplate } from '@helpers/alertTemplate.helper';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe.configure({ mode: 'default' });

const cpuTemplate = 'pmm_node_high_cpu_load';
const cpuTemplateSummary = 'Node high CPU load';
const memoryTemplate = 'test_node_memory_multi';
const pmmServerNode = 'pmm-server';
const otherNode = `dt-node-${Date.now()}`;
const folderTitle = 'PMM-14912 dynamic thresholds';
const editor = { password: 'Editor-pw-12345', username: `dt-editor-${Date.now()}` };
const viewer = { password: 'Viewer-pw-12345', username: `dt-viewer-${Date.now()}` };
const templateNames = [
  memoryTemplate,
  'test_dt_ok2',
  'test_dt_bad1',
  'test_dt_bad2',
  'test_dt_bad3',
  'test_dt_bad4',
];
let folderUid: string;
let otherNodeId: string;
const userIds: number[] = [];
const rejected = [
  {
    message: 'in expression C must be the whole right-hand side of a comparison',
    name: 'test_dt_bad1',
    options: { expression: '$A > [[ .threshold ]] * 2' },
    shape: 'a scaled threshold',
  },
  {
    message: 'in expression C must be the whole right-hand side of a comparison',
    name: 'test_dt_bad2',
    options: { expression: '[[ .threshold ]] < $A' },
    shape: 'the threshold on the left-hand side',
  },
  {
    message: "overridable parameter 'threshold' requires the queries and expressions template form",
    name: 'test_dt_bad3',
    options: { singleExpression: true },
    shape: 'a single expr',
  },
  {
    message: 'an overridable parameter must be of type float, got bool',
    name: 'test_dt_bad4',
    options: { boolParam: true },
    shape: 'a bool parameter',
  },
];

pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
  folderUid = '';
  otherNodeId = '';
  await grafanaHelper.authorize();
  await api.alertingApi.removeAllAlertRules();

  for (const name of templateNames) await api.alertingApi.deleteTemplate(GrafanaHelper.getAuthHeader(), name);

  folderUid = await api.grafanaApi.createFolder(folderTitle);
  otherNodeId = await api.inventoryApi.addGenericNode(otherNode);
});

pmmTest.afterEach(async ({ api, grafanaHelper }) => {
  await api.alertingApi.removeAllAlertRules();

  if (folderUid) await api.grafanaApi.deleteFolder(folderUid);
  if (otherNodeId) await api.inventoryApi.deleteNode(otherNodeId, true);

  for (const name of templateNames) await api.alertingApi.deleteTemplate(GrafanaHelper.getAuthHeader(), name);

  for (const id of userIds.splice(0)) await grafanaHelper.deleteUser(id);
});

pmmTest(
  'PMM-T2364 - Verify a node threshold override makes the alert fire only for that node, and clearing it restores the default @fb-alerting',
  async ({ alertingPage, alertStatusPage, alertThresholdsPage, api, nodesPage, page }) => {
    const ruleName = 'dt-cpu-80';

    await pmmTest.step('Only Node high CPU load is a Dynamic built-in template', async () => {
      await page.goto(alertingPage.urls.templates);
      await expect(alertingPage.builders.dynamicBadge(cpuTemplateSummary)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(alertingPage.elements.dynamicBadges).toHaveCount(1);
    });

    await pmmTest.step('Create a rule from the template with the default of 80', async () => {
      await api.alertingApi.createFastRuleFromTemplate({
        folderUid,
        name: ruleName,
        templateName: cpuTemplate,
        threshold: 80,
      });
    });

    await pmmTest.step('The window lists the rule with its default for pmm-server', async () => {
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds(pmmServerNode);
      await expect(alertThresholdsPage.elements.title).toHaveText(`Alert thresholds: ${pmmServerNode}`);
      await expect(alertThresholdsPage.builders.row(ruleName)).toContainText('threshold');
      await expect(alertThresholdsPage.builders.row(ruleName)).toContainText('%');
      await expect(alertThresholdsPage.builders.overrideInput(ruleName)).toHaveValue('80');
    });

    await pmmTest.step('Set an override of 1 on pmm-server', async () => {
      await alertThresholdsPage.builders.overrideInput(ruleName).fill('1');
      await alertThresholdsPage.buttons.submit.click();
      await expect(alertThresholdsPage.messages.updated).toBeVisible();
      await expect(alertThresholdsPage.elements.modal).toBeHidden();
    });

    await pmmTest.step('The override is kept for pmm-server only', async () => {
      await nodesPage.openAlertThresholds(pmmServerNode);
      await expect(alertThresholdsPage.builders.overrideInput(ruleName)).toHaveValue('1');
      await alertThresholdsPage.buttons.cancel.click();
      await nodesPage.openAlertThresholds(otherNode);
      await expect(alertThresholdsPage.builders.overrideInput(ruleName)).toHaveValue('80');
      await alertThresholdsPage.buttons.cancel.click();
    });

    await pmmTest.step('The alert fires for pmm-server with the overridden threshold', async () => {
      await page.goto(alertStatusPage.url);
      await expect(async () => {
        await page.reload();
        await expect(alertStatusPage.builders.firingAlert(ruleName)).toBeVisible({
          timeout: Timeouts.TEN_SECONDS,
        });
      }).toPass({ timeout: Timeouts.TWO_MINUTES });

      const firing = ((await api.alertingApi.getRule(ruleName))?.alerts ?? []).filter(
        ({ state }) => state === 'Alerting',
      );

      expect(firing.map(({ labels }) => labels.node_name)).toEqual([pmmServerNode]);
      expect(firing[0].annotations?.description).toContain('CPU load is more than 1%');
    });

    await pmmTest.step('Reset to default clears the override', async () => {
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds(pmmServerNode);
      await alertThresholdsPage.builders.resetToDefault(ruleName).click();
      await alertThresholdsPage.buttons.submit.click();
      await expect(alertThresholdsPage.messages.updated).toBeVisible();
      await nodesPage.openAlertThresholds(pmmServerNode);
      await expect(alertThresholdsPage.builders.overrideInput(ruleName)).toHaveValue('80');
      await alertThresholdsPage.buttons.cancel.click();
    });

    await pmmTest.step('The alert stops firing for pmm-server', async () => {
      await page.goto(alertStatusPage.url);
      await expect(async () => {
        await page.reload();
        await expect(alertStatusPage.builders.firingAlert(ruleName)).toBeHidden({
          timeout: Timeouts.TEN_SECONDS,
        });
      }).toPass({ timeout: Timeouts.TWO_MINUTES });
    });
  },
);

pmmTest(
  'PMM-T2365 - Verify valid overridable templates are accepted and shown as Dynamic @fb-alerting',
  async ({ alertingPage, page }) => {
    await page.goto(alertingPage.urls.templates);

    await pmmTest.step('A valid overridable template is added and shown as Dynamic', async () => {
      await alertingPage.createTemplate(overridableTemplate(memoryTemplate));
      await expect(alertingPage.messages.popUp).toContainText('Alert rule template successfully added');
      await expect(alertingPage.builders.dynamicBadge(memoryTemplate)).toBeVisible();
    });

    await pmmTest.step('View shows the template text with the overridable parameter', async () => {
      await alertingPage.builders.viewTemplate(memoryTemplate).click();
      await expect(alertingPage.elements.templateText).toHaveValue(/overridable: true/);
      await expect(alertingPage.buttons.copyToClipboard).toBeVisible();
      await alertingPage.buttons.closeDialog.click();
    });

    await pmmTest.step('A compound condition is accepted', async () => {
      await alertingPage.createTemplate(
        overridableTemplate('test_dt_ok2', { expression: '($A < [[ .threshold ]]) || $A == 0' }),
      );
      await expect(alertingPage.messages.popUp).toContainText('Alert rule template successfully added');
      await expect(alertingPage.builders.dynamicBadge('test_dt_ok2')).toBeVisible();
    });

    await pmmTest.step('Both templates are kept after a reload', async () => {
      await page.reload();
      await expect(alertingPage.builders.templateRow(memoryTemplate)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(alertingPage.builders.templateRow('test_dt_ok2')).toBeVisible();
    });
  },
);

for (const { message, name, options, shape } of rejected) {
  pmmTest(
    `PMM-T2365 - Verify an overridable template with ${shape} is refused @fb-alerting`,
    async ({ alertingPage, page }) => {
      await page.goto(alertingPage.urls.templates);
      await alertingPage.createTemplate(overridableTemplate(name, options));
      await expect(alertingPage.builders.alertMessage(message)).toContainText(
        'Failed to parse rule template',
      );
      await alertingPage.buttons.cancelTemplate.click();
      await page.reload();
      await expect(alertingPage.builders.templateRow(cpuTemplateSummary)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(alertingPage.builders.templateRow(name)).toHaveCount(0);
    },
  );
}

pmmTest(
  'PMM-T2366 - Verify the Override alert thresholds window rejects invalid values and discards cancelled edits @fb-alerting',
  async ({ alertThresholdsPage, api, nodesPage, page }) => {
    const ruleName = 'dt-cpu-80';

    await page.goto(nodesPage.url);

    await pmmTest.step('Without an overridable rule the window has nothing to submit', async () => {
      await nodesPage.openAlertThresholds(pmmServerNode);
      await expect(alertThresholdsPage.messages.empty).toBeVisible();
      await expect(alertThresholdsPage.buttons.submit).toBeDisabled();
      await alertThresholdsPage.buttons.cancel.click();
    });

    const ruleId = await api.alertingApi.createFastRuleFromTemplate({
      folderUid,
      name: ruleName,
      templateName: cpuTemplate,
      threshold: 80,
    });

    await page.reload();

    await pmmTest.step('An out-of-range value is refused and the edit is kept', async () => {
      await nodesPage.openAlertThresholds(pmmServerNode);
      await alertThresholdsPage.builders.overrideInput(ruleName).fill('150');
      await alertThresholdsPage.buttons.submit.click();
      await expect(
        alertThresholdsPage.builders.snackbar("Threshold for 'threshold' must be at most 100."),
      ).toBeVisible();
      await expect(alertThresholdsPage.elements.modal).toBeVisible();
      await expect(alertThresholdsPage.builders.overrideInput(ruleName)).toHaveValue('150');
      await alertThresholdsPage.buttons.cancel.click();
      await nodesPage.openAlertThresholds(pmmServerNode);
      await expect(alertThresholdsPage.builders.overrideInput(ruleName)).toHaveValue('80');
    });

    await pmmTest.step('Cancel discards the edit', async () => {
      await alertThresholdsPage.builders.overrideInput(ruleName).fill('95');
      await alertThresholdsPage.buttons.cancel.click();
      await expect(alertThresholdsPage.elements.modal).toBeHidden();
      await expect(alertThresholdsPage.messages.updated).toBeHidden();
      await nodesPage.openAlertThresholds(pmmServerNode);
      await expect(alertThresholdsPage.builders.overrideInput(ruleName)).toHaveValue('80');
    });

    await pmmTest.step('Typing the default back clears the override', async () => {
      await alertThresholdsPage.builders.overrideInput(ruleName).fill('95');
      await alertThresholdsPage.buttons.submit.click();
      await expect(alertThresholdsPage.messages.updated).toBeVisible();
      await nodesPage.openAlertThresholds(pmmServerNode);
      await alertThresholdsPage.builders.overrideInput(ruleName).fill('80');
      await alertThresholdsPage.buttons.submit.click();
      await expect(alertThresholdsPage.elements.modal).toBeHidden();
      await nodesPage.openAlertThresholds(pmmServerNode);
      await expect(alertThresholdsPage.builders.overrideInput(ruleName)).toHaveValue('80');
      // API: the field shows the effective value either way, so only the API tells a cleared override apart.
      // Overrides of rules deleted by earlier tests linger until the sweep, so look at this rule only.
      expect(
        (await api.alertingApi.listThresholds(pmmServerNode)).find(({ rule_id }) => rule_id === ruleId)
          ?.is_overridden,
      ).toBe(false);
    });
  },
);

pmmTest(
  'PMM-T2367 - Verify users without the Admin role cannot open the threshold overrides @fb-alerting',
  async ({ alertThresholdsPage, api, grafanaHelper, leftNavigation, nodesPage, page }) => {
    const ruleName = 'dt-cpu-80';

    await api.alertingApi.createFastRuleFromTemplate({
      folderUid,
      name: ruleName,
      templateName: cpuTemplate,
      threshold: 80,
    });
    userIds.push(await grafanaHelper.createUser(viewer.username, viewer.password));

    const editorId = await grafanaHelper.createUser(editor.username, editor.password);

    userIds.push(editorId);
    await grafanaHelper.promoteToEditor(editorId);

    await pmmTest.step('Admin sets an override of 95 on pmm-server', async () => {
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds(pmmServerNode);
      await alertThresholdsPage.builders.overrideInput(ruleName).fill('95');
      await alertThresholdsPage.buttons.submit.click();
      await expect(alertThresholdsPage.messages.updated).toBeVisible();
    });

    for (const user of [editor, viewer]) {
      await pmmTest.step(`${user.username} has no Inventory and no node actions`, async () => {
        await grafanaHelper.authorize(user.username, user.password);
        await page.goto('');
        await expect(leftNavigation.elements.homeMenuItem).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
        await expect(leftNavigation.elements.inventoryMenuItem).toBeHidden();
        await page.goto(nodesPage.url);
        await expect(nodesPage.elements.unauthorized).toContainText('Insufficient access permissions.', {
          timeout: Timeouts.THIRTY_SECONDS,
        });
        await expect(nodesPage.elements.nodeRows).toHaveCount(0);
      });
    }

    await pmmTest.step('The override set by Admin is unchanged', async () => {
      await grafanaHelper.authorize();
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds(pmmServerNode);
      await expect(alertThresholdsPage.builders.overrideInput(ruleName)).toHaveValue('95');
    });
  },
);

pmmTest(
  'PMM-T2368 - Verify several rules with dynamic thresholds are listed correctly in the Override alert thresholds window @fb-alerting',
  async ({ alertingPage, alertThresholdsPage, api, nodesPage, page }) => {
    const rules = [
      { name: 'dt-cpu-80', template: cpuTemplate, threshold: 80 },
      { name: 'dt-cpu-70', template: cpuTemplate, threshold: 70 },
      { name: 'dt-mem-90', template: memoryTemplate, threshold: 90 },
    ];

    await api.alertingApi.uploadTemplate(overridableTemplate(memoryTemplate));

    for (const { name, template, threshold } of rules) {
      await api.alertingApi.createFastRuleFromTemplate({
        folderUid,
        name,
        templateName: template,
        threshold,
      });
    }

    await api.alertingApi.createFastRuleFromTemplate({
      folderUid,
      name: 'dt-static',
      templateName: 'pmm_node_low_free_memory',
      threshold: 20,
    });

    await pmmTest.step('Every overridable rule is listed with its own default and unit', async () => {
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds(pmmServerNode);
      await expect(alertThresholdsPage.elements.ruleRows).toHaveCount(rules.length);

      for (const { name, threshold } of rules) {
        await expect(alertThresholdsPage.builders.row(name)).toContainText('threshold');
        await expect(alertThresholdsPage.builders.row(name)).toContainText('%');
        await expect(alertThresholdsPage.builders.overrideInput(name)).toHaveValue(String(threshold));
      }

      await expect(alertThresholdsPage.builders.row('dt-static')).toHaveCount(0);
    });

    await pmmTest.step('An override on one row leaves the others on their defaults', async () => {
      await alertThresholdsPage.builders.overrideInput('dt-cpu-70').fill('95');
      await alertThresholdsPage.buttons.submit.click();
      await expect(alertThresholdsPage.messages.updated).toBeVisible();
      await nodesPage.openAlertThresholds(pmmServerNode);
      await expect(alertThresholdsPage.builders.overrideInput('dt-cpu-70')).toHaveValue('95');
      await expect(alertThresholdsPage.builders.overrideInput('dt-cpu-80')).toHaveValue('80');
      await expect(alertThresholdsPage.builders.overrideInput('dt-mem-90')).toHaveValue('90');
      await alertThresholdsPage.buttons.cancel.click();
    });

    await pmmTest.step('Another node lists the same rules on their defaults', async () => {
      await nodesPage.openAlertThresholds(otherNode);
      await expect(alertThresholdsPage.elements.ruleRows).toHaveCount(rules.length);

      for (const { name, threshold } of rules) {
        await expect(alertThresholdsPage.builders.overrideInput(name)).toHaveValue(String(threshold));
      }

      await alertThresholdsPage.buttons.cancel.click();
    });

    await pmmTest.step('A deleted rule drops out of the window', async () => {
      await page.goto(alertingPage.urls.alertRules);
      await alertingPage.builders.ruleGroupToggle(folderTitle).click({ timeout: Timeouts.ONE_MINUTE });
      await alertingPage.buttons.expandRow.first().click({ timeout: Timeouts.ONE_MINUTE });
      await alertingPage.builders.ruleMoreMenu('dt-mem-90').click({ timeout: Timeouts.THIRTY_SECONDS });
      await alertingPage.buttons.deleteRule.click();
      await alertingPage.buttons.confirmModal.click();
      await expect(alertingPage.messages.popUp).toContainText('Rule successfully deleted', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds(pmmServerNode);
      await expect(alertThresholdsPage.elements.ruleRows).toHaveCount(2);
      await expect(alertThresholdsPage.builders.row('dt-mem-90')).toHaveCount(0);
      await expect(alertThresholdsPage.builders.overrideInput('dt-cpu-70')).toHaveValue('95');
    });
  },
);

import pmmTest from '@fixtures/pmmTest';
import { overridableTemplate } from '@helpers/alertTemplate.helper';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';
import { rejectedTemplates, thresholdTemplates } from '@testdata/alertThresholds';

pmmTest.describe.configure({ mode: 'default' });

const otherNode = `dt-node-${Date.now()}`;
const folderTitle = 'PMM-14912 dynamic thresholds';
let folderUid: string;
let otherNodeId: string;
const userIds: number[] = [];

pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
  folderUid = '';
  otherNodeId = '';
  await grafanaHelper.authorize();
  await api.alertingApi.removeAllAlertRules();

  for (const name of thresholdTemplates) {
    await api.alertingApi.deleteTemplate(GrafanaHelper.getAuthHeader(), name);
  }

  folderUid = await api.grafanaApi.createFolder(folderTitle);
  otherNodeId = await api.inventoryApi.addGenericNode(otherNode);
});

pmmTest.afterEach(async ({ api, grafanaHelper }) => {
  await api.alertingApi.removeAllAlertRules();

  if (folderUid) await api.grafanaApi.deleteFolder(folderUid);
  if (otherNodeId) await api.inventoryApi.deleteNode(otherNodeId, true);

  for (const name of thresholdTemplates) {
    await api.alertingApi.deleteTemplate(GrafanaHelper.getAuthHeader(), name);
  }

  for (const id of userIds.splice(0)) await grafanaHelper.deleteUser(id);
});

pmmTest(
  'PMM-T2364 - Verify a node threshold override makes the alert fire only for that node, and clearing it restores the default @fb-alerting',
  async ({ alertingPage, alertStatusPage, alertThresholdsPage, api, nodesPage, page }) => {
    const ruleName = 'dt-cpu-80';

    await pmmTest.step('Only CPU load and QAN slow queries are Dynamic templates', async () => {
      await page.goto(alertingPage.urls.templates);
      await expect(alertingPage.builders.dynamicBadge('Node high CPU load')).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(alertingPage.builders.dynamicBadge('QAN slow queries')).toBeVisible();
      await expect(alertingPage.elements.dynamicBadges).toHaveCount(2);
    });

    await pmmTest.step('Create a rule from the template with the default of 80', async () => {
      await api.alertingApi.createFastRuleFromTemplate({
        folderUid,
        name: ruleName,
        templateName: 'pmm_node_high_cpu_load',
        threshold: 80,
      });
    });

    await pmmTest.step('The window lists the rule with its default for pmm-server', async () => {
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds('pmm-server');
      await expect(alertThresholdsPage.elements.title).toHaveText('Alert thresholds: pmm-server');
      await alertThresholdsPage.verifyDefault(ruleName, 80);
    });

    await pmmTest.step('Set an override of 1 on pmm-server', async () => {
      await alertThresholdsPage.saveOverride(ruleName, '1');
      await expect(alertThresholdsPage.elements.modal).toBeHidden();
    });

    await pmmTest.step('The override is kept for pmm-server only', async () => {
      await nodesPage.openAlertThresholds('pmm-server');
      await alertThresholdsPage.verifyOverride(ruleName, '1');
      await alertThresholdsPage.buttons.cancel.click();
      await nodesPage.openAlertThresholds(otherNode);
      await alertThresholdsPage.verifyOverride(ruleName, '80');
      await alertThresholdsPage.buttons.cancel.click();
    });

    await pmmTest.step('The alert fires for pmm-server with the overridden threshold', async () => {
      await alertStatusPage.verifyAlertFiring(ruleName);

      const firing = ((await api.alertingApi.getRule(ruleName))?.alerts ?? []).filter(
        ({ state }) => state === 'Alerting',
      );

      expect(firing.map(({ labels }) => labels.node_name)).toEqual(['pmm-server']);
      expect(firing[0].annotations?.description).toContain('CPU load is more than 1%');
    });

    await pmmTest.step('Reset to default clears the override', async () => {
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds('pmm-server');
      await alertThresholdsPage.resetOverride(ruleName);
      await nodesPage.openAlertThresholds('pmm-server');
      await alertThresholdsPage.verifyOverride(ruleName, '80');
      await alertThresholdsPage.buttons.cancel.click();
    });

    await pmmTest.step('The alert stops firing for pmm-server', async () => {
      await alertStatusPage.verifyAlertFiring(ruleName, false);
    });
  },
);

pmmTest(
  'PMM-T2365 - Verify valid overridable templates are accepted and shown as Dynamic @fb-alerting',
  async ({ alertingPage, page }) => {
    await page.goto(alertingPage.urls.templates);

    await pmmTest.step('A valid overridable template is added and shown as Dynamic', async () => {
      await alertingPage.addDynamicTemplate(
        overridableTemplate('test_node_memory_multi'),
        'test_node_memory_multi',
      );
    });

    await pmmTest.step('View shows the template text with the overridable parameter', async () => {
      await alertingPage.verifyTemplateText('test_node_memory_multi', /overridable: true/);
    });

    await pmmTest.step('A compound condition is accepted', async () => {
      await alertingPage.addDynamicTemplate(
        overridableTemplate('test_dt_ok2', { expression: '($A < [[ .threshold ]]) || $A == 0' }),
        'test_dt_ok2',
      );
    });

    await pmmTest.step('Both templates are kept after a reload', async () => {
      await page.reload();
      await expect(alertingPage.builders.templateRow('test_node_memory_multi')).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(alertingPage.builders.templateRow('test_dt_ok2')).toBeVisible();
    });
  },
);

for (const { message, name, options, shape } of rejectedTemplates) {
  pmmTest(
    `PMM-T2365 - Verify an overridable template with ${shape} is refused @fb-alerting`,
    async ({ alertingPage, page }) => {
      await page.goto(alertingPage.urls.templates);
      await alertingPage.verifyTemplateRefused(overridableTemplate(name, options), message);
      await page.reload();
      await expect(alertingPage.builders.templateRow('Node high CPU load')).toBeVisible({
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
      await nodesPage.openAlertThresholds('pmm-server');
      await expect(alertThresholdsPage.messages.empty).toBeVisible();
      await expect(alertThresholdsPage.buttons.submit).toBeDisabled();
      await alertThresholdsPage.buttons.cancel.click();
    });

    const ruleId = await api.alertingApi.createFastRuleFromTemplate({
      folderUid,
      name: ruleName,
      templateName: 'pmm_node_high_cpu_load',
      threshold: 80,
    });

    await page.reload();

    await pmmTest.step('An out-of-range value is refused and the edit is kept', async () => {
      await nodesPage.openAlertThresholds('pmm-server');
      await alertThresholdsPage.submitOverride(ruleName, '150');
      await expect(
        alertThresholdsPage.builders.snackbar("Threshold for 'threshold' must be at most 100."),
      ).toBeVisible();
      await expect(alertThresholdsPage.elements.modal).toBeVisible();
      await alertThresholdsPage.verifyOverride(ruleName, '150');
      await alertThresholdsPage.buttons.cancel.click();
      await nodesPage.openAlertThresholds('pmm-server');
      await alertThresholdsPage.verifyOverride(ruleName, '80');
    });

    await pmmTest.step('Cancel discards the edit', async () => {
      await alertThresholdsPage.builders.overrideInput(ruleName).fill('95');
      await alertThresholdsPage.buttons.cancel.click();
      await expect(alertThresholdsPage.elements.modal).toBeHidden();
      await expect(alertThresholdsPage.messages.updated).toBeHidden();
      await nodesPage.openAlertThresholds('pmm-server');
      await alertThresholdsPage.verifyOverride(ruleName, '80');
    });

    await pmmTest.step('Typing the default back clears the override', async () => {
      await alertThresholdsPage.saveOverride(ruleName, '95');
      await nodesPage.openAlertThresholds('pmm-server');
      await alertThresholdsPage.submitOverride(ruleName, '80');
      await expect(alertThresholdsPage.elements.modal).toBeHidden();
      await nodesPage.openAlertThresholds('pmm-server');
      await alertThresholdsPage.verifyOverride(ruleName, '80');
      // API: the field shows the effective value either way, so only the API tells a cleared override apart.
      // Overrides of rules deleted by earlier tests linger until the sweep, so look at this rule only.
      expect(
        (await api.alertingApi.listThresholds('pmm-server')).find(({ rule_id }) => rule_id === ruleId)
          ?.is_overridden,
      ).toBe(false);
    });
  },
);

pmmTest(
  'PMM-T2367 - Verify users without the Admin role cannot open the threshold overrides @fb-alerting',
  async ({ alertThresholdsPage, api, grafanaHelper, leftNavigation, nodesPage, page }) => {
    const ruleName = 'dt-cpu-80';
    const editor = { password: 'Editor-pw-12345', username: `dt-editor-${Date.now()}` };
    const viewer = { password: 'Viewer-pw-12345', username: `dt-viewer-${Date.now()}` };

    await api.alertingApi.createFastRuleFromTemplate({
      folderUid,
      name: ruleName,
      templateName: 'pmm_node_high_cpu_load',
      threshold: 80,
    });
    userIds.push(await grafanaHelper.createUser(viewer.username, viewer.password));

    const editorId = await grafanaHelper.createUser(editor.username, editor.password);

    userIds.push(editorId);
    await grafanaHelper.promoteToEditor(editorId);

    await pmmTest.step('Admin sets an override of 95 on pmm-server', async () => {
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds('pmm-server');
      await alertThresholdsPage.saveOverride(ruleName, '95');
    });

    for (const user of [editor, viewer]) {
      await pmmTest.step(`${user.username} has no Inventory and no node actions`, async () => {
        await grafanaHelper.authorize(user.username, user.password);
        await page.goto('');
        await expect(leftNavigation.elements.homeMenuItem).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
        await expect(leftNavigation.elements.inventoryMenuItem).toBeHidden();
        await page.goto(nodesPage.url);
        await nodesPage.verifyAccessDenied();
      });
    }

    await pmmTest.step('The override set by Admin is unchanged', async () => {
      await grafanaHelper.authorize();
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds('pmm-server');
      await alertThresholdsPage.verifyOverride(ruleName, '95');
    });
  },
);

pmmTest(
  'PMM-T2368 - Verify several rules with dynamic thresholds are listed correctly in the Override alert thresholds window @fb-alerting',
  async ({ alertingPage, alertThresholdsPage, api, nodesPage, page }) => {
    const rules = [
      { name: 'dt-cpu-80', templateName: 'pmm_node_high_cpu_load', threshold: 80 },
      { name: 'dt-cpu-70', templateName: 'pmm_node_high_cpu_load', threshold: 70 },
      { name: 'dt-mem-90', templateName: 'test_node_memory_multi', threshold: 90 },
    ];

    await api.alertingApi.uploadTemplate(overridableTemplate('test_node_memory_multi'));

    for (const rule of rules) await api.alertingApi.createFastRuleFromTemplate({ folderUid, ...rule });

    await api.alertingApi.createFastRuleFromTemplate({
      folderUid,
      name: 'dt-static',
      templateName: 'pmm_node_low_free_memory',
      threshold: 20,
    });

    await pmmTest.step('Every overridable rule is listed with its own default and unit', async () => {
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds('pmm-server');
      await expect(alertThresholdsPage.elements.ruleRows).toHaveCount(rules.length);

      for (const { name, threshold } of rules) await alertThresholdsPage.verifyDefault(name, threshold);

      await expect(alertThresholdsPage.builders.row('dt-static')).toHaveCount(0);
    });

    await pmmTest.step('An override on one row leaves the others on their defaults', async () => {
      await alertThresholdsPage.saveOverride('dt-cpu-70', '95');
      await nodesPage.openAlertThresholds('pmm-server');
      await alertThresholdsPage.verifyOverride('dt-cpu-70', '95');
      await alertThresholdsPage.verifyOverride('dt-cpu-80', '80');
      await alertThresholdsPage.verifyOverride('dt-mem-90', '90');
      await alertThresholdsPage.buttons.cancel.click();
    });

    await pmmTest.step('Another node lists the same rules on their defaults', async () => {
      await nodesPage.openAlertThresholds(otherNode);
      await expect(alertThresholdsPage.elements.ruleRows).toHaveCount(rules.length);

      for (const { name, threshold } of rules) {
        await alertThresholdsPage.verifyOverride(name, String(threshold));
      }

      await alertThresholdsPage.buttons.cancel.click();
    });

    await pmmTest.step('A deleted rule drops out of the window', async () => {
      await alertingPage.deleteRule(folderTitle, 'dt-mem-90');
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds('pmm-server');
      await expect(alertThresholdsPage.elements.ruleRows).toHaveCount(2);
      await expect(alertThresholdsPage.builders.row('dt-mem-90')).toHaveCount(0);
      await alertThresholdsPage.verifyOverride('dt-cpu-70', '95');
    });
  },
);

import type Api from '@api/api';
import pmmTest from '@fixtures/pmmTest';
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
const group = 'dt-group';
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

interface TemplateOptions {
  boolParam?: boolean;
  expression?: string;
  singleExpression?: boolean;
}

const memoryQuery =
  '100 * (1 - avg by (node_name) (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))';
const overridableTemplate = (
  name: string,
  { boolParam = false, expression = '$A > [[ .threshold ]]', singleExpression = false }: TemplateOptions = {},
) => `templates:
  - name: ${name}
    version: 1
    summary: ${name}
${
  singleExpression
    ? `    expr: |-
      ${memoryQuery} > [[ .threshold ]]`
    : `    queries:
      - ref_id: A
        expr: |-
          ${memoryQuery}
    expressions:
      - ref_id: C
        type: math
        expression: "${expression}"
    condition: C`
}
    params:
      - name: threshold
        summary: Memory used percentage
${
  boolParam
    ? `        type: bool
        value: true`
    : `        unit: "%"
        type: float
        range: [0, 100]
        value: 90`
}
        overridable: true
    for: 1m
    severity: warning
    annotations:
      summary: Node memory usage high ({{ $labels.node_name }})
      description: '{{ $labels.node_name }} memory usage is above [[ .threshold ]]%.'
`;

pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
  await grafanaHelper.authorize();
  await api.alertingApi.removeAllAlertRules();

  for (const name of templateNames) await api.alertingApi.deleteTemplate(GrafanaHelper.getAuthHeader(), name);

  folderUid = await api.grafanaApi.createFolder(folderTitle);
  otherNodeId = await api.inventoryApi.addGenericNode(otherNode);
});

pmmTest.afterEach(async ({ api, grafanaHelper }) => {
  await api.alertingApi.removeAllAlertRules();
  await api.grafanaApi.deleteFolder(folderUid);
  await api.inventoryApi.deleteNode(otherNodeId, true);

  for (const name of templateNames) await api.alertingApi.deleteTemplate(GrafanaHelper.getAuthHeader(), name);

  for (const id of userIds.splice(0)) await grafanaHelper.deleteUser(id);
});

const createRule = async (api: Api, name: string, threshold: number, templateName = cpuTemplate) =>
  api.alertingApi.createRuleFromTemplate({
    folderUid,
    group,
    interval: '10s',
    name,
    pendingPeriod: '10s',
    templateName,
    threshold,
  });

pmmTest(
  'PMM-T2364 - Verify a node threshold override makes the alert fire only for that node, and clearing it restores the default @fb-alerting',
  async ({ alertingPage, alertStatusPage, alertThresholdsPage, api, nodesPage, page }) => {
    const ruleName = 'dt-cpu-80';

    await pmmTest.step('Only Node high CPU load is a Dynamic built-in template', async () => {
      await page.goto(alertingPage.urls.templates);
      await expect(
        alertingPage.builders.templateRow(cpuTemplateSummary).getByText('Dynamic', { exact: true }),
      ).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(
        alertingPage.builders.templateRowsBySource('Built-in').filter({ hasText: 'Dynamic' }),
      ).toHaveCount(1);
    });

    await pmmTest.step('Create a rule from the template with the default of 80', async () => {
      await createRule(api, ruleName, 80);
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
      await alertThresholdsPage.setOverride(ruleName, '1');
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
  'PMM-T2365 - Verify only valid overridable templates are accepted and shown as Dynamic @fb-alerting',
  async ({ alertingPage, page }) => {
    const rejected = [
      {
        message: 'in expression C must be the whole right-hand side of a comparison',
        name: 'test_dt_bad1',
        options: { expression: '$A > [[ .threshold ]] * 2' },
      },
      {
        message: 'in expression C must be the whole right-hand side of a comparison',
        name: 'test_dt_bad2',
        options: { expression: '[[ .threshold ]] < $A' },
      },
      {
        message: "overridable parameter 'threshold' requires the queries and expressions template form",
        name: 'test_dt_bad3',
        options: { singleExpression: true },
      },
      {
        message: 'an overridable parameter must be of type float, got bool',
        name: 'test_dt_bad4',
        options: { boolParam: true },
      },
    ];

    await page.goto(alertingPage.urls.templates);

    await pmmTest.step('A valid overridable template is added and shown as Dynamic', async () => {
      await alertingPage.createTemplate(overridableTemplate(memoryTemplate));
      await expect(alertingPage.messages.popUp).toContainText('Alert rule template successfully added');
      await expect(
        alertingPage.builders.templateRow(memoryTemplate).getByText('Dynamic', { exact: true }),
      ).toBeVisible();
    });

    await pmmTest.step('View shows the template text with the overridable parameter', async () => {
      await alertingPage.builders.templateRow(memoryTemplate).getByRole('button', { name: 'View' }).click();
      await expect(alertingPage.elements.dialog.getByRole('textbox')).toHaveValue(/overridable: true/);
      await expect(
        alertingPage.elements.dialog.getByRole('button', { name: 'Copy to clipboard' }),
      ).toBeVisible();
      await alertingPage.elements.dialog.getByRole('button', { exact: true, name: 'Close' }).click();
    });

    await pmmTest.step('A compound condition is accepted', async () => {
      await alertingPage.createTemplate(
        overridableTemplate('test_dt_ok2', { expression: '($A < [[ .threshold ]]) || $A == 0' }),
      );
      await expect(alertingPage.messages.popUp).toContainText('Alert rule template successfully added');
      await expect(
        alertingPage.builders.templateRow('test_dt_ok2').getByText('Dynamic', { exact: true }),
      ).toBeVisible();
    });

    for (const { message, name, options } of rejected) {
      await pmmTest.step(`${name} is refused`, async () => {
        await alertingPage.createTemplate(overridableTemplate(name, options));
        await expect(alertingPage.messages.popUp.filter({ hasText: message })).toContainText(
          'Failed to parse rule template',
        );
        await alertingPage.buttons.cancelTemplate.click();
      });
    }

    await pmmTest.step('Only the valid templates were added', async () => {
      await page.reload();
      await expect(alertingPage.builders.templateRow(memoryTemplate)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(alertingPage.builders.templateRow('test_dt_ok2')).toBeVisible();

      for (const { name } of rejected) await expect(alertingPage.builders.templateRow(name)).toHaveCount(0);
    });
  },
);

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

    await createRule(api, ruleName, 80);
    await page.reload();

    await pmmTest.step('An out-of-range value is refused and the edit is kept', async () => {
      await nodesPage.openAlertThresholds(pmmServerNode);
      await alertThresholdsPage.setOverride(ruleName, '150');
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
      await alertThresholdsPage.setOverride(ruleName, '95');
      await alertThresholdsPage.buttons.cancel.click();
      await expect(alertThresholdsPage.elements.modal).toBeHidden();
      await expect(alertThresholdsPage.messages.updated).toBeHidden();
      await nodesPage.openAlertThresholds(pmmServerNode);
      await expect(alertThresholdsPage.builders.overrideInput(ruleName)).toHaveValue('80');
    });

    await pmmTest.step('Typing the default back clears the override', async () => {
      await alertThresholdsPage.setOverride(ruleName, '95');
      await alertThresholdsPage.buttons.submit.click();
      await expect(alertThresholdsPage.messages.updated).toBeVisible();
      await nodesPage.openAlertThresholds(pmmServerNode);
      await alertThresholdsPage.setOverride(ruleName, '80');
      await alertThresholdsPage.buttons.submit.click();
      await expect(alertThresholdsPage.elements.modal).toBeHidden();
      await nodesPage.openAlertThresholds(pmmServerNode);
      await expect(alertThresholdsPage.builders.overrideInput(ruleName)).toHaveValue('80');
      // API: the field shows the effective value either way, so only the API tells a cleared override apart.
      expect(
        (await api.alertingApi.listThresholds(pmmServerNode)).filter(({ is_overridden }) => is_overridden),
      ).toEqual([]);
    });
  },
);

pmmTest(
  'PMM-T2367 - Verify users without the Admin role cannot open the threshold overrides @fb-alerting',
  async ({ alertThresholdsPage, api, grafanaHelper, nodesPage, page }) => {
    const ruleName = 'dt-cpu-80';
    const inventoryMenu = page.getByTestId('navitem-inventory');

    await createRule(api, ruleName, 80);
    userIds.push(await grafanaHelper.createUser(viewer.username, viewer.password));

    const editorId = await grafanaHelper.createUser(editor.username, editor.password);

    userIds.push(editorId);
    await grafanaHelper.promoteToEditor(editorId);

    await pmmTest.step('Admin sets an override of 95 on pmm-server', async () => {
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds(pmmServerNode);
      await alertThresholdsPage.setOverride(ruleName, '95');
      await alertThresholdsPage.buttons.submit.click();
      await expect(alertThresholdsPage.messages.updated).toBeVisible();
    });

    for (const user of [editor, viewer]) {
      await pmmTest.step(`${user.username} has no Inventory and no node actions`, async () => {
        await grafanaHelper.authorize(user.username, user.password);
        await page.goto('');
        await expect(page.getByTestId('navitem-home-page')).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
        await expect(inventoryMenu).toBeHidden();
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

    for (const { name, template, threshold } of rules) await createRule(api, name, threshold, template);

    await createRule(api, 'dt-static', 20, 'pmm_node_low_free_memory');

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
      await alertThresholdsPage.setOverride('dt-cpu-70', '95');
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

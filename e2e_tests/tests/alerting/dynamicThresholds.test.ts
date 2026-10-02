import pmmTest from '@fixtures/pmmTest';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { AlertSeverity } from '@interfaces/alerting';
import { expect } from '@playwright/test';
import type { ThresholdTarget } from '@api/alerting.api';

pmmTest.describe.configure({ mode: 'default' });

const templateName = 'pmm_node_high_cpu_load';
const ruleName = 'Dynamic threshold CPU rule';
const serverNode = 'pmm-server';
// CPU usage never exceeds 100%, so the rule fires only for a node whose override is lowered.
const ruleDefault = 100;
const editor = { password: 'password', username: 'test_editor' };
let createdEditorId: number | undefined;
let ruleId: string;
let serverNodeId: string;
const serverTarget = (): ThresholdTarget => ({
  param_name: 'threshold',
  rule_id: ruleId,
  scope: 'THRESHOLD_SCOPE_NODE',
  target: serverNodeId,
});

pmmTest.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  const grafanaHelper = new GrafanaHelper(page);
  const { created, id } = await grafanaHelper.findOrCreateUser(editor.username, editor.password);

  if (created) createdEditorId = id;

  await grafanaHelper.promoteToEditor(id);
  await page.close();
});

pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
  await grafanaHelper.authorize();
  await api.settingsApi.updateSettings({ enable_alerting: true });
  await api.alertingApi.removeAllAlertRules();

  const node = (await api.inventoryApi.getAllNodes()).find(({ node_name }) => node_name === serverNode);

  if (!node) throw new Error(`Node "${serverNode}" is not registered`);

  serverNodeId = node.node_id;

  const createdRuleId = await api.alertingApi.createRuleFromTemplate({
    folderUid: await api.grafanaApi.getFolderUid('OS'),
    group: '10s',
    interval: '10s',
    name: ruleName,
    pendingPeriod: '10s',
    severity: AlertSeverity.Warning,
    templateName,
    threshold: ruleDefault,
  });

  if (!createdRuleId) throw new Error(`Rule from overridable template "${templateName}" returned no rule_id`);

  ruleId = createdRuleId;
});

pmmTest.afterEach(async ({ api }) => {
  await api.alertingApi.removeAllAlertRules();
});

pmmTest.afterAll(async ({ browser }) => {
  const page = await browser.newPage();

  if (createdEditorId) await new GrafanaHelper(page).deleteUser(createdEditorId);

  await page.close();
});

pmmTest(
  'PMM-T0000 - Verify overridable template is marked Dynamic in the templates list @fb-alerting @grafana-pr',
  async ({ alertingPage, page }) => {
    await page.goto(alertingPage.urls.templates);
    await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(alertingPage.builders.templateRow('Node high CPU load').getByText('Dynamic')).toBeVisible();
  },
);

pmmTest(
  'PMM-T0000 - Verify a node threshold override can be set and reset from Inventory @fb-alerting @grafana-pr',
  async ({ api, nodesPage, page }) => {
    await pmmTest.step('Open the thresholds modal for the PMM Server node', async () => {
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds(serverNode);
      await expect(nodesPage.thresholdsModal.title).toHaveText(`Alert thresholds: ${serverNode}`);
      await expect(nodesPage.thresholdsModal.overrideInput(ruleName)).toHaveValue(String(ruleDefault));
    });

    await pmmTest.step('Override the threshold and submit', async () => {
      await nodesPage.thresholdsModal.overrideInput(ruleName).fill('42');
      await nodesPage.thresholdsModal.submit.click();
      await expect(page.getByText('Alert thresholds updated')).toBeVisible();

      const [threshold] = await api.alertingApi.listThresholds('THRESHOLD_SCOPE_NODE', serverNodeId, ruleId);

      expect(threshold).toMatchObject({
        default_value: ruleDefault,
        effective_value: 42,
        is_overridden: true,
      });
    });

    await pmmTest.step('Reopen, reset to default and submit', async () => {
      await nodesPage.openAlertThresholds(serverNode);
      await expect(nodesPage.thresholdsModal.overrideInput(ruleName)).toHaveValue('42');
      await nodesPage.thresholdsModal.resetButton(ruleName).click();
      await expect(nodesPage.thresholdsModal.overrideInput(ruleName)).toHaveValue(String(ruleDefault));
      await nodesPage.thresholdsModal.submit.click();
      await expect(page.getByText('Alert thresholds updated')).toBeVisible();

      const [threshold] = await api.alertingApi.listThresholds('THRESHOLD_SCOPE_NODE', serverNodeId, ruleId);

      expect(threshold).toMatchObject({ effective_value: ruleDefault, is_overridden: false });
    });
  },
);

pmmTest(
  'PMM-T0000 - Verify a node override fires the alert only for that node and clearing it resolves @fb-alerting',
  async ({ api }) => {
    const firingNodes = async () =>
      ((await api.alertingApi.getRule(ruleName))?.alerts ?? [])
        .filter(({ state }) => state.toLowerCase() === 'alerting')
        .map(({ labels }) => labels.node_name);

    await pmmTest.step('Rule does not fire at the default threshold', async () => {
      await expect.poll(firingNodes, { timeout: Timeouts.ONE_MINUTE }).toEqual([]);
    });

    await pmmTest.step('Lower the PMM Server node threshold to 0', async () => {
      const response = await api.alertingApi.setThreshold(GrafanaHelper.getAuthHeader(), {
        ...serverTarget(),
        value: 0,
      });

      expect(response.status(), await response.text()).toEqual(200);
    });

    await pmmTest.step('Alert fires for the PMM Server node only', async () => {
      await expect
        .poll(firingNodes, { intervals: [10_000], timeout: Timeouts.FIVE_MINUTES })
        .toEqual([serverNode]);
    });

    await pmmTest.step('Clear the override and the alert resolves', async () => {
      const response = await api.alertingApi.clearThreshold(GrafanaHelper.getAuthHeader(), serverTarget());

      expect(response.status(), await response.text()).toEqual(200);
      await expect.poll(firingNodes, { intervals: [10_000], timeout: Timeouts.FIVE_MINUTES }).toEqual([]);
    });
  },
);

pmmTest(
  'PMM-T0000 - Verify only Admin can change alert threshold overrides @fb-alerting',
  async ({ api }) => {
    const response = await api.alertingApi.setThreshold(
      GrafanaHelper.getAuthHeader(editor.username, editor.password),
      { ...serverTarget(), value: 50 },
    );

    expect(response.status(), await response.text()).toEqual(403);

    const [threshold] = await api.alertingApi.listThresholds('THRESHOLD_SCOPE_NODE', serverNodeId, ruleId);

    expect(threshold.is_overridden).toBe(false);
  },
);

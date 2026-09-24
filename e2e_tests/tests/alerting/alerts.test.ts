import fs from 'node:fs';
import pmmTest from '@fixtures/pmmTest';
import Api from '@api/api';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe.configure({ mode: 'default' });

const ruleName = 'PSQL immortal rule';
const alertFile = 'testdata/ia/scripts/alert.txt';
const postgresqlRule = {
  group: '10s',
  interval: '10s',
  pendingPeriod: '10s',
  serviceName: 'pmm-server-postgresql',
  templateName: 'pmm_postgresql_too_many_connections',
  threshold: 0.01,
};
const viewer = { password: 'password', username: 'test_viewer' };
const editor = { password: 'password', username: 'test_editor' };
const createdUserIds: number[] = [];

pmmTest.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  const api = new Api(page, page.request);
  const grafanaHelper = new GrafanaHelper(page);

  await api.settingsApi.updateSettings({ enable_alerting: true });
  fs.rmSync(alertFile, { force: true });
  await api.alertingApi.removeAllAlertRules();
  await api.alertingApi.setWebhookContactPoint();
  await api.alertingApi.createRuleFromTemplate({
    ...postgresqlRule,
    folderUid: await api.grafanaApi.getFolderUid('PostgreSQL'),
    name: ruleName,
    severity: 'SEVERITY_CRITICAL',
  });

  const { users } = await grafanaHelper.listUsers();
  const existingViewer = users.find((user) => user.login === viewer.username);
  const existingEditor = users.find((user) => user.login === editor.username);
  const editorId = existingEditor?.id ?? (await grafanaHelper.createUser(editor.username, editor.password));

  if (!existingViewer) createdUserIds.push(await grafanaHelper.createUser(viewer.username, viewer.password));
  if (!existingEditor) createdUserIds.push(editorId);

  await grafanaHelper.promoteToEditor(editorId);
  await page.close();
});

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  const grafanaHelper = new GrafanaHelper(page);

  await new Api(page, page.request).alertingApi.removeAllAlertRules();

  for (const userId of createdUserIds.splice(0)) await grafanaHelper.deleteUser(userId);

  await page.close();
});

pmmTest(
  'PMM-T1482 PMM-T1494 + PMM-T1495 - Verify fired alert in Pager Duty and Webhook @ia',
  async ({ alertingPage, api, page }) => {
    await expect
      .poll(async () => (await api.alertingApi.getAlerts()).length, {
        intervals: [Timeouts.FIVE_SECONDS],
        timeout: Timeouts.TWO_MINUTES,
      })
      .toBeGreaterThanOrEqual(1);
    await page.goto(alertingPage.url);

    for (const header of ['State', 'Name', 'Node', 'Service', 'Triggered at']) {
      await expect(alertingPage.builders.columnHeader(header)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
    }

    await expect(alertingPage.builders.alertRow(ruleName)).toHaveCount(1);
    await api.alertingApi.setWebhookContactPoint();
    await expect
      .poll(() => fs.existsSync(alertFile), {
        intervals: [Timeouts.FIVE_SECONDS],
        timeout: Timeouts.FIVE_MINUTES,
      })
      .toBe(true);
    expect(fs.readFileSync(alertFile, 'utf8')).toContain(ruleName);
  },
);

pmmTest(
  'PMM-T1997 - verify viewer can not silence alert @ia',
  async ({ alertingPage, api, grafanaHelper, page }) => {
    await grafanaHelper.authorize(viewer.username, viewer.password);
    await expect
      .poll(async () => (await api.alertingApi.getAlerts()).length, {
        intervals: [Timeouts.FIVE_SECONDS],
        timeout: Timeouts.TWO_MINUTES,
      })
      .toBeGreaterThanOrEqual(1);
    await page.goto(alertingPage.url);
    await expect(alertingPage.builders.alertRow(ruleName)).toBeVisible({ timeout: Timeouts.TWENTY_SECONDS });
    await expect(alertingPage.builders.alertRow(ruleName)).toHaveCount(1);
    await alertingPage.builders.rowActions(ruleName).click();
    await expect(alertingPage.buttons.viewAlertRule).toBeVisible();
    await expect(alertingPage.buttons.silence).toBeHidden();
    await expect(alertingPage.buttons.editAlertRule).toBeHidden();
  },
);

pmmTest(
  'PMM-T1998 - verify editor is able to silence and unsilence alert @ia',
  async ({ alertingPage, api, grafanaHelper, page }) => {
    await grafanaHelper.authorize(editor.username, editor.password);
    await expect
      .poll(async () => (await api.alertingApi.getAlerts()).length, {
        intervals: [Timeouts.FIVE_SECONDS],
        timeout: Timeouts.TWO_MINUTES,
      })
      .toBeGreaterThanOrEqual(1);
    await page.goto(alertingPage.url);
    await expect(alertingPage.builders.alertRow(ruleName)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
    await expect(alertingPage.builders.stateCell(ruleName)).toContainText('Firing');

    await pmmTest.step('Silence the alert', async () => {
      await alertingPage.silenceAlert(ruleName);
      await expect(alertingPage.messages.popUp).toContainText('Silence created', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await page.goto(alertingPage.url);
      await expect(alertingPage.builders.alertRow(ruleName)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await expect(alertingPage.builders.stateCell(ruleName)).toContainText('Silenced');
    });

    await pmmTest.step('Unsilence the alert', async () => {
      await api.alertingApi.deleteActiveSilences();
      await page.goto(alertingPage.url);
      await expect(alertingPage.builders.alertRow(ruleName)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await expect(alertingPage.builders.stateCell(ruleName)).toContainText('Firing');
    });
  },
);

pmmTest(
  'PMM-T1496 + PMM-T1497 - Verify it is possible to silence and unsilence alert @ia',
  async ({ alertingPage, api, page }) => {
    await expect
      .poll(async () => (await api.alertingApi.getAlerts()).length, {
        intervals: [Timeouts.FIVE_SECONDS],
        timeout: Timeouts.TWO_MINUTES,
      })
      .toBeGreaterThanOrEqual(1);
    await page.goto(alertingPage.url);
    await expect(alertingPage.builders.alertRow(ruleName)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
    await expect(alertingPage.builders.stateCell(ruleName)).toContainText('Firing');

    await pmmTest.step('Silence the alert', async () => {
      await alertingPage.silenceAlert(ruleName);
      await expect(alertingPage.messages.popUp).toContainText('Silence created', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await page.goto(alertingPage.url);
      await expect(alertingPage.builders.alertRow(ruleName)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await expect(alertingPage.builders.stateCell(ruleName)).toContainText('Silenced');
    });

    await pmmTest.step('Unsilence the alert', async () => {
      await api.alertingApi.deleteActiveSilences();
      await page.goto(alertingPage.url);
      await expect(alertingPage.builders.alertRow(ruleName)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await expect(alertingPage.builders.stateCell(ruleName)).toContainText('Firing');
    });
  },
);

pmmTest(
  'PMM-T1498 - Verify firing alerts disappear when the condition is fixed @ia',
  async ({ alertingPage, page }) => {
    await page.goto(alertingPage.url);
    await expect(alertingPage.builders.alertRow(ruleName)).toBeVisible();

    await pmmTest.step('Raise the rule threshold above the current value', async () => {
      await alertingPage.builders.rowActions(ruleName).click();
      await alertingPage.buttons.editAlertRule.click();
      await expect(alertingPage.inputs.ruleExpression).toBeVisible({ timeout: Timeouts.TWENTY_SECONDS });
      await alertingPage.inputs.ruleExpression.fill('$A > 10');
      await alertingPage.buttons.saveRule.click();
    });

    await page.goto(alertingPage.url);
    await expect(alertingPage.builders.stateCell(ruleName)).toHaveText('Normal', {
      timeout: Timeouts.TWO_MINUTES,
    });
  },
);

pmmTest(
  'PMM-T659 - Verify alerts are deleted after deleting rules @ia',
  async ({ alertingPage, api, page }) => {
    await api.alertingApi.removeAllAlertRules();
    await page.goto(alertingPage.url);
    await expect(alertingPage.elements.noAlerts).toBeVisible({ timeout: Timeouts.TWENTY_SECONDS });
  },
);

pmmTest('PMM-T564 - Verify fired alert severity colors @ia', async ({ alertingPage, api, page }) => {
  const severities = [
    'SEVERITY_CRITICAL',
    'SEVERITY_ERROR',
    'SEVERITY_NOTICE',
    'SEVERITY_WARNING',
    'SEVERITY_ALERT',
    'SEVERITY_INFO',
    'SEVERITY_DEBUG',
    'SEVERITY_EMERGENCY',
  ] as const;

  await api.alertingApi.removeAllAlertRules();

  const folderUid = await api.grafanaApi.getFolderUid('PostgreSQL');

  for (const severity of severities) {
    await api.alertingApi.createRuleFromTemplate({ ...postgresqlRule, folderUid, name: severity, severity });
  }

  await expect
    .poll(async () => (await api.alertingApi.getAlerts()).length, {
      intervals: [Timeouts.FIVE_SECONDS],
      timeout: Timeouts.TWO_MINUTES,
    })
    .toBeGreaterThanOrEqual(severities.length);
  await page.goto(alertingPage.url);

  for (const severity of severities) {
    await expect(alertingPage.builders.alertRow(severity)).toBeVisible({ timeout: Timeouts.TWENTY_SECONDS });
    await expect(alertingPage.builders.stateCell(severity)).toContainText('Firing', {
      timeout: Timeouts.TEN_SECONDS,
    });
    await expect(alertingPage.builders.severityCell(severity)).toContainText(
      `${severity[9]}${severity.slice(10).toLowerCase()}`,
    );
  }
});

pmmTest('PMM-T1467 - Verify empty Fired alerts list @fb-alerting', async ({ alertingPage, api, page }) => {
  await api.alertingApi.removeAllAlertRules();
  await page.goto(alertingPage.url);
  await expect(alertingPage.elements.noAlerts).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
});

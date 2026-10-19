import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { SettingsResponse } from '@interfaces/settings';
import { expect } from '@playwright/test';
import { isDeepStrictEqual } from 'node:util';

pmmTest.describe.configure({ mode: 'default' });

const password = 'password';
const users = { editor: 'test_editor', viewer: 'test_viewer' } as const;
const noAccess = 'Insufficient access permissions.';
const createdUserIds: number[] = [];

pmmTest.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  const grafanaHelper = new GrafanaHelper(page);
  const viewer = await grafanaHelper.findOrCreateUser(users.viewer, password);
  const editor = await grafanaHelper.findOrCreateUser(users.editor, password);

  for (const { created, id } of [viewer, editor]) {
    if (created) createdUserIds.push(id);
  }

  await grafanaHelper.promoteToEditor(editor.id);
  await page.close();
});

pmmTest.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  const grafanaHelper = new GrafanaHelper(page);

  for (const userId of createdUserIds.splice(0)) {
    expect.soft((await grafanaHelper.deleteUser(userId)).status(), `Delete user ${userId}`).toEqual(200);
  }

  await page.close();
});

pmmTest(
  'PMM-T682 - Verify backup locations access for user with viewer role [critical] @grafana-pr',
  async ({ api, grafanaHelper, page, scheduledBackupsPage }) => {
    await api.settingsApi.enableBackupManagement();
    await grafanaHelper.authorize(users.viewer, password);
    await page.goto(scheduledBackupsPage.urls.locations);
    await expect(scheduledBackupsPage.elements.unauthorized).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(scheduledBackupsPage.elements.unauthorized).toContainText(noAccess);
  },
);

for (const role of ['viewer', 'editor'] as const) {
  for (const target of ['addInstancePage', 'settingsPage', 'nodesPage', 'servicesPage'] as const) {
    pmmTest(
      `PMM-T824 - Verify ${role} users do not see Inventory, Settings, Remote Instances Page @permissions-nightly @gssapi-nightly @grafana-pr | ${target}`,
      async ({ addInstancePage, grafanaHelper, nodesPage, page, servicesPage, settingsPage }) => {
        const { elements, url } = { addInstancePage, nodesPage, servicesPage, settingsPage }[target];

        await grafanaHelper.authorize(users[role], password);
        await page.goto(url);
        await expect(elements.unauthorized).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
        await expect(elements.unauthorized).toContainText(noAccess);
      },
    );
  }
}

for (const role of ['editor', 'viewer'] as const) {
  pmmTest(
    `PMM-T334 + PMM-T420 + PMM-T1726 - Verify Home dashboard and the pt-summary with viewer or editor role @permissions-nightly @gssapi-nightly @grafana-pr | ${users[role]}`,
    async ({ dashboard, grafanaHelper, page }) => {
      await grafanaHelper.authorize(users[role], password);

      await pmmTest.step('Verify the Home dashboard panels are displayed', async () => {
        await page.goto(dashboard.home.url);

        for (const panel of ['Monitored Nodes', 'Monitored DB Services']) {
          await expect(dashboard.builders.panelByExactName(panel)).toBeVisible({
            timeout: Timeouts.THIRTY_SECONDS,
          });
        }
      });

      await pmmTest.step('Verify the pt-summary is displayed on the Node Summary dashboard', async () => {
        await page.goto(dashboard.os.nodeSummary.url);
        await dashboard.loadAllPanels();
        await expect(dashboard.elements.summaryFingerprint).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
      });
    },
  );
}

for (const role of ['viewer', 'editor'] as const) {
  pmmTest(
    `PMM-T1987 - Verify viewer/editor users can get settings/readonly @fb-settings | ${users[role]}`,
    async ({ api, request }) => {
      const response = await request.get(apiEndpoints.server.readonlySettings, {
        headers: GrafanaHelper.getAuthHeader(users[role], password),
      });

      expect(response.status()).toEqual(200);

      const { settings } = (await response.json()) as SettingsResponse;
      const { settings: expected } = await api.settingsApi.getSettings();

      for (const key of [
        'updates_enabled',
        'telemetry_enabled',
        'advisor_enabled',
        'pmm_public_address',
        'backup_management_enabled',
        'azurediscover_enabled',
        'enable_access_control',
      ] as const) {
        expect(settings[key], `Readonly ${key} must match the admin settings`).toBe(expected[key]);
      }
    },
  );
}

pmmTest.describe(() => {
  let before: SettingsResponse['settings'];

  pmmTest.beforeEach(async ({ api }) => {
    ({ settings: before } = await api.settingsApi.getSettings());
  });

  pmmTest.afterEach(async ({ api }) => {
    const { settings: after } = await api.settingsApi.getSettings();

    if (isDeepStrictEqual(after, before)) return;

    await api.settingsApi.changeSettings({
      enable_advisor: before.advisor_enabled,
      enable_alerting: before.alerting_enabled,
      enable_telemetry: before.telemetry_enabled ?? false,
    });
  });

  for (const role of ['viewer', 'editor'] as const) {
    pmmTest(
      `PMM-T2398 - Verify viewer/editor users cannot update settings @fb-settings | ${users[role]}`,
      async ({ api }) => {
        const response = await api.settingsApi.putSettings(
          { enable_advisor: false, enable_alerting: false, enable_telemetry: false, updates_enabled: false },
          GrafanaHelper.getAuthHeader(users[role], password),
        );

        expect(response.status()).toEqual(403);
      },
    );
  }
});

pmmTest(
  'PMM-T1991 - verify viewer is not able to access rule templates page @fb-alerting @grafana-pr',
  async ({ alertingPage, grafanaHelper, page }) => {
    await grafanaHelper.authorize(users.viewer, password);
    await page.goto(alertingPage.urls.templates);
    await expect(alertingPage.elements.unauthorized).toContainText(noAccess, {
      timeout: Timeouts.TEN_SECONDS,
    });
  },
);

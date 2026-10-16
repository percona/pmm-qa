import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';
import { HaStatusResponse } from '@interfaces/ha';
import { expect } from '@playwright/test';

const secondsInDay = 86_400;
let original: { data_retention: string; telemetry_enabled?: boolean };

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
  original = (await api.settingsApi.getSettings()).settings;
});

pmmTest.afterEach(async ({ api }) => {
  await api.settingsApi.updateSettings({
    data_retention: original.data_retention,
    enable_telemetry: original.telemetry_enabled === true,
  });
});

pmmTest(
  'PMM-T2290 - Verify Data retention in HA equals dataRetentionDays and cannot be changed @pmm-ha',
  async ({ api, haClusterHelper, page, settingsPage }) => {
    const days = haClusterHelper.dataRetentionDaysFromChart();
    const retention = `${days * secondsInDay}s`;

    await pmmTest.step(`Verify Settings shows the chart's ${days} days`, async () => {
      expect(original.data_retention).toEqual(retention);

      await page.goto(settingsPage.urls.advanced);
      await settingsPage.waitForPageLoaded();
      await expect(settingsPage.inputs.dataRetention).toHaveValue(String(days));
    });

    await pmmTest.step(`Verify a change to ${days + 1} days is refused`, async () => {
      const response = await api.settingsApi.putSettings({ data_retention: `${(days + 1) * secondsInDay}s` });

      expect(response.status()).toEqual(400);
      expect(((await response.json()) as { message: string }).message).toEqual(
        settingsPage.haDataRetentionErrorMessage,
      );
    });

    await pmmTest.step('Verify the refused change wrote nothing', async () => {
      expect((await api.settingsApi.getSettings()).settings.data_retention).toEqual(retention);

      await page.reload();
      await settingsPage.waitForPageLoaded();
      await expect(settingsPage.inputs.dataRetention).toHaveValue(String(days));
    });
  },
);

pmmTest(
  'PMM-T2291 - Verify other Advanced settings still save in HA while Data retention is unchanged @pmm-ha',
  async ({ api, haClusterHelper, page, settingsPage }) => {
    const days = haClusterHelper.dataRetentionDaysFromChart();
    const telemetry = settingsPage.buttons.toggles.telemetry;

    await pmmTest.step('Open Advanced settings with Telemetry on', async () => {
      if (original.telemetry_enabled !== true) {
        await api.settingsApi.updateSettings({ enable_telemetry: true });
      }

      await page.goto(settingsPage.urls.advanced);
      await settingsPage.waitForPageLoaded();
      await expect(telemetry.input).toBeChecked();
      await expect(settingsPage.inputs.dataRetention).toHaveValue(String(days));
    });

    await pmmTest.step('Turn Telemetry off and apply', async () => {
      await telemetry.locator.click();

      const response = await settingsPage.applyAdvancedChanges();

      expect(response.status()).toEqual(200);
      await expect(settingsPage.messages.popUp).toContainText('Settings updated', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(settingsPage.messages.popUp).not.toContainText('Data retention cannot be changed');
    });

    await pmmTest.step('Verify Telemetry is off and Data retention is untouched after a reload', async () => {
      const { settings } = await api.settingsApi.getSettings();

      expect(settings.telemetry_enabled ?? false).toEqual(false);
      expect(settings.data_retention).toEqual(original.data_retention);

      await page.reload();
      await settingsPage.waitForPageLoaded();
      await expect(telemetry.input).not.toBeChecked();
      await expect(settingsPage.inputs.dataRetention).toHaveValue(String(days));
    });

    await pmmTest.step('Turn Telemetry back on and apply', async () => {
      await telemetry.locator.click();

      const response = await settingsPage.applyAdvancedChanges();

      expect(response.status()).toEqual(200);
      await expect(settingsPage.messages.popUp).toContainText('Settings updated', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      expect((await api.settingsApi.getSettings()).settings.telemetry_enabled).toEqual(true);
    });
  },
);

pmmTest(
  'PMM-T2292 - Verify Data retention field is read-only in HA and points at the chart value @pmm-ha',
  async ({ haClusterHelper, page, settingsPage }) => {
    const days = haClusterHelper.dataRetentionDaysFromChart();

    await pmmTest.step('Open Advanced settings and wait for the HA status it renders from', async () => {
      const [haStatus] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes(apiEndpoints.ha.status) && response.request().method() === 'GET',
          { timeout: Timeouts.THIRTY_SECONDS },
        ),
        page.goto(settingsPage.urls.advanced),
      ]);

      expect(((await haStatus.json()) as HaStatusResponse).status).toEqual('Enabled');
      await settingsPage.waitForPageLoaded();
    });

    await pmmTest.step(`Verify the field is disabled and still reads ${days} days`, async () => {
      await expect(settingsPage.inputs.dataRetention).toBeDisabled();
      await expect(settingsPage.inputs.dataRetention).toHaveValue(String(days));
    });

    await pmmTest.step('Verify the helper text points at the chart', async () => {
      await expect(settingsPage.inputs.dataRetention).toHaveAccessibleDescription(
        settingsPage.haDataRetentionHelperText,
      );
    });
  },
);

import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const dataRetentionRows = [
  { message: 'Value must be less than or equal to 3650.', value: '2147483648' },
  { message: 'Value must be greater than or equal to 1.', value: '-1' },
  { message: 'Value must be greater than or equal to 1.', value: '0' },
];

pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
  await grafanaHelper.authorize();
  await api.settingsApi.restoreSettingsDefaults();
});

pmmTest.afterEach(async ({ api }) => {
  await api.settingsApi.setPublicAddress('');
});

for (const row of dataRetentionRows) {
  pmmTest(
    `PMM-T97 - Verify server diagnostics on PMM Settings Page: data retention "${row.value}" @settings @grafana-pr`,
    async ({ page, settingsPage }) => {
      await page.goto(settingsPage.urls.advanced);
      await settingsPage.waitForPageLoaded();

      await pmmTest.step(`Verify data retention "${row.value}" is rejected`, async () => {
        await settingsPage.inputs.dataRetention.clear();
        await settingsPage.inputs.dataRetention.fill(row.value);
        await page.keyboard.press('Tab');
        await expect(settingsPage.inputs.dataRetention).toHaveJSProperty('validationMessage', row.message, {
          timeout: Timeouts.THIRTY_SECONDS,
        });
      });
    },
  );
}

pmmTest(
  'PMM-T84 - Verify Section Tabs and Metrics Section Elements [critical] @settings @grafana-pr',
  async ({ page, settingsPage }) => {
    await page.goto(settingsPage.url);
    await settingsPage.waitForPageLoaded();

    await pmmTest.step('Verify the metrics resolution section elements', async () => {
      await expect(settingsPage.elements.metricsResolutionLabel).toContainText('Metrics resolution', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(settingsPage.buttons.metricsResolutionStandard).toBeVisible();
      await expect(settingsPage.inputs.low).toBeVisible();
      await expect(settingsPage.inputs.medium).toBeVisible();
      await expect(settingsPage.inputs.high).toBeVisible();
    });
  },
);

pmmTest(
  'PMM-T85 - Verify SSH Key Section Elements @settings @grafana-pr',
  async ({ api, page, settingsPage }) => {
    // eslint-disable-next-line playwright/no-skipped-test -- the SSH key section renders only on an AMI distribution; a runtime skip reports that honestly where the source's early return reported a pass.
    pmmTest.skip(
      (await api.serverApi.getDistributionMethod()) !== 'DISTRIBUTION_METHOD_AMI',
      'SSH key section renders only on an AMI distribution',
    );

    await page.goto(settingsPage.urls.ssh);
    await settingsPage.waitForPageLoaded();

    await pmmTest.step('Verify the SSH key section elements', async () => {
      await expect(settingsPage.elements.sshKeyLabel).toContainText('SSH key');
      await expect(settingsPage.inputs.sshKey).toBeVisible();
    });
  },
);

pmmTest('Verify Advanced Section Elements @settings @grafana-pr', async ({ page, settingsPage }) => {
  await page.goto(settingsPage.urls.advanced);
  await settingsPage.waitForPageLoaded();

  await pmmTest.step('Verify the advanced section labels', async () => {
    await expect(settingsPage.elements.advancedLabel).toContainText('Data retention');
    await expect(settingsPage.elements.telemetryLabel).toContainText('Telemetry');
    await expect(settingsPage.elements.checkForUpdatesLabel).toContainText('Check for updates');
    await expect(settingsPage.elements.advisorsLabel).toContainText('Advisors');
  });

  await pmmTest.step('Verify the advanced section toggles', async () => {
    await expect(settingsPage.buttons.toggles.telemetry.locator).toBeVisible();
    await expect(settingsPage.elements.telemetryLabel).toBeVisible();
    await expect(settingsPage.buttons.toggles.checkForUpdates.locator).toBeVisible();
    await expect(settingsPage.elements.checkForUpdatesLabel).toBeVisible();
    await expect(settingsPage.buttons.toggles.advisors.locator).toBeVisible();
    await expect(settingsPage.elements.advisorsLabel).toBeVisible();
  });
});

pmmTest(
  'PMM-T1866 - Verify if public address has an port assigned and following UI/API requests dont error @settings',
  async ({ page, settingsPage }) => {
    await page.goto(settingsPage.urls.advanced);
    await settingsPage.waitForPageLoaded();

    await pmmTest.step('Set a public address that carries a port', async () => {
      await expect(settingsPage.elements.publicAddressLabel).toContainText('Public address', {
        timeout: Timeouts.ONE_MINUTE,
      });
      await settingsPage.inputs.publicAddress.clear();
      await settingsPage.inputs.publicAddress.fill('192.168.1.1:8433');
      await settingsPage.applyAdvancedChanges();
      await expect(settingsPage.buttons.applyAdvancedChanges).toHaveText('Apply changes', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(settingsPage.inputs.publicAddress).toHaveValue('192.168.1.1:8433', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(settingsPage.elements.errorAlert).toBeHidden();
    });

    await pmmTest.step('Change data retention with the public address still set', async () => {
      await settingsPage.inputs.dataRetention.clear();
      await settingsPage.inputs.dataRetention.fill('1');
      await settingsPage.applyAdvancedChanges();
      await expect(settingsPage.buttons.applyAdvancedChanges).toHaveText('Apply changes', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(settingsPage.inputs.dataRetention).toHaveValue('1', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(settingsPage.elements.errorAlert).toBeHidden();
    });
  },
);

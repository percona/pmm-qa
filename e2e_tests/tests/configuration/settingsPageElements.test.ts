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
  await api.serverApi.waitForReady();
  await api.settingsApi.enableBackupManagement();
  await api.settingsApi.updateSettings({ enable_azurediscover: false });
  await api.settingsApi.restoreSettingsDefaults();
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
  });

  await pmmTest.step('Verify the advanced section toggles', async () => {
    await expect(settingsPage.buttons.toggles.telemetry.locator).toBeVisible();
    await expect(settingsPage.elements.telemetryLabel).toBeVisible();
    await expect(settingsPage.buttons.toggles.checkForUpdates.locator).toBeVisible();
    await expect(settingsPage.elements.checkForUpdatesLabel).toBeVisible();
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

pmmTest(
  'PMM-T93 - Open PMM Settings page and verify changing Metrics Resolution [critical] @settings @grafana-pr',
  async ({ page, settingsPage }) => {
    await page.goto(settingsPage.url);
    await settingsPage.waitForPageLoaded();

    await pmmTest.step('Apply the Rare metrics resolution', async () => {
      await expect(settingsPage.buttons.metricsResolutionRare).toBeAttached({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await settingsPage.buttons.metricsResolutionRare.click();
      await expect(settingsPage.buttons.applyMetricsChanges).toBeEnabled({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await settingsPage.buttons.applyMetricsChanges.click();
      await expect(settingsPage.messages.popUp).toContainText('Settings updated', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
    });

    await pmmTest.step('Verify Rare is still selected after a reload', async () => {
      await page.reload();
      await settingsPage.waitForPageLoaded();
      await expect(settingsPage.buttons.metricsResolutionRare).toBeChecked({
        timeout: Timeouts.THIRTY_SECONDS,
      });
    });
  },
);

pmmTest(
  'PMM-T94 - Open PMM Settings page and verify changing Data Retention [critical] @settings',
  async ({ page, settingsPage }) => {
    await page.goto(settingsPage.url);
    await settingsPage.waitForPageLoaded();
    await settingsPage.tabs.advanced.click();
    await expect(settingsPage.buttons.applyAdvancedChanges).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

    await pmmTest.step('Apply a data retention of 1 day', async () => {
      await settingsPage.inputs.dataRetention.fill('1');
      await expect(settingsPage.buttons.applyAdvancedChanges).toBeEnabled({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await settingsPage.buttons.applyAdvancedChanges.click();
      await expect(settingsPage.messages.popUp).toContainText('Settings updated', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
    });

    await pmmTest.step('Verify the data retention after a reload', async () => {
      await page.reload();
      await settingsPage.waitForPageLoaded();
      await settingsPage.tabs.advanced.click();
      await expect(settingsPage.buttons.applyAdvancedChanges).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(settingsPage.inputs.dataRetention).toHaveValue('1', { timeout: Timeouts.THIRTY_SECONDS });
    });
  },
);

pmmTest(
  'PMM-T532 + PMM-T533 + PMM-T536 - Verify user can disable/enable IA in Settings @fb-alerting @settings',
  async ({ page, settingsPage }) => {
    const alerting = settingsPage.buttons.toggles.perconaAlerting;

    await page.goto(settingsPage.urls.advanced);

    await pmmTest.step('Disable Percona Alerting', async () => {
      await expect(alerting.locator).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await alerting.locator.click();
      await expect(alerting.input).not.toBeChecked();
      await settingsPage.applyAdvancedChanges();
      await expect(alerting.input).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(alerting.input).not.toBeChecked();
    });

    await pmmTest.step('Enable Percona Alerting', async () => {
      await alerting.locator.click();
      await expect(alerting.input).toBeChecked();
      await settingsPage.applyAdvancedChanges();
      await expect(alerting.locator).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(alerting.input).toBeChecked();
    });
  },
);

pmmTest(
  'PMM-T747 - Verify enabling Azure flag @fb-settings',
  async ({ addInstancePage, api, page, settingsPage }) => {
    const azure = settingsPage.buttons.toggles.azureDiscover;

    await api.settingsApi.updateSettings({ enable_azurediscover: false });

    await pmmTest.step('Verify Azure is not offered while the flag is off', async () => {
      await page.goto(settingsPage.urls.advanced);
      await settingsPage.waitForPageLoaded();
      await expect(azure.input).not.toBeChecked();
      await page.goto(addInstancePage.url);
      await expect(addInstancePage.buttons.mysql).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(addInstancePage.buttons.azure).toBeHidden({ timeout: Timeouts.THIRTY_SECONDS });
    });

    await pmmTest.step('Enable the Azure flag and verify Azure is offered', async () => {
      await page.goto(settingsPage.urls.advanced);
      await settingsPage.waitForPageLoaded();
      await expect(azure.locator).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await azure.locator.click();
      await settingsPage.applyAdvancedChanges();
      await page.goto(addInstancePage.url);
      await expect(addInstancePage.buttons.azure).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    });

    await pmmTest.step('Disable the Azure flag and verify Azure is not offered', async () => {
      await page.goto(settingsPage.urls.advanced);
      await settingsPage.waitForPageLoaded();
      await expect(azure.locator).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await azure.locator.click();
      await settingsPage.applyAdvancedChanges();
      await page.goto(addInstancePage.url);
      await expect(addInstancePage.buttons.mysql).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(addInstancePage.buttons.azure).toBeHidden({ timeout: Timeouts.THIRTY_SECONDS });
    });
  },
);

pmmTest(
  'PMM-T841 - Verify user is able to enable Backup Management @fb-settings',
  async ({ api, page, scheduledBackupsPage, settingsPage }) => {
    const backup = settingsPage.buttons.toggles.backupManagement;

    await api.settingsApi.updateSettings({ enable_backup_management: false });

    await pmmTest.step('Verify Backup Management is off', async () => {
      await page.goto(settingsPage.urls.advanced);
      await expect(backup.input).toBeVisible({ timeout: Timeouts.TWENTY_SECONDS });
      await expect(backup.input).not.toBeChecked();
    });

    await pmmTest.step('Verify the disabled Backup Management message links to PMM Settings', async () => {
      await page.goto(scheduledBackupsPage.url);
      await expect(scheduledBackupsPage.elements.emptyBlock).toBeVisible({
        timeout: Timeouts.TWENTY_SECONDS,
      });
      await expect(scheduledBackupsPage.elements.emptyBlock).toHaveText(
        'Backup Management is disabled. You can enable it in PMM Settings.',
      );
      await scheduledBackupsPage.buttons.settingsLink.click();
      await expect(page).toHaveURL(new RegExp(settingsPage.urls.advanced), {
        timeout: Timeouts.THIRTY_SECONDS,
      });
    });

    await pmmTest.step('Enable Backup Management', async () => {
      await page.goto(settingsPage.urls.advanced);
      await expect(backup.locator).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await backup.locator.click();
      await expect(backup.input).toBeChecked();
      await settingsPage.applyAdvancedChanges();
    });

    await pmmTest.step('Verify scheduled backups are available', async () => {
      await page.goto(scheduledBackupsPage.url);
      await expect(scheduledBackupsPage.buttons.createScheduledBackup).toContainText(
        'Create scheduled backup',
        {
          timeout: Timeouts.THIRTY_SECONDS,
        },
      );
    });
  },
);

pmmTest(
  'PMM-T1658 Verify that backup management is enabled by default @settings',
  async ({ api, dashboard, leftNavigation, page, settingsPage }) => {
    const { settings } = await api.settingsApi.getSettings();

    await page.goto(dashboard.home.url);
    await expect(leftNavigation.menuItemLocator('backups')).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    expect(settings.backup_management_enabled, 'Backup management should be turned on by default').toBe(true);
    await page.goto(settingsPage.urls.advanced);
    await expect(settingsPage.buttons.toggles.backupManagement.locator).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(settingsPage.buttons.toggles.backupManagement.input).toBeChecked();
  },
);

pmmTest(
  'PMM-T486 - Verify Public Address in PMM Settings @nomad',
  async ({ api, baseURL, page, settingsPage }) => {
    await api.settingsApi.setPublicAddress('');
    await api.serverApi.waitForReady();
    await page.goto(settingsPage.urls.advanced);
    await settingsPage.waitForPageLoaded();

    await pmmTest.step('Verify the public address tooltip', async () => {
      await expect(settingsPage.builders.fieldDescription('public-address')).toBeVisible({
        timeout: Timeouts.TEN_SECONDS,
      });
      await expect(settingsPage.builders.fieldDescription('public-address')).toContainText(
        'The address or hostname PMM Server will be accessible at.',
      );
    });

    await pmmTest.step('Save the public address taken from the browser', async () => {
      await expect(settingsPage.inputs.publicAddress).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await settingsPage.buttons.getPublicAddressFromBrowser.click();
      await settingsPage.applyAdvancedChanges();
      await expect(settingsPage.messages.popUp).toContainText('Settings updated', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(settingsPage.inputs.publicAddress).not.toHaveValue('');
    });

    const publicAddress = await settingsPage.inputs.publicAddress.inputValue();

    await pmmTest.step('Verify the public address is kept after a reload', async () => {
      await page.reload();
      await settingsPage.waitForPageLoaded();
      await expect(settingsPage.inputs.publicAddress).toHaveValue(publicAddress);
      expect(baseURL, 'The saved public address should match the PMM Server URL').toContain(publicAddress);
    });
  },
);

pmmTest(
  'PMM-T1227 + PMM-T1338 - Verify tooltip "Read more" links on PMM Settings page redirect to working pages Verify that all the metrics from config are displayed on Telemetry tooltip in Settings > Advanced @fb-settings',
  async ({ api, page, request, settingsPage }) => {
    for (const row of [
      {
        label: 'metrics-resolution',
        link: 'https://per.co.na/metrics_resolution',
        tab: 'metrics',
        text: 'How often PMM collects metrics, in seconds. Lower values provide more detail but use more resources.',
      },
      {
        label: 'advanced',
        link: 'https://per.co.na/data_retention',
        tab: 'advanced',
        text: 'How long PMM keeps collected data. Older data is automatically deleted.',
      },
      {
        label: 'advanced-telemetry',
        link: 'https://per.co.na/telemetry',
        tab: 'advanced',
        text: 'Sends anonymous usage statistics to help improve PMM. No personal or database content is collected.',
      },
    ] as const) {
      await pmmTest.step(`Verify the ${row.label} tooltip and its Read more link`, async () => {
        await page.goto(settingsPage.urls[row.tab]);
        await expect(settingsPage.builders.fieldDescription(row.label)).toBeVisible({
          timeout: Timeouts.TEN_SECONDS,
        });
        await expect(settingsPage.builders.fieldDescription(row.label)).toContainText(row.text);
        await expect(settingsPage.builders.fieldReadMoreLink(row.label)).toBeVisible();
        await expect(settingsPage.builders.fieldReadMoreLink(row.label)).toHaveAttribute('href', row.link);
        expect((await request.get(row.link)).status(), 'Read more link should lead to a working page').toBe(
          200,
        );
      });
    }

    await pmmTest.step('Verify the telemetry dialog lists every collected metric', async () => {
      const { settings } = await api.settingsApi.getSettings();

      await settingsPage.buttons.telemetrySummaries.click();
      await expect(settingsPage.elements.telemetrySummariesContent).toBeVisible({
        timeout: Timeouts.TEN_SECONDS,
      });
      await expect(settingsPage.elements.telemetrySummariesContent).toContainText(
        `We gather and send the following information to Percona:${settings.telemetry_summaries.join('')}`,
      );
    });
  },
);

pmmTest(
  'PMM-T1401 - Verify Percona Alerting wording in Settings @settings',
  async ({ page, request, settingsPage }) => {
    await page.goto(settingsPage.urls.advanced);
    await settingsPage.waitForPageLoaded();
    await expect(settingsPage.buttons.toggles.perconaAlerting.input).toBeChecked();

    await pmmTest.step('Verify the Percona Alerting tooltip and its Read more link', async () => {
      await settingsPage.elements.alertingInfoIcon.click();
      await expect(settingsPage.elements.infoTooltip).toBeVisible();
      await expect(settingsPage.elements.infoTooltip).toHaveText(
        'Option to enable/disable Percona Alerting features. Read more',
      );
      await expect(settingsPage.elements.infoTooltipLink).toBeVisible();
      await expect(settingsPage.elements.infoTooltipLink).toHaveAttribute(
        'href',
        'https://per.co.na/alerting',
      );
      expect(
        (await request.get('https://per.co.na/alerting')).status(),
        'Read more link should lead to a working page',
      ).toBe(200);
    });
  },
);

pmmTest(
  'PMM-T2004 - Verify Data Retention field in advanced settings @settings @nightly  @gssapi-nightly',
  async ({ api, page, settingsPage }) => {
    await page.goto(settingsPage.urls.advanced);
    await settingsPage.waitForPageLoaded();
    await expect(
      settingsPage.buttons.applyAdvancedChanges,
      'Apply Changes button should be disabled when there are no changes.',
    ).toBeDisabled();

    // In HA the pmm-ha chart owns retention, so the field is read-only (see PMM-14787).
    const isHa = (await api.haApi.getStatus()) === 'Enabled';

    await expect(
      settingsPage.inputs.dataRetention,
      `Data retention should be ${isHa ? 'disabled' : 'enabled'} when HA is ${isHa ? 'on' : 'off'}.`,
    ).toBeEnabled({ enabled: !isHa });

    if (isHa) return;

    await settingsPage.inputs.dataRetention.fill('1');
    await expect(
      settingsPage.buttons.applyAdvancedChanges,
      'Apply Changes button should be enabled after value of data retention is changed to 1.',
    ).toBeEnabled();

    await settingsPage.inputs.dataRetention.clear();
    await settingsPage.inputs.dataRetention.press('Enter');
    await expect(
      settingsPage.buttons.applyAdvancedChanges,
      'Apply changes button should be disabled when validation error for empty data retention is present',
    ).toBeDisabled();

    await settingsPage.inputs.dataRetention.fill('3651');
    await expect(settingsPage.inputs.dataRetention).toHaveAccessibleDescription(
      'Value should be in the range from 1 to 3650',
    );
    await expect(
      settingsPage.buttons.applyAdvancedChanges,
      'Apply changes button should be disabled when validation error for data retention that is outside of the range is present',
    ).toBeDisabled();
  },
);

const assert = require('assert');
const { users } = require('../helper/constants');

Feature('PMM Settings Functionality').retry(1);

Before(async ({ I, settingsAPI }) => {
  await I.Authorize();
  await settingsAPI.restoreSettingsDefaults();
});

Scenario('PMM-T93 - Open PMM Settings page and verify changing Metrics Resolution [critical] @settings @grafana-pr', async ({
  I,
  pmmSettingsPage,
}) => {
  const resolutionToApply = 'Rare';

  I.amOnPage(pmmSettingsPage.url);
  await pmmSettingsPage.waitForPmmSettingsPageLoaded();
  await pmmSettingsPage.selectMetricsResolution(resolutionToApply);
  I.verifyPopUpMessage(pmmSettingsPage.messages.successPopUpMessage);
  I.refreshPage();
  await pmmSettingsPage.waitForPmmSettingsPageLoaded();
  await pmmSettingsPage.verifySelectedResolution(resolutionToApply);
});

Scenario('PMM-T94 - Open PMM Settings page and verify changing Data Retention [critical] @settings', async ({
  I,
  pmmSettingsPage,
}) => {
  const dataRetentionValue = '1';
  const sectionNameToExpand = pmmSettingsPage.sectionTabsList.advanced;

  I.amOnPage(pmmSettingsPage.url);
  await pmmSettingsPage.waitForPmmSettingsPageLoaded();
  await pmmSettingsPage.expandSection(sectionNameToExpand, pmmSettingsPage.fields.advancedButton);
  await pmmSettingsPage.waitForPmmSettingsPageLoaded();
  pmmSettingsPage.changeDataRetentionValueTo(dataRetentionValue);
  I.verifyPopUpMessage(pmmSettingsPage.messages.successPopUpMessage);
  I.refreshPage();
  await pmmSettingsPage.waitForPmmSettingsPageLoaded();
  await pmmSettingsPage.expandSection(sectionNameToExpand, pmmSettingsPage.fields.advancedButton);
  await pmmSettingsPage.waitForPmmSettingsPageLoaded();
  I.waitForValue(pmmSettingsPage.fields.dataRetentionInput, dataRetentionValue, 30);
});

Scenario.skip(
  'PMM-T253 - Verify user can see correct tooltip for STT [trivial] @settings @stt @grafana-pr',
  async ({ I, pmmSettingsPage }) => {
    const sectionNameToExpand = pmmSettingsPage.sectionTabsList.advanced;

    I.amOnPage(pmmSettingsPage.url);
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    await pmmSettingsPage.expandSection(sectionNameToExpand, pmmSettingsPage.fields.advancedButton);
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();

    await pmmSettingsPage.verifyTooltip(pmmSettingsPage.tooltips.advancedSettings.stt);
  },
);

Scenario.skip(
  'PMM-T254 + PMM-T253 - Verify disable telemetry while Advisors enabled @settings @stt @grafana-pr',
  async ({ I, pmmSettingsPage }) => {
    I.amOnPage(pmmSettingsPage.advancedSettingsUrl);
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.telemetrySwitchSelectorInput, 'on');
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.sttSwitchSelectorInput, 'on');
    I.click(pmmSettingsPage.fields.telemetrySwitchSelector);
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.telemetrySwitchSelectorInput, 'off');
    I.click(pmmSettingsPage.fields.advancedButton);
    I.refreshPage();
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.sttSwitchSelectorInput, 'on');
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.telemetrySwitchSelectorInput, 'off');
  },
).retry(2);

Scenario(
  'PMM-T532 + PMM-T533 + PMM-T536 - Verify user can disable/enable IA in Settings @fb-alerting @settings',
  async ({
    I, pmmSettingsPage, settingsAPI, adminPage,
  }) => {
    await settingsAPI.apiEnableIA();
    I.amOnPage(pmmSettingsPage.advancedSettingsUrl);
    I.waitForVisible(pmmSettingsPage.fields.perconaAlertingSwitch, 30);
    I.click(pmmSettingsPage.fields.perconaAlertingSwitch);
    I.dontSeeElement(pmmSettingsPage.communication.communicationSection);
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.perconaAlertingSwitchInput, 'off');
    I.click(pmmSettingsPage.fields.advancedButton);
    I.waitForVisible(pmmSettingsPage.fields.perconaAlertingSwitchInput, 30);
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.perconaAlertingSwitchInput, 'off');
    // I.moveCursorTo(adminPage.sideMenu.alertingBellIcon);
    // I.waitForVisible(adminPage.sideMenu.integratedAlertingManuItem, 20);
    // I.seeTextEquals('Integrated Alerting', adminPage.sideMenu.integratedAlerting);
    // I.seeTextEquals('Communication', pmmSettingsPage.communication.communicationSection);
    I.click(pmmSettingsPage.fields.perconaAlertingSwitch);
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.perconaAlertingSwitchInput, 'on');
    I.click(pmmSettingsPage.fields.advancedButton);
    I.waitForVisible(pmmSettingsPage.fields.perconaAlertingSwitch, 30);
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.perconaAlertingSwitchInput, 'on');
    I.dontSeeElementInDOM(adminPage.sideMenu.integratedAlerting);
    I.dontSeeElement(pmmSettingsPage.communication.communicationSection);
  },
).retry(2);

Scenario(
  'PMM-T747 - Verify enabling Azure flag @fb-settings',
  async ({
    I, pmmSettingsPage, remoteInstancesPage, settingsAPI,
  }) => {
    const sectionNameToExpand = pmmSettingsPage.sectionTabsList.advanced;

    I.amOnPage(pmmSettingsPage.url);
    await settingsAPI.disableAzure();
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    await pmmSettingsPage.expandSection(sectionNameToExpand, pmmSettingsPage.fields.advancedButton);
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.microsoftAzureMonitoringSwitchInput, 'off');
    I.amOnPage(remoteInstancesPage.url);
    I.waitForInvisible(remoteInstancesPage.fields.addAzureMySQLPostgreSQL, 30);
    I.amOnPage(pmmSettingsPage.url);
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    await pmmSettingsPage.expandSection(sectionNameToExpand, pmmSettingsPage.fields.advancedButton);
    pmmSettingsPage.switchAzure();
    I.amOnPage(remoteInstancesPage.url);
    I.waitForVisible(remoteInstancesPage.fields.addAzureMySQLPostgreSQL, 30);
    I.amOnPage(pmmSettingsPage.url);
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    await pmmSettingsPage.expandSection(sectionNameToExpand, pmmSettingsPage.fields.advancedButton);
    pmmSettingsPage.switchAzure();
    I.amOnPage(remoteInstancesPage.url);
    I.waitForInvisible(remoteInstancesPage.fields.addAzureMySQLPostgreSQL, 30);
  },
);

Scenario(
  'PMM-T841 - Verify user is able to enable Backup Management @fb-settings',
  async ({
    I, pmmSettingsPage, scheduledPage, settingsAPI, codeceptjsConfig,
  }) => {
    await settingsAPI.changeSettings({ backup: false });

    // Open advanced settings and verify backup management switch is off
    I.amOnPage(pmmSettingsPage.advancedSettingsUrl);
    I.waitForVisible(pmmSettingsPage.fields.backupManagementSwitchInput, 20);
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.backupManagementSwitchInput, 'off');

    // Open scheduled backups page and verify message about disabled backup management
    I.amOnPage(scheduledPage.url);
    I.waitForVisible('$empty-block', 20);

    const message = await I.grabTextFrom('$empty-block');

    assert.ok(
      message.replace(/\s+/g, ' ') === pmmSettingsPage.messages.disabledBackupManagement,
      `Message Shown on ${message} should be equal to ${pmmSettingsPage.messages.disabledBackupManagement}`,
    );
    I.seeAttributesOnElements('$settings-link', { href: `${codeceptjsConfig.config.helpers.Playwright.url}/graph/settings/advanced-settings` });

    // Open advanced settings and enable backup management
    I.amOnPage(pmmSettingsPage.advancedSettingsUrl);
    I.waitForVisible(pmmSettingsPage.fields.backupManagementSwitch, 30);
    I.click(pmmSettingsPage.fields.backupManagementSwitch);
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.backupManagementSwitchInput, 'on');
    I.click(pmmSettingsPage.fields.advancedButton);

    // Open scheduled backups page and verify backup management is enabled
    scheduledPage.openScheduledBackupsPage();
  },
);

Scenario(
  '@PMM-T1658 Verify that backup management is enabled by default @backup @bm-fb',
  async ({
    I, pmmSettingsPage, settingsAPI, homePage, leftNavMenu,
  }) => {
    const pmmVersion = await homePage.getVersions().versionMinor;

    const settingEndpointResponse = await settingsAPI.getSettings('backup_management_enabled');

    if (pmmVersion >= 36 || pmmVersion === undefined) {
      I.amOnPage(homePage.url);
      I.switchTo();
      I.waitForVisible(leftNavMenu.backups.locator, 30);
      I.assertEqual(settingEndpointResponse, true);
      I.amOnPage(pmmSettingsPage.advancedSettingsUrl);
      I.waitForVisible(pmmSettingsPage.fields.backupManagementSwitch, 30);
      await pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.backupManagementSwitchInput, 'on');
      assert.ok(settingEndpointResponse, `Backup managment should be turned on by default from 2.36.0 release but found ${settingEndpointResponse}`);
    } else {
      I.say('Skipping this test PMM-T1658, because PMM Server version is lower then Feature fix version');
    }
  },
).retry(2);

Scenario(
  'PMM-T486 - Verify Public Address in PMM Settings @nightly',
  async ({
    I, pmmSettingsPage, settingsAPI, codeceptjsConfig,
  }) => {
    const expectedUrl = codeceptjsConfig.config.helpers.Playwright.url;

    await settingsAPI.changeSettings({ publicAddress: '' });
    I.wait(3);
    await pmmSettingsPage.openAdvancedSettings();
    await pmmSettingsPage.verifyTooltip(pmmSettingsPage.tooltips.advancedSettings.publicAddress);

    await I.waitForVisible(pmmSettingsPage.fields.publicAddressInput, 30);

    I.seeElement(pmmSettingsPage.fields.publicAddressButton);
    I.click(pmmSettingsPage.fields.publicAddressButton);
    I.wait(1);
    await pmmSettingsPage.applyChanges();

    const publicAddressValue = await I.grabValueFrom(pmmSettingsPage.fields.publicAddressInput);

    I.assertTrue(publicAddressValue.length > 0, 'Expected the Public Address Input Field to be not empty!');
    I.wait(3);
    I.refreshPage();
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    const publicAddressAfterRefresh = await I.grabValueFrom(pmmSettingsPage.fields.publicAddressInput);

    I.assertEqual(
      publicAddressAfterRefresh,
      publicAddressValue,
      `Expected the Public Address to be saved and Match ${publicAddressValue}`,
    );
    I.assertTrue(
      expectedUrl.includes(publicAddressAfterRefresh),
      `Expected the Public Address (${publicAddressAfterRefresh}) to be saved and Match configuration url: ${expectedUrl}`,
    );
  },
).retry(5);

Scenario(
  'PMM-T254 - Ensure Advisors are on by default @fb-instances',
  async ({ settingsAPI }) => {
    const resp = await settingsAPI.getSettings('advisor_enabled');

    assert.ok(resp, `Advisors should be turned on by default from 2.28.0 release but found ${resp}`);
  },
);

Scenario(
  'PMM-T1227 + PMM-T1338 - Verify tooltip "Read more" links on PMM Settings page redirect to working pages '
  + 'Verify that all the metrics from config are displayed on Telemetry tooltip in Settings > Advanced @fb-settings',
  async ({ I, pmmSettingsPage, settingsAPI }) => {
    await settingsAPI.changeSettings({ alerting: true });
    I.wait(10);

    const subPageTooltips = await pmmSettingsPage.getSubpageTooltips();

    for (const subPageTooltipObject of Object.values(subPageTooltips)) {
      I.amOnPage(subPageTooltipObject.subPage);

      for (const tooltipObject of Object.values(subPageTooltipObject.tooltips)) {
        if (tooltipObject.tabButton) {
          I.click(tooltipObject.tabButton);
        }

        await pmmSettingsPage.verifyTooltip(tooltipObject);
      }
    }
  },
).retry(3);

Scenario('PMM-T1401 - Verify Percona Alerting wording in Settings @max-length @settings', async ({
  I,
  pmmSettingsPage,
}) => {
  I.amOnPage(pmmSettingsPage.advancedSettingsUrl);
  await pmmSettingsPage.waitForPmmSettingsPageLoaded();
  pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.perconaAlertingSwitchInput, 'on');
  await pmmSettingsPage.verifyTooltip(pmmSettingsPage.tooltips.advancedSettings.perconaAlerting);
});

Scenario.skip(
  'PMM-T1967 - Verify Update modal respects update settings @fb-settings',
  async ({
    I, homePage, settingsAPI, pmmSettingsPage,
  }) => {
    const adminId = await I.createUser(users.admin.username, users.admin.password);

    await I.setRole(adminId, 'Admin');
    await I.Authorize(users.admin.username, users.admin.password);

    await settingsAPI.changeSettings({ updates: true });
    await I.stopMockingUpgrade();

    I.amOnPage(pmmSettingsPage.advancedSettingsUrl);
    I.waitForVisible(homePage.updatesModal.root, 30);
    I.click(homePage.updatesModal.closeIcon);
    // eslint-disable-next-line no-undef
    await tryTo(() => {
      I.waitForVisible(homePage.productTour.skipButton, 5);
      I.click(homePage.productTour.skipButton);
    });
    I.click(pmmSettingsPage.fields.checkForUpdatesSwitch);
    I.click(pmmSettingsPage.fields.applyButton);
    I.refreshPage();
    I.waitForVisible(pmmSettingsPage.fields.checkForUpdatesSwitch, 30);
    I.dontSeeElement(homePage.updatesModal.root);
    I.click(pmmSettingsPage.fields.checkForUpdatesSwitch);
    I.click(pmmSettingsPage.fields.applyButton);
    I.refreshPage();
    I.seeElement(homePage.updatesModal.root);
  },
);

Scenario(
  'PMM-T2004 - Verify Data Retention field in advanced settings @settings @nightly @gssapi-nightly  ',
  async ({
    I, pmmSettingsPage,
  }) => {
    await pmmSettingsPage.openAdvancedSettings();
    I.assertNotEqual(
      await I.grabAttributeFrom(pmmSettingsPage.fields.advancedButton, 'disabled'),
      null,
      'Apply Changes button should be disabled when there are no changes.',
    );

    I.clearField(pmmSettingsPage.fields.dataRetentionInput);
    I.fillField(pmmSettingsPage.fields.dataRetentionInput, 1);
    I.assertEqual(
      await I.grabAttributeFrom(pmmSettingsPage.fields.advancedButton, 'disabled'),
      null,
      'Apply Changes button should be enabled after value of data retention is changed to 1.',
    );

    I.clearField(pmmSettingsPage.fields.dataRetentionInput);
    I.seeTextEquals(pmmSettingsPage.messages.requiredFieldMessage, pmmSettingsPage.fields.retentionValidation);
    I.assertNotEqual(
      await I.grabAttributeFrom(pmmSettingsPage.fields.advancedButton, 'disabled'),
      null,
      'Apply changes button should be disabled when validation error for empty data retention is present',
    );

    I.clearField(pmmSettingsPage.fields.dataRetentionInput);
    I.fillField(pmmSettingsPage.fields.dataRetentionInput, 3651);
    I.seeTextEquals(pmmSettingsPage.messages.invalidDataDurationMessage, pmmSettingsPage.fields.retentionValidation);
    I.assertNotEqual(
      await I.grabAttributeFrom(pmmSettingsPage.fields.advancedButton, 'disabled'),
      null,
      'Apply changes button should be disabled when validation error for data retention that is outside of the range is present',
    );
  },
);

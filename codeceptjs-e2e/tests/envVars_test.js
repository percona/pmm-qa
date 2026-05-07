Feature('Environment variables');

BeforeSuite(async ({ settingsAPI }) => {
  await settingsAPI.changeSettings({ telemetry: true });
});

Before(async ({ I }) => {
  await I.Authorize();
});

AfterSuite(async ({ settingsAPI }) => {
  await settingsAPI.changeSettings({ telemetry: true });
});

Scenario(
  'PMM-T1265 - Disable telemetry while having DATA_RETENTION set @nightly',
  async ({ I, pmmSettingsPage }) => {
    I.amOnPage(pmmSettingsPage.advancedSettingsUrl);
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.telemetrySwitchSelectorInput, 'on');
    I.click(pmmSettingsPage.fields.telemetrySwitchSelector);
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.telemetrySwitchSelectorInput, 'off');
    I.click(pmmSettingsPage.fields.advancedButton);
    I.refreshPage();
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.telemetrySwitchSelectorInput, 'off');
  },
).retry(1);

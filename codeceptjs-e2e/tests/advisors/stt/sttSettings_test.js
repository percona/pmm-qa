const inputs = new DataTable(['input']);

inputs.add(['0']);
inputs.add(['-1']);

Feature('Security Checks: Settings').retry(2);

Before(async ({
  I, settingsAPI,
}) => {
  await I.Authorize();
  await settingsAPI.setCheckIntervals();
  await settingsAPI.apiEnableSTT();
});

After(async ({ settingsAPI }) => {
  await settingsAPI.apiEnableSTT();
  await settingsAPI.setCheckIntervals();
});

Scenario.skip(
  'PMM-T649 + PMM-T652 - Verify default checks intervals / enabling intervals section @stt @settings @grafana-pr',
  async ({
    I, pmmSettingsPage, settingsAPI,
  }) => {
    await settingsAPI.apiDisableSTT();
    I.amOnPage(pmmSettingsPage.advancedSettingsUrl);
    I.waitForVisible(pmmSettingsPage.fields.rareIntervalInput, 30);

    // Verify Interval fields are disabled and have default values
    I.seeElementsDisabled(pmmSettingsPage.fields.rareIntervalInput);
    I.seeInField(pmmSettingsPage.fields.rareIntervalInput, '78');
    I.seeElementsDisabled(pmmSettingsPage.fields.standartIntervalInput);
    I.seeInField(pmmSettingsPage.fields.standartIntervalInput, '24');
    I.seeElementsDisabled(pmmSettingsPage.fields.frequentIntervalInput);
    I.seeInField(pmmSettingsPage.fields.frequentIntervalInput, '4');

    // Enable STT
    I.click(pmmSettingsPage.fields.sttSwitchSelector);
    pmmSettingsPage.verifySwitch(pmmSettingsPage.fields.sttSwitchSelectorInput, 'on');

    // // Verify Interval fields are enabled
    I.seeElementsEnabled(pmmSettingsPage.fields.rareIntervalInput);
    I.seeElementsEnabled(pmmSettingsPage.fields.standartIntervalInput);
    I.seeElementsEnabled(pmmSettingsPage.fields.frequentIntervalInput);
  },
);

Scenario.skip(
  'PMM-T650 + PMM-T648 - Verify user is able to set 0.1h check Frequency / custom check frequency @stt @settings',
  async ({
    I, pmmSettingsPage,
  }) => {
    const interval = '0.1';

    I.amOnPage(pmmSettingsPage.advancedSettingsUrl);
    I.waitForVisible(pmmSettingsPage.fields.rareIntervalInput, 30);

    // Set 0.1 values for all 3 intervals
    I.clearField(pmmSettingsPage.fields.rareIntervalInput);
    I.fillField(pmmSettingsPage.fields.rareIntervalInput, interval);
    I.clearField(pmmSettingsPage.fields.standartIntervalInput);
    I.fillField(pmmSettingsPage.fields.standartIntervalInput, interval);
    I.clearField(pmmSettingsPage.fields.frequentIntervalInput);
    I.fillField(pmmSettingsPage.fields.frequentIntervalInput, interval);

    // Apply Settings
    I.click(pmmSettingsPage.fields.advancedButton);
    I.verifyPopUpMessage(pmmSettingsPage.messages.successPopUpMessage);
    I.refreshPage();

    // Verify values are correct after page refresh
    I.waitForVisible(pmmSettingsPage.fields.rareIntervalInput, 30);
    I.seeInField(pmmSettingsPage.fields.rareIntervalInput, interval);
    I.seeInField(pmmSettingsPage.fields.standartIntervalInput, interval);
    I.seeInField(pmmSettingsPage.fields.frequentIntervalInput, interval);
  },
);

Scenario.skip(
  'PMM-T651 - Verify Check Intervals validation @stt @settings @grafana-pr',
  async ({
    I, pmmSettingsPage, current,
  }) => {
    const greaterThanZero = 'Value should be greater or equal to 0.1';

    I.amOnPage(pmmSettingsPage.advancedSettingsUrl);
    I.waitForVisible(pmmSettingsPage.fields.rareIntervalInput, 30);

    I.clearField(pmmSettingsPage.fields.rareIntervalInput);
    I.fillField(pmmSettingsPage.fields.rareIntervalInput, current.input);
    I.seeTextEquals(greaterThanZero, pmmSettingsPage.fields.rareIntervalValidation);

    I.clearField(pmmSettingsPage.fields.standartIntervalInput);
    I.fillField(pmmSettingsPage.fields.standartIntervalInput, current.input);
    I.seeTextEquals(greaterThanZero, pmmSettingsPage.fields.standartIntervalValidation);

    I.clearField(pmmSettingsPage.fields.frequentIntervalInput);
    I.fillField(pmmSettingsPage.fields.frequentIntervalInput, current.input);
    I.seeTextEquals(greaterThanZero, pmmSettingsPage.fields.frequentIntervalValidation);

    I.seeElementsDisabled(pmmSettingsPage.fields.advancedButton);
  },
);

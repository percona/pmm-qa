const page = require('./pages/pmmSettingsPage');

// Value should be in range from 1 to 3650 days, so put a value outside of the range
const validationValues = ['2147483648', '-1', '0'];

const dataRetentionTable = new DataTable(['value', 'message']);

for (const i in validationValues) {
  dataRetentionTable.add([validationValues[i], page.messages.invalidDataDurationMessage]);
}

// TODO: (lunaticusgreen) Investigate these testcases, looks like codeceptjs bug
// dataRetentionTable.add([' ', page.messages.requiredFieldMessage]);
// dataRetentionTable.add(['e', page.messages.requiredFieldMessage]);

Feature('PMM Settings Elements').retry(2);

Before(async ({ I, settingsAPI }) => {
  await I.Authorize();
  await settingsAPI.restoreSettingsDefaults();
});

After(async ({ settingsAPI }) => {
  await settingsAPI.changeSettings({ publicAddress: '' });
});

Data(dataRetentionTable).Scenario('PMM-T97 - Verify server diagnostics on PMM Settings Page @settings @grafana-pr', async ({ I, pmmSettingsPage, current }) => {
  I.amOnPage(pmmSettingsPage.advancedSettingsUrl);

  await pmmSettingsPage.waitForPmmSettingsPageLoaded();
  pmmSettingsPage.checkDataRetentionInput(current.value, current.message);
});

Scenario('PMM-T84 - Verify Section Tabs and Metrics Section Elements [critical] @settings @grafana-pr', async ({ I, pmmSettingsPage }) => {
  I.amOnPage(pmmSettingsPage.url);
  await pmmSettingsPage.waitForPmmSettingsPageLoaded();

  I.waitForElement(pmmSettingsPage.fields.metricsResolutionLabel, 30);
  I.see('Metrics resolution, sec', pmmSettingsPage.fields.metricsResolutionLabel);
  I.seeElement(pmmSettingsPage.fields.metricsResolutionRadio);
  I.seeElement(pmmSettingsPage.fields.lowInput);
  I.seeElement(pmmSettingsPage.fields.mediumInput);
  I.seeElement(pmmSettingsPage.fields.highInput);
});

Scenario('PMM-T85 - Verify SSH Key Section Elements @settings @grafana-pr', async ({ I, pmmSettingsPage }) => {
  I.amOnPage(pmmSettingsPage.sshKeyUrl);
  await pmmSettingsPage.waitForPmmSettingsPageLoaded();
  I.see('SSH key', pmmSettingsPage.fields.sshKeyLabel);
  I.seeElement(pmmSettingsPage.fields.sshKeyInput);
});

Scenario('Verify Advanced Section Elements @settings @grafana-pr', async ({ I, pmmSettingsPage }) => {
  I.amOnPage(pmmSettingsPage.advancedSettingsUrl);

  await pmmSettingsPage.waitForPmmSettingsPageLoaded();
  I.see('Data retention', pmmSettingsPage.fields.advancedLabel);
  I.see('Telemetry', pmmSettingsPage.fields.telemetryLabel);
  I.see('Check for updates', pmmSettingsPage.fields.checkForUpdatesLabel);
  I.see('Advisor', pmmSettingsPage.fields.sttLabel);
  I.seeElement(pmmSettingsPage.fields.telemetrySwitchSelectorInput);
  I.seeElement(pmmSettingsPage.fields.telemetryLabel);
  I.seeElement(pmmSettingsPage.fields.checkForUpdatesSwitch);
  I.seeElement(pmmSettingsPage.fields.checkForUpdatesLabel);
  I.seeElement(pmmSettingsPage.fields.sttSwitchSelectorInput);
  I.seeElement(pmmSettingsPage.fields.sttLabel);
});

// Scenario('PMM-T89 - Verify validation for invalid SSH Key @settings @grafana-pr', async ({ I, pmmSettingsPage }) => {
//   const sshKeyForTest = 'ssh-rsa testKey test@key.local';
//   const sectionNameToExpand = pmmSettingsPage.sectionTabsList.ssh;

//   await pmmSettingsPage.waitForPmmSettingsPageLoaded();
//   await pmmSettingsPage.expandSection(sectionNameToExpand, pmmSettingsPage.fields.sshKeyButton);
//   pmmSettingsPage.addSSHKey(sshKeyForTest);
//   I.verifyPopUpMessage(pmmSettingsPage.messages.invalidSSHKeyMessage);
// });

// To be removed from Skip after https://jira.percona.com/browse/PMM-5791
xScenario(
  'PMM-T227 - Open PMM Settings page and verify DATA_RETENTION value is set to 2 days @settings',
  async ({ I, pmmSettingsPage }) => {
    const dataRetention = '2';

    I.amOnPage(pmmSettingsPage.url);
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    I.waitForValue(pmmSettingsPage.fields.dataRetentionCount, dataRetention, 30);
  },
);

Scenario('PMM-T1866 - Verify if public address has an port assigned and following UI/API requests dont error @settings', async ({ I, pmmSettingsPage, adminPage }) => {
  I.amOnPage(pmmSettingsPage.advancedSettingsUrl);

  await pmmSettingsPage.waitForPmmSettingsPageLoaded();
  I.waitForElement(pmmSettingsPage.fields.publicAddressLabel);
  I.see('Public Address', pmmSettingsPage.fields.publicAddressLabel);
  // Set a public IP with port
  adminPage.customClearField(pmmSettingsPage.fields.publicAddressInput);
  I.fillField(pmmSettingsPage.fields.publicAddressInput, '192.168.1.1:8433');
  I.click(pmmSettingsPage.fields.applyButton);
  I.dontSeeElement(pmmSettingsPage.fields.errorPopUpElement);
  await pmmSettingsPage.verifySettingsValue(pmmSettingsPage.fields.publicAddressInput, '192.168.1.1:8433');
  I.wait(5);
  // clearField and customClearField methods doesn't work for this field
  I.usePlaywrightTo('clear field', async ({ page }) => {
    await page.locator(I.useDataQA('retention-number-input')).fill('');
  });
  I.fillField(pmmSettingsPage.fields.dataRetentionInput, '1');
  I.click(pmmSettingsPage.fields.applyButton);
  I.waitForValue(pmmSettingsPage.fields.dataRetentionInput, '1', 10);
  I.dontSeeElement(pmmSettingsPage.fields.errorPopUpElement);
  await pmmSettingsPage.verifySettingsValue(pmmSettingsPage.fields.dataRetentionInput, '1');
}).retry(2);

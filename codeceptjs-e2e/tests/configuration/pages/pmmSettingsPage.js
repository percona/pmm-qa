const assert = require('assert');
const { communicationData, emailDefaults } = require('../../pages/testData');

const {
  I, adminPage, links, perconaPlatformPage, codeceptjsConfig, settingsAPI,
} = inject();

const locateLabel = (selector) => locate(I.useDataQA(selector)).find('span');
const deprecatedFeaturesSection = '//fieldset[legend[contains(text(),"Deprecated features")]]';

module.exports = {
  url: 'graph/settings',
  publicAddress: process.env.VM_IP ? process.env.VM_IP : process.env.SERVER_IP || '127.0.0.1',
  metricsResolutionUrl: 'graph/settings/metrics-resolution',
  advancedSettingsUrl: 'graph/settings/advanced-settings',
  sshKeyUrl: 'graph/settings/ssh-key',
  alertManagerIntegrationUrl: 'graph/settings/am-integration',
  perconaPlatformUrl: perconaPlatformPage,
  communicationSettingsUrl: 'graph/settings/communication',
  prometheusAlertUrl: '/prometheus/rules',
  stateOfAlertsUrl: '/prometheus/alerts',
  diagnosticsText:
    'You can download server logs to make the problem detection simpler. '
    + 'Please include this file if you are submitting a bug report.',
  agreementText:
    'Check here to indicate that you have read and agree to the \nTerms of Service\n and \nPrivacy Policy',
  alertManager: {
    ip: codeceptjsConfig.config.helpers.Playwright.url,
    service: ':9093/#/alerts',
    externalAlertManagerPort: ':9093',
    rule:
      'groups:\n'
      + '  - name: AutoTestAlerts\n'
      + '    rules:\n'
      + '    - alert: InstanceDown\n'
      + '      expr: up == 1\n'
      + '      for: 2s\n'
      + '      labels:\n'
      + '        severity: critical\n'
      + '      annotations:\n'
      + '        summary: "Instance {{ $labels.instance }} down"\n'
      + '        description: "{{ $labels.instance }} of job {{ $labels.job }} has been down for more than 20 seconds."',
    rule2:
      'groups:\n'
      + '  - name: Test2Alerts\n'
      + '    rules:\n'
      + '    - alert: InstanceUp\n'
      + '      expr: up == 1\n'
      + '      for: 1s\n'
      + '      labels:\n'
      + '        severity: critical\n'
      + '      annotations:\n'
      + '        summary: "Instance {{ $labels.instance }} up"\n'
      + '        description: "{{ $labels.instance }} of job {{ $labels.job }} has been down for more than 5 minutes."',
    editRule:
      'groups:\n'
      + '  - name: AutoTestAlertsEdited\n'
      + '    rules:\n'
      + '    - alert: InstanceDown\n'
      + '      expr: up == 0\n'
      + '      for: 60s\n'
      + '      labels:\n'
      + '        severity: critical\n'
      + '      annotations:\n'
      + '        summary: "Instance {{ $labels.instance }} down"\n'
      + '        description: "{{ $labels.instance }} of job {{ $labels.job }} has been down for more than {{ sec }} seconds."',
    ruleName: 'AutoTestAlerts',
    editRuleName: 'AutoTestAlertsEdited',
    ruleName2: 'Test2Alerts',
  },
  messages: {
    successPopUpMessage: 'Settings updated',
    invalidDataDurationMessage: 'Value should be in the range from 1 to 3650',
    invalidDataDurationPopUpMessage: 'data_retention: should be a natural number of days',
    requiredFieldMessage: 'Required field',
    invalidSSHKeyMessage: 'Invalid SSH key.',
    successAlertmanagerMessage: 'Alertmanager settings updated',
    invalidAlertmanagerMissingSchemeMessage:
      'Invalid argument: invalid alert_manager_url: invalid_url - missing protocol scheme.',
    invalidAlertmanagerMissingHostMessage: 'Invalid argument: invalid alert_manager_url: http:// - missing host.',
    invalidAlertmanagerRulesMessage: 'Invalid alerting rules.',
    disabledBackupManagement: 'Backup Management is disabled. You can enable it in PMM Settings.',
  },
  sectionTabsList: {
    metrics: 'Metrics Resolution',
    advanced: 'Advanced Settings',
    ssh: 'SSH Key',
    perconaPlatform: 'Percona Platform',
  },
  sectionButtonText: {
    applyChanges: 'Apply changes', applySSHKey: 'Apply SSH key', applyAlertmanager: 'Apply Alertmanager settings',
  },
  tooltips: {
    diagnostics: {
      iconLocator: locate('$diagnostics-label').find('[class$="-Icon"]').as('Diagnostics tooltip'),
      text: 'You can download server logs to make the problem detection simpler. Please include this file if you are submitting a bug report.',
      link: false,
    },
    metricsResolution: {
      metricsResolutionSec: {
        iconLocator: locate('$metrics-resolution-label').find('[class$="-Icon"]').as('Metrics resolution tooltip'),
        text: 'This setting defines how frequently the data will be collected.',
        link: links.metricsResolutionDocs,
      },
    },
    advancedSettings: {
      dataRetention: {
        iconLocator: locate('$advanced-label').find('[class$="-Icon"]').as('Advanced settings tooltip'),
        text: 'This is the value for how long data will be stored.',
        link: links.dataRetentionDocs,
      },
      telemetry: {
        iconLocator: locate('$advanced-telemetry').find('[class$="-Icon"]').as('Telemetry tooltip'),
        text: '',
        link: links.telemetryDocs,
      },
      checkForUpdates: {
        iconLocator: locate('$advanced-updates').find('[class$="-Icon"]').as('Check for updates tooltip'),
        text: 'Option to check new versions and ability to update PMM from UI.',
        link: links.checkForUpdates,
      },
      stt: {
        iconLocator: locate('$advanced-advisors').find('[class$="-Icon"]').as('Advanced advisors tooltip'),
        text: 'Enable Advisors and get updated checks from Percona.',
        link: links.advisorsDocs,
      },
      publicAddress: {
        iconLocator: locate('$public-address-label').find('[class$="-Icon"]').as('Public Address tooltip'),
        text: 'Public Address to this PMM server.',
        link: false,
      },
      executionIntervals: {
        iconLocator: locate('$check-intervals-label').find('[class$="-Icon"]').as('Execution intervals tooltip'),
        text: 'Interval between check runs',
        link: false,
      },
      backupManagement: {
        iconLocator: locate('$advanced-backup').find('[class$="-Icon"]').as('Backup management tooltip'),
        text: 'Option to enable/disable Backup Management features.',
        link: links.backupManagementDocs,
      },
      perconaAlerting: {
        iconLocator: locate('$advanced-alerting').find('[class$="-Icon"]').as('Alerting tooltip'),
        text: 'Option to enable/disable Percona Alerting features.',
        link: links.integratedAlertingDocs,
      },
      microsoftAzureMonitoring: {
        iconLocator: locate('$advanced-azure-discover').find('[class$="-Icon"]').as('Microsoft Azure monitoring tooltip'),
        text: 'Option to enable/disable Microsoft Azure DB instanced discovery and monitoring',
        link: links.microsoftAzureMonitoringDocs,
      },
    },
    ssh: {
      sshKey: {
        iconLocator: locate('$ssh-key-label').find('[class$="-Icon"]').as('SSH key tooltip'),
        text: 'Public SSH key to let you login into the server using SSH.',
        link: links.sshKeyDocs,
      },
    },
    perconaPlatform: {},
    communication: {
      email: {
        serverAddress: {
          iconLocator: locate('div').after(locate('span').withText('Server Address')).as('Server address tooltip'),
          text: 'The default SMTP smarthost used for sending emails, including port number (e.g. smtp.example.org:587)',
          link: links.communicationDocs,
        },
        hello: {
          iconLocator: locate('div').after(locate('span').withText('Hello')).as('Hello tooltip'),
          text: 'The hostname to identify the SMTP server',
          link: links.communicationDocs,
        },
        from: {
          iconLocator: locate('div').after(locate('span').withText('From')).as('From tooltip'),
          text: 'The sender address',
          link: links.communicationDocs,
        },
        authType: {
          iconLocator: locate('div').after(locate('span').withText('Auth Type')).as('Auth type tooltip'),
          text: 'Authentication type',
          link: links.communicationDocs,
        },
        username: {
          iconLocator: locate('div').after(locate('span').withText('Username')).as('Username tooltip'),
          text: 'SMTP authentication information',
          link: links.communicationDocs,
        },
        password: {
          iconLocator: locate('div').after(locate('span').withText('Password')).as('Password tooltip'),
          text: 'SMTP authentication information',
          link: links.communicationDocs,
        },
      },
      slack: {
        slackUrl: {
          tabButton: locate('li').find('a').withAttr({ 'aria-label': 'Tab Slack' }).as('Slack Tab'),
          iconLocator: locate('div').after(locate('span').withText('URL')).as('Slack URL tooltip'),
          text: 'Slack incoming webhook URL',
          link: links.communicationDocs,
        },
      },
    },
  },
  communicationData,
  emailDefaults,
  communication: {
    email: {
      serverAddress: {
        locator: '$smarthost-text-input',
      },
      hello: {
        locator: '$hello-text-input',
      },
      from: {
        locator: '$from-text-input',
      },
      authType: {
        locator: '$hello-text-input',
      },
      username: {
        locator: '$username-text-input',
      },
      password: {
        locator: '$password-password-input',
      },
      testEmail: {
        locator: '$testEmail-text-input',
      },
    },
    slack: {
      url: {
        locator: '$url-text-input',
        value: 'https://hook',
      },
    },
    communicationSection: locate('$settings-tabs')
      .find('div a')
      .withAttr({ 'aria-label': 'Tab Communication' }),
    emailTab: 'div a[aria-label="Tab Email"]',
    submitEmailButton: '$email-settings-submit-button',
    slackTab: 'div a[aria-label="Tab Slack"]',
    submitSlackButton: '$slack-settings--submit-button',
  },
  fields: {
    advancedLabel: '$advanced-label',
    advancedButton: '$advanced-button',
    addAlertRuleButton: '//span[text()="Apply Alertmanager settings"]/parent::span',
    alertRulesInput: '$alertmanager-rules',
    alertURLInput: '$alertmanager-url',
    alertingRules: locateLabel('form-field-alerting-rules'),
    alertmanagerUrlLabel: '$alertmanager-url-label',
    alertmanagerRulesLabel: '$alertmanager-rules-label',
    alertmanagerButton: '$alertmanager-button',
    amUrlLabel: locateLabel('form-field-am-url'),
    applyButton: 'button[type="submit"]',
    backupManagementSwitch: locate('$advanced-backup').find('label'),
    backupManagementSwitchInput: locate('$advanced-backup').find('input'),
    callHomeSwitch: '//button[@class="toggle-field ant-switch ant-switch-checked"]',
    checkForUpdatesLabel: locate('$advanced-updates').find('span'),
    checkForUpdatesSwitch: locate('$advanced-updates').find('label'),
    dataRetentionInput: '$retention-number-input',
    dataRetentionLabel: locateLabel('form-field-data-retention'),
    retentionValidation: '$retention-field-error-message',
    errorPopUpElement: I.useDataQA('data-testid Alert error'),
    iframe: '//div[@class="panel-content"]//iframe',
    metricsResolutionButton: '$metrics-resolution-button',
    metricsResolutionByText: (text) => locate('label').withText(text),
    metricsResolutionLabel: '$metrics-resolution-label',
    metricsResolutionRadio: '$resolutions-radio-button',
    microsoftAzureMonitoringSwitch: locate('$advanced-azure-discover').find('//div[2]//label'),
    microsoftAzureMonitoringSwitchInput: locate('$advanced-azure-discover').find('//div[2]//input'),
    accessControlInput: locate('[name="accessControl"]'),
    accessControlSwitch: locate('$access-control').find('label'),
    loginButton: '$sign-in-submit-button',
    lowInput: '$lr-number-input',
    mediumInput: '$mr-number-input',
    highInput: '$hr-number-input',
    perconaPlatformLink: '//li[contains(text(), \'Percona Platform\')]',
    privacyPolicy: '//span[contains(text(), "Privacy Policy")]',
    publicAddressLabel: locate('$public-address-label').find('span'),
    publicAddressInput: '$publicAddress-text-input',
    publicAddressButton: '$public-address-button',
    sectionHeader: '//div[@class="ant-collapse-header"]',
    selectedResolution: 'span.ant-slider-mark-text-active',
    signInEmail: '$email-text-input',
    signInPassword: '$email-text-input',
    sshKeyInput: '$ssh-key',
    sshKeyLabel: locateLabel('ssh-key-label'),
    sshKeyButton: '$ssh-key-button',
    sttLabel: locate('$advanced-advisors').find('span'),
    sttSwitchSelectorInput: locate('$advanced-advisors').find('input'),
    sttSwitchSelector: locate('$advanced-advisors').find('label'),
    subSectionHeader: '//following-sibling::div//div[@class="ant-collapse-header"]',
    signUpEmail: '$email-text-input',
    signUpPassword: '$password-password-input',
    signUpAgreementLabel: '$sign-up-agreement-checkbox-label',
    signUpButton: '$sign-up-submit-button',
    singInToSignUpButton: '$sign-in-to-sign-up-button',
    signUpBackToLogin: '$sign-up-to-sign-in-button',
    telemetrySwitchSelectorInput: locate('$advanced-telemetry').find('input'),
    telemetrySwitchSelector: locate('$advanced-telemetry').find('label'),
    perconaAlertingSwitchInput: locate('$advanced-alerting').find('input'),
    perconaAlertingSwitch: locate('$advanced-alerting').find('label'),
    telemetryLabel: locate('$advanced-telemetry').find('span'),
    tooltipText: locate('$info-tooltip').find('./*[self::span or self::div]'),
    tooltipReadMoreLink: locate('$info-tooltip').find('a'),
    tabsSection: '$settings-tabs',
    tabContent: '$settings-tab-content',
    termsOfService: '//span[contains(text(), "Terms of Service")]',
    validationMessage: 'span.error-message',
    rareIntervalInput: '$rareInterval-number-input',
    rareIntervalValidation: '$rareInterval-field-error-message',
    standartIntervalInput: '$standardInterval-number-input',
    standartIntervalValidation: '$standardInterval-field-error-message',
    frequentIntervalInput: '$frequentInterval-number-input',
    frequentIntervalValidation: '$frequentInterval-field-error-message',
    pmmServerNameInput: '$pmmServerName-text-input',
    perconaAccountEmailInput: '$email-text-input',
    perconaAccountPasswordInput: '$password-password-input',
    perconaAlertingUrl: locate('$alertmanager-url-label').find('a'),
  },

  async openAdvancedSettings() {
    I.amOnPage(this.advancedSettingsUrl);
    await this.waitForPmmSettingsPageLoaded();
  },

  async applyChanges() {
    I.click(this.fields.applyButton);
    I.verifyPopUpMessage(this.messages.successPopUpMessage, 30);
  },

  switchAzure() {
    I.waitForVisible(this.fields.microsoftAzureMonitoringSwitch, 30);
    I.click(this.fields.microsoftAzureMonitoringSwitch);
    I.waitForVisible(this.fields.advancedButton, 30);
    I.click(this.fields.advancedButton);
  },

  async waitForPmmSettingsPageLoaded() {
    I.waitForVisible(this.fields.tabContent, 30);
  },

  async expandSection(sectionName, expectedContentLocator) {
    const sectionExpandLocator = locate(`[aria-label="Tab ${sectionName}"]`);

    I.click(sectionExpandLocator);
    I.waitForVisible(expectedContentLocator, 30);
  },

  fillCommunicationFields(fields) {
    const {
      type, serverAddress, hello, from, authType, username, password, url,
    } = fields;

    if (url && type === 'slack') {
      I.click(this.communication.slackTab);

      I.waitForVisible(this.communication.slack.url.locator, 30);
      I.clearField(this.communication.slack.url.locator);
      I.fillField(this.communication.slack.url.locator, url);

      I.click(this.communication.submitSlackButton);
    }

    if (type === 'email') {
      I.waitForVisible(this.communication.email.serverAddress.locator, 30);
      I.clearField(this.communication.email.serverAddress.locator);
      I.fillField(this.communication.email.serverAddress.locator, serverAddress);
      I.clearField(this.communication.email.hello.locator);
      I.fillField(this.communication.email.hello.locator, hello);
      I.clearField(this.communication.email.from.locator);
      I.fillField(this.communication.email.from.locator, from);

      I.click(locate('label').withText(authType));

      if (/Plain|Login|CRAM-MD5/.test(authType)) {
        I.clearField(this.communication.email.username.locator);
        I.fillField(this.communication.email.username.locator, username);
        I.clearField(this.communication.email.password.locator);
        I.fillField(this.communication.email.password.locator, password);
      }

      I.click(this.communication.submitEmailButton);
    }
  },

  async disableIA() {
    const iaEnabled = await I.grabAttributeFrom(this.fields.perconaAlertingSwitchInput, 'checked');

    if (iaEnabled) {
      I.click(this.fields.perconaAlertingSwitch);
    }
  },

  async verifyCommunicationFields(fields) {
    const {
      type, serverAddress, hello, from, authType, username, url,
    } = fields;

    if (type === 'slack') {
      I.click(this.communication.slackTab);
      I.waitForVisible(this.communication.slack.url.locator, 30);
      I.seeInField(this.communication.slack.url.locator, url);
    }

    if (type === 'email') {
      I.waitForVisible(this.communication.email.serverAddress.locator, 30);
      I.seeInField(this.communication.email.serverAddress.locator, serverAddress);
      I.seeInField(this.communication.email.hello.locator, hello);
      I.seeInField(this.communication.email.from.locator, from);

      if (/Plain|Login|CRAM-MD5/.test(authType)) {
        I.seeInField(this.communication.email.username.locator, username);
        I.seeAttributesOnElements(this.communication.email.password.locator, { type: 'password' });
      }
    }
  },

  async selectMetricsResolution(resolution) {
    I.waitForElement(this.fields.metricsResolutionByText(resolution), 30);
    I.click(this.fields.metricsResolutionByText(resolution));
    I.click(this.fields.metricsResolutionButton);
  },

  async verifySelectedResolution(resolution) {
    const selector = '$resolutions-radio-state';

    I.waitForElement(selector, 30);
    const value = await I.grabAttributeFrom(selector, 'value');

    assert.equal(value.includes(resolution.toLowerCase()), true, 'Metric resolution should be selected');
  },

  customClearField(field) {
    I.appendField(field, '');
    I.pressKey(['Control', 'a']);
    I.pressKey('Backspace');
  },

  changeDataRetentionValueTo(days) {
    I.clearField(this.fields.dataRetentionInput);
    I.fillField(this.fields.dataRetentionInput, days);
    I.click(this.fields.advancedButton);
  },

  checkDataRetentionInput(value, message) {
    const messageField = `//div[contains(text(), '${message}')]`;

    I.clearField(this.fields.dataRetentionInput);
    I.fillField(this.fields.dataRetentionInput, value);
    I.seeElement(messageField);
  },

  addSSHKey(keyValue) {
    I.fillField(this.fields.sshKeyInput, keyValue);
    I.click(this.fields.sshKeyButton);
  },

  addPublicAddress(address = this.publicAddress) {
    I.clearField(this.fields.publicAddressInput);
    I.fillField(this.fields.publicAddressInput, address);
    I.click(this.fields.advancedButton);
    I.verifyPopUpMessage(this.messages.successPopUpMessage);
  },

  clearPublicAddress() {
    this.customClearField(this.fields.publicAddressInput);
    I.click(this.fields.advancedButton);
    I.verifyPopUpMessage(this.messages.successPopUpMessage);
  },

  addAlertmanagerRule(url, rule) {
    adminPage.customClearField(this.fields.alertURLInput);
    I.fillField(this.fields.alertURLInput, url);
    adminPage.customClearField(this.fields.alertRulesInput);
    I.fillField(this.fields.alertRulesInput, rule);
    I.waitForElement(this.fields.alertmanagerButton, 30);
    I.click(this.fields.alertmanagerButton);
  },

  openAlertsManagerUi() {
    I.amOnPage(this.prometheusAlertUrl);
  },

  async verifyAlertmanagerRuleAdded(ruleName, checkState = false) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    for (let i = 0; i < 30; i++) {
      let response;

      if (checkState) {
        response = await I.sendGetRequest('prometheus/alerts', headers);
      } else {
        response = await I.sendGetRequest('prometheus/rules', headers);
      }

      if (JSON.stringify(response.data.data).includes(ruleName)) {
        I.refreshPage();
        break;
      }

      I.refreshPage();
      I.wait(5);
    }

    if (checkState) {
      I.amOnPage('prometheus/alerts');
    }

    I.waitForElement(`//pre[contains(text(), '${ruleName}')]`, 30);
    I.seeElement(`//pre[contains(text(), '${ruleName}')]`);
    I.see(ruleName);
  },

  async verifyExternalAlertManager(ruleName) {
    let response;

    for (let i = 0; i < 20; i++) {
      response = await I.sendGetRequest(
        `${this.alertManager.ip}${this.alertManager.externalAlertManagerPort}/api/v2/alerts/groups?silenced=false&inhibited=false&active=true`,
      );
      if (JSON.stringify(response.data).includes(ruleName)) {
        break;
      }

      I.wait(5);
    }

    assert.equal(
      JSON.stringify(response.data).includes(ruleName),
      true,
      'Alert Should be firing at External Alert Manager',
    );
  },

  async verifySettingsValue(field, expectedValue) {
    I.waitForElement(field, 30);
    const fieldActualValue = await I.grabValueFrom(field);

    assert.equal(
      expectedValue,
      fieldActualValue,
      `The Value for Setting ${field} is not the same as expected Value ${expectedValue}, value found was ${fieldActualValue}`,
    );
  },

  async verifyTooltip(tooltipObj) {
    tooltipObj.tooltipText = this.fields.tooltipText;
    tooltipObj.tooltipReadMoreLink = this.fields.tooltipReadMoreLink;
    await adminPage.verifyTooltip(tooltipObj);

    I.moveCursorTo(locate('[aria-label="Breadcrumbs"]'));
  },

  verifySwitch(switchSelector, expectedSwitchState = 'on') {
    switch (expectedSwitchState) {
      case 'on':
        I.seeCheckboxIsChecked(switchSelector);
        break;
      case 'off':
        I.dontSeeCheckboxIsChecked(switchSelector);
        break;
      default:
    }
  },

  async getSubpageTooltips() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    // setting tooltip for telemetry in accordance with API call
    this.tooltips.advancedSettings.telemetry.text = `${'Option to send usage data back to Percona to let us make our product better.\n'
    + '\n'
    + 'We gather and send the following information to Percona:\n'
    + '\n'}${(await settingsAPI.getSettings('telemetry_summaries')).join('\n').replace(/\s{2,}/g, ' ')}`;

    return [
      {
        subPage: this.metricsResolutionUrl,
        tooltips: this.tooltips.metricsResolution,
      },
      {
        subPage: this.advancedSettingsUrl,
        tooltips: this.tooltips.advancedSettings,
      },
      {
        subPage: this.sshKeyUrl,
        tooltips: this.tooltips.ssh,
      },
      {
        subPage: this.perconaPlatformUrl.url,
        tooltips: this.tooltips.perconaPlatform,
      },
    ];
  },
};

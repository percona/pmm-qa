const assert = require('assert');
const { communicationData, emailDefaults } = require('../../pages/testData');

const {
  I, adminPage, links, codeceptjsConfig, settingsAPI,
} = inject();

const locateLabel = (selector) => locate(I.useDataQA(selector)).find('span');

module.exports = {
  url: '/pmm-ui/settings',
  publicAddress: process.env.VM_IP ? process.env.VM_IP : process.env.SERVER_IP || '127.0.0.1',
  metricsResolutionUrl: '/pmm-ui/settings/metrics-resolution',
  advancedSettingsUrl: '/pmm-ui/settings/advanced-settings',
  sshKeyUrl: '/pmm-ui/settings/ssh-key',
  alertManagerIntegrationUrl: 'graph/settings/am-integration',
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
    invalidDataDurationMessage: 'Value should be in the range from 1 to 3650 days',
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
        nativeTextLocator: locate('//h6[normalize-space()="Metrics resolution"]/following-sibling::p[1]').as('Metrics resolution tooltip'),
        nativeLinkLocator: locate('//h6[normalize-space()="Metrics resolution"]/following-sibling::p[1]//a[normalize-space()="Read more"]').as('Metrics resolution tooltip Read more link'),
        text: 'How often PMM collects metrics, in seconds. Lower values provide more detail but use more resources.',
        link: links.metricsResolutionDocs,
      },
    },
    advancedSettings: {
      dataRetention: {
        nativeTextLocator: locate('//h6[normalize-space()="Data retention"]/following-sibling::p[1]').as('Data retention tooltip'),
        nativeLinkLocator: locate('//h6[normalize-space()="Data retention"]/following-sibling::p[1]//a[normalize-space()="Read more"]').as('Data retention tooltip Read more link'),
        text: 'How long PMM keeps collected data. Older data is automatically deleted.',
        link: links.dataRetentionDocs,
      },
      telemetry: {
        nativeTextLocator: locate('//h6[normalize-space()="Telemetry"]/following-sibling::p[1]').as('Telemetry tooltip'),
        nativeLinkLocator: locate('//h6[normalize-space()="Telemetry"]/following-sibling::p[1]//a[normalize-space()="Read more"]').as('Telemetry tooltip Read more link'),
        nativeDialogButton: locate('button').withText('What we collect').as('Telemetry details button'),
        nativeDialogTextLocator: locate('[role="dialog"]').find('[class*="MuiDialogContent-root"]').as('Telemetry tooltip dialog'),
        text: 'Sends anonymous usage statistics to help improve PMM. No personal or database content is collected.',
        link: links.telemetryDocs,
      },
      checkForUpdates: {
        iconLocator: locate('$advanced-updates').find('[class$="-Icon"]').as('Check for updates tooltip'),
        text: 'Option to check new versions and ability to update PMM from UI.',
        link: links.checkForUpdates,
      },
      stt: {
        nativeTextLocator: locate('//h6[normalize-space()="Advisors"]/following-sibling::p[1]').as('Advisors tooltip'),
        nativeLinkLocator: locate('//h6[normalize-space()="Advisors"]/following-sibling::p[1]//a[normalize-space()="Read more"]').as('Advisors tooltip Read more link'),
        text: 'Run automated checks to identify potential database performance and configuration issues.',
        link: links.advisorsDocs,
      },
      publicAddress: {
        nativeTextLocator: locate('//h6[normalize-space()="Public address"]/following-sibling::p[1]').as('Public address tooltip'),
        text: 'The address or hostname PMM Server will be accessible at.',
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
        nativeTextLocator: locate('//p[normalize-space()="Percona Alerting"]').as('Percona Alerting tooltip'),
        text: 'Percona Alerting',
        link: links.integratedAlertingDocs,
      },
      microsoftAzureMonitoring: {
        iconLocator: locate('$advanced-azure-discover').find('[class$="-Icon"]').as('Microsoft Azure monitoring tooltip'),
        text: 'Option to enable/disable Microsoft Azure DB instanced  discovery and monitoring',
        link: links.microsoftAzureMonitoringDocs,
      },
    },
    ssh: {
      sshKey: {
        nativeTextLocator: locate('//h6[normalize-space()="SSH key"]/following-sibling::p[1]').as('SSH key tooltip'),
        nativeLinkLocator: locate('//h6[normalize-space()="SSH key"]/following-sibling::p[1]//a[normalize-space()="Read more"]').as('SSH key tooltip Read more link'),
        text: 'Paste your public SSH key (ssh-rsa format) to enable SSH access to PMM Server.',
        link: links.sshKeyDocs,
      },
    },
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
    advancedLabel: '//div[contains(normalize-space(), "Data retention")]',
    advancedButton: I.useDataQA('advanced-button'),
    addAlertRuleButton: '//span[text()="Apply Alertmanager settings"]/parent::span',
    alertRulesInput: '$alertmanager-rules',
    alertURLInput: '$alertmanager-url',
    alertingRules: locateLabel('form-field-alerting-rules'),
    alertmanagerUrlLabel: '$alertmanager-url-label',
    alertmanagerRulesLabel: '$alertmanager-rules-label',
    alertmanagerButton: '$alertmanager-button',
    amUrlLabel: locateLabel('form-field-am-url'),
    applyButton: 'button[type="submit"]',
    backupManagementSwitch: I.useDataQA('switch-input-backup'),
    backupManagementSwitchInput: locate(I.useDataQA('switch-input-backup')).find('input'),
    callHomeSwitch: '//button[@class="toggle-field ant-switch ant-switch-checked"]',
    checkForUpdatesLabel: I.useDataQA('switch-input-updates-label'),
    checkForUpdatesSwitch: I.useDataQA('switch-input-updates'),
    dataRetentionInput: 'input[name="retention"]',
    dataRetentionLabel: locateLabel('form-field-data-retention'),
    retentionValidation: '$retention-field-error-message',
    errorPopUpElement: I.useDataQA('data-testid Alert error'),
    iframe: '//div[@class="panel-content"]//iframe',
    metricsResolutionButton: I.useDataQA('metrics-resolution-button'),
    metricsResolutionByText: (text) => {
      switch (text.toLowerCase()) {
        case 'rare':
          return I.useDataQA('radio-option-rare');
        case 'standard':
          return I.useDataQA('radio-option-standard');
        case 'frequent':
          return I.useDataQA('radio-option-frequent');
        case 'custom':
          return I.useDataQA('radio-option-custom');
        default:
          return locate('label').withText(text);
      }
    },
    metricsResolutionLabel: '//div[contains(normalize-space(), "Metrics resolution")]',
    metricsResolutionRadio: I.useDataQA('radio-option-standard'),
    microsoftAzureMonitoringSwitch: I.useDataQA('switch-input-azure-discover'),
    microsoftAzureMonitoringSwitchInput: locate(I.useDataQA('switch-input-azure-discover')).find('input'),
    accessControlInput: locate(I.useDataQA('switch-input-access-control')).find('input'),
    accessControlSwitch: I.useDataQA('switch-input-access-control'),
    loginButton: '$sign-in-submit-button',
    lowInput: 'input[name="lr"]',
    mediumInput: 'input[name="mr"]',
    highInput: 'input[name="hr"]',
    privacyPolicy: '//span[contains(text(), "Privacy Policy")]',
    publicAddressLabel: '//div[contains(normalize-space(), "Public address")]',
    publicAddressInput: I.useDataQA('publicAddress-text-input'),
    publicAddressButton: locate('button').withText('Get from browser'),
    sectionHeader: '//div[@class="ant-collapse-header"]',
    selectedResolution: 'span.ant-slider-mark-text-active',
    signInEmail: '$email-text-input',
    signInPassword: '$email-text-input',
    sshKeyInput: I.useDataQA('ssh-key'),
    sshKeyLabel: '//div[contains(normalize-space(), "SSH key")]',
    sshKeyButton: I.useDataQA('ssh-key-button'),
    sttLabel: I.useDataQA('switch-input-stt-label'),
    sttSwitchSelectorInput: locate(I.useDataQA('switch-input-stt')).find('input'),
    sttSwitchSelector: I.useDataQA('switch-input-stt'),
    subSectionHeader: '//following-sibling::div//div[@class="ant-collapse-header"]',
    signUpEmail: '$email-text-input',
    signUpPassword: '$password-password-input',
    signUpAgreementLabel: '$sign-up-agreement-checkbox-label',
    signUpButton: '$sign-up-submit-button',
    singInToSignUpButton: '$sign-in-to-sign-up-button',
    signUpBackToLogin: '$sign-up-to-sign-in-button',
    telemetrySwitchSelectorInput: locate(I.useDataQA('switch-input-telemetry')).find('input'),
    telemetrySwitchSelector: I.useDataQA('switch-input-telemetry'),
    perconaAlertingSwitchInput: locate(I.useDataQA('switch-input-alerting')).find('input'),
    perconaAlertingSwitch: I.useDataQA('switch-input-alerting'),
    telemetryLabel: I.useDataQA('switch-input-telemetry-label'),
    tooltipText: locate('$info-tooltip').find('./*[self::span or self::div]'),
    tooltipReadMoreLink: locate('$info-tooltip').find('a'),
    tabsSection: I.useDataQA('settings-tabs'),
    tabContent: I.useDataQA('settings-tab-content'),
    termsOfService: '//span[contains(text(), "Terms of Service")]',
    validationMessage: 'span.error-message',
    rareIntervalInput: 'input[name="rareInterval"]',
    rareIntervalValidation: '$rareInterval-field-error-message',
    standartIntervalInput: 'input[name="standardInterval"]',
    standartIntervalValidation: '$standardInterval-field-error-message',
    frequentIntervalInput: 'input[name="frequentInterval"]',
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
    let sectionExpandLocator;

    switch (sectionName.toLowerCase()) {
      case 'metrics resolution':
        sectionExpandLocator = I.useDataQA('settings-tab-metrics');
        break;
      case 'advanced settings':
        sectionExpandLocator = I.useDataQA('settings-tab-advanced');
        break;
      case 'ssh key':
        sectionExpandLocator = I.useDataQA('settings-tab-ssh');
        break;
      default:
        sectionExpandLocator = locate(`[aria-label="Tab ${sectionName}"]`);
    }

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
    I.waitForEnabled(this.fields.metricsResolutionButton, 30);
    I.click(this.fields.metricsResolutionButton);
  },

  async verifySelectedResolution(resolution) {
    const selector = this.fields.metricsResolutionByText(resolution);

    I.waitForElement(selector, 30);
    const value = await I.grabAttributeFrom(selector, 'checked');

    assert.notEqual(value, null, 'Metric resolution should be selected');
  },

  customClearField(field) {
    I.appendField(field, '');
    I.pressKey(['Control', 'a']);
    I.pressKey('Backspace');
  },

  async changeDataRetentionValueTo(days) {
    await I.usePlaywrightTo('set data retention value', async ({ page }) => {
      await page.locator(this.fields.dataRetentionInput).fill(String(days));
    });
    I.waitForValue(this.fields.dataRetentionInput, String(days), 10);
    I.waitForEnabled(this.fields.advancedButton, 30);
    I.click(this.fields.advancedButton);
  },

  async checkDataRetentionInput(value, message) {
    I.clearField(this.fields.dataRetentionInput);
    I.fillField(this.fields.dataRetentionInput, value);
    I.pressKey('Tab');
    I.waitForElement(this.fields.dataRetentionInput, 30);
    const actualMessage = await I.executeScript(
      (selector) => document.querySelector(selector).validationMessage,
      this.fields.dataRetentionInput,
    );

    assert.equal(
      actualMessage,
      message,
      `Expected retention validation message to be "${message}" but found "${actualMessage}"`,
    );
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
    if (tooltipObj.nativeTextLocator) {
      I.waitForVisible(tooltipObj.nativeTextLocator, 10);
      I.see(tooltipObj.text, tooltipObj.nativeTextLocator);

      if (tooltipObj.nativeLinkLocator && tooltipObj.link) {
        I.seeAttributesOnElements(tooltipObj.nativeLinkLocator, { href: tooltipObj.link });
        const readMoreLink = await I.grabAttributeFrom(tooltipObj.nativeLinkLocator, 'href');
        const response = await I.sendGetRequest(readMoreLink);

        assert.equal(response.status, 200, 'Read more link should lead to working documentation page. But the GET request response status is not 200');
      }

      if (tooltipObj.nativeDialogButton && tooltipObj.nativeDialogTextLocator) {
        I.click(tooltipObj.nativeDialogButton);
        I.waitForVisible(tooltipObj.nativeDialogTextLocator, 10);
        const actualDialogText = await I.grabTextFrom(tooltipObj.nativeDialogTextLocator);
        const normalizeText = (text) => text.replace(/\s+/g, ' ').trim();

        assert.ok(
          normalizeText(actualDialogText).includes(normalizeText(tooltipObj.dialogText)),
          `Expected dialog text to include "${tooltipObj.dialogText}" but found "${actualDialogText}"`,
        );
        I.pressKey('Escape');
      }

      return;
    }

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
    // setting tooltip for telemetry in accordance with API call
    this.tooltips.advancedSettings.telemetry.dialogText = `${'We gather and send the following information to Percona:'}${(await settingsAPI.getSettings('telemetry_summaries')).join('').replace(/\s{2,}/g, ' ')}`;

    return [
      {
        subPage: this.metricsResolutionUrl,
        tooltips: this.tooltips.metricsResolution,
      },
      {
        subPage: this.advancedSettingsUrl,
        tooltips: {
          dataRetention: this.tooltips.advancedSettings.dataRetention,
          telemetry: this.tooltips.advancedSettings.telemetry,
          stt: this.tooltips.advancedSettings.stt,
        },
      },
      {
        subPage: this.sshKeyUrl,
        tooltips: this.tooltips.ssh,
      },
    ];
  },
};

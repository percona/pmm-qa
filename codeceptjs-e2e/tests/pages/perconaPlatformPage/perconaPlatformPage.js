const { I } = inject();
const perconaPlatformPage_2_26 = require('./perconaPlatformPage_2_26');

module.exports = {
  url: 'graph/settings/percona-platform',
  perconaPlatformPage_2_26,
  elements: {
    techPreviewLabel: locate('h1'),
    connectForm: '$connect-form',
    pmmServerNameFieldLabel: '$pmmServerName-field-label',
    pmmServerNameValidation: '$pmmServerName-field-error-message',
    accessTokenLabel: '$accessToken-field-label',
    accessTokenValidation: '$accessToken-field-error-message',
    connectedWrapper: '$connected-wrapper',
    settingsContent: '$settings-tab-content',
    getAccessTokenLink: locate('a').after('$accessToken-field-container'),
  },
  fields: {
    pmmServerNameField: '$pmmServerName-text-input',
    tokenField: '$accessToken-text-input',
    emailField: '$email-text-input',
    passwordField: '$password-password-input',
    platformConnectButton: '$connect-button',
    platformDisconnectButton: '$disconnect-button',
    accessToken: '$accessToken-text-input',
    serverId: '$pmmServerId-text-input',
    confirmDisconnectButton: locate('button').withAttr({ 'aria-label': 'Confirm Modal Danger Button' }),
  },
  buttons: {
    connect: '$connect-button',
    disconnect: '$disconnect-button',
    confirmDisconnect: locate('button').withAttr({ 'aria-label': 'Confirm Modal Danger Button' }),
  },
  messages: {
    technicalPreview: ' This feature is in Technical Preview stage',
    requiredField: 'Required field',
    invalidEmail: 'Invalid email address',
    connectedSuccess: 'Successfully connected PMM to Percona Platform',
    updateSuccess: 'Settings updated',
    pmmDisconnectedFromPortal: 'Successfully disconnected PMM from Percona Platform',
    disconnectPMM: 'Disconnect PMM from Percona Platform',
    pmmConnected: 'This PMM instance is connected to Percona Platform.',
  },

  async openPerconaPlatform() {
    I.amOnPage(this.url);
    await this.waitForPerconaPlatformPageLoaded();
  },

  async waitForPerconaPlatformPageLoaded() {
    I.waitForVisible(this.elements.settingsContent, 30);
    I.waitInUrl(this.url);
  },

  verifyEmailFieldValidation() {
    I.clearField(this.fields.emailField);

    I.seeTextEquals(this.messages.requiredField, this.elements.emailValidation);

    // Verify validation message for "email" value
    I.fillField(this.fields.emailField, 'email');
    I.seeTextEquals(this.messages.invalidEmail, this.elements.emailValidation);

    // Verify validation message for "email@" value
    I.appendField(this.fields.emailField, '@');
    I.seeTextEquals(this.messages.invalidEmail, this.elements.emailValidation);

    // Verify validation message for "email@domain#.com" value
    I.appendField(this.fields.emailField, 'domain#.com');
    I.seeTextEquals(this.messages.invalidEmail, this.elements.emailValidation);

    // Verify there is no validation error for "email@domain.com" value
    I.clearField(this.fields.emailField);
    I.appendField(this.fields.emailField, 'email@domain.com');
    I.seeTextEquals('', this.elements.emailValidation);
  },

  connectToPortal(token, serverName = 'Test Server', isIPAddressSet = false) {
    I.fillField(this.fields.pmmServerNameField, serverName);
    I.fillField(this.fields.tokenField, token);
    I.click(this.buttons.connect);
    if (isIPAddressSet) {
      I.verifyPopUpMessage(this.messages.updateSuccess);
    }

    I.verifyPopUpMessage(this.messages.connectedSuccess);
    I.refreshPage();
    I.waitForVisible(this.elements.connectedWrapper, 20);
  },

  async disconnectFromPortal(version) {
    await I.waitForVisible(this.fields.platformDisconnectButton);
    await I.click(this.fields.platformDisconnectButton);
    if (version >= 28 || version === undefined) {
      await I.waitForText(this.messages.disconnectPMM);
      await I.click(this.fields.confirmDisconnectButton);
    } else {
      await I.verifyPopUpMessage(this.messages.pmmDisconnectedFromPortal);
    }
  },

  async isPMMConnected() {
    I.waitForVisible(this.elements.connectedWrapper, 20);
    I.waitForVisible(this.buttons.disconnect);
    locate('p').withText(this.messages.pmmConnected);
  },
};

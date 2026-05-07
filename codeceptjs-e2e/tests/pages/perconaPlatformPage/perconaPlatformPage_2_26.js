const { I } = inject();
const assert = require('assert');

module.exports = {
  elements: {
    connectForm: '$connect-form',
    popUpMessage: '//div[@aria-label="Alert error"]',
  },
  fields: {
    emailInput: '$email-text-input',
    passwordInput: '$password-password-input',
    pmmServerName: '$pmmServerName-text-input',
  },
  buttons: {
    connectButton: '$connect-button',
  },
  messages: {
    oldPmmVersionError: 'Authentication failed. Please update the PMM version.',
  },
  async verifyPopUpMessage(message) {
    I.waitForVisible(this.elements.popUpMessage, 30);
    I.see(message, this.elements.popUpMessage);
    const displayedMessage = await I.grabTextFrom(this.elements.popUpMessage);

    assert.equal(message, displayedMessage, 'Expected and Actual message are not the same');
  },
};

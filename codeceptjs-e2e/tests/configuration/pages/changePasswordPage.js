const { I } = inject();

module.exports = {
  url: 'graph/profile/password',

  elements: {
    heading: '[class*=page-header] h1',
    oldPasswordInput: '#current-password',
    newPasswordInput: '#new-password',
    confirmPasswordInput: '#confirm-new-password',
    changePasswordButton: 'button[type="submit"]',
  },
  messages: {
    successPopUp: 'User password changed',
  },

  async open() {
    I.amOnPage(this.url);
    I.waitForVisible(this.elements.heading, 30);
    I.waitForVisible(this.elements.changePasswordButton, 30);
  },

  fillChangePasswordForm(currentPassword, newPassword) {
    I.waitForVisible(this.elements.oldPasswordInput);
    I.fillField(this.elements.oldPasswordInput, currentPassword);
    I.seeElement(this.elements.newPasswordInput);
    I.fillField(this.elements.newPasswordInput, newPassword);
    I.seeElement(this.elements.confirmPasswordInput);
    I.fillField(this.elements.confirmPasswordInput, newPassword);
  },

  applyChanges() {
    I.click(this.elements.changePasswordButton);
    I.verifyPopUpMessage(this.messages.successPopUp);
  },
};

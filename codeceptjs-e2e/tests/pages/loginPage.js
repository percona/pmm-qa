const { I, homePage } = inject();

module.exports = {
  url: 'graph/login',
  fields: {
    loginInput: I.useDataQA('data-testid Username input field'),
    passwordInput: I.useDataQA('data-testid Password input field'),
    loginButton: I.useDataQA('data-testid Login button'),
    skipButton: I.useDataQA('data-testid Skip change password button'),
  },
  messages: {
    loginSuccess: 'Logged in',
  },

  /**
   * User action to authenticate to PMM Server.
   * **should be used inside async with `await`**
   *
   * @param   {string} username   user name to log in; with default 'admin'
   * @param   {string} password   a password for specified user; with default for 'admin' user
   */
  async login(username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin') {
    I.waitForVisible(this.fields.loginInput, 20);
    I.seeElement(this.fields.loginInput);
    I.fillField(this.fields.loginInput, username);
    I.seeElement(this.fields.passwordInput);
    I.fillField(this.fields.passwordInput, password);
    I.click(this.fields.loginButton);
    await I.waitForFunction(() => {
      const url = window.location.href;

      return url.includes('help') || url.includes('home-dashboard');
    }, 60);
  },

};

const { locateOption } = require('../../helper/locatorHelper');

const { I } = inject();

class UsersPage {
  constructor() {
    this.url = 'graph/admin/users';
    this.elements = {
      header: locate('[class*="-title-info-container"]'),
      option: (optionName) => locateOption(optionName),
    };
    this.buttons = {
      allUsers: locate('[data-testid="data-testid all-users-tab"]'),
    };
    this.fields = {
      selectAccessRole: (user) => locate(`(//td[text()="${user}"]//ancestor::tr//div)[1]`),
    };
    this.messages = {
      roleAssigned: (user) => `User “${user}” updated New access roles added to the user.`,
    };
  }

  assignRole(user, role) {
    I.waitForVisible(this.fields.selectAccessRole(user));
    I.click(this.fields.selectAccessRole(user));
    I.click(this.elements.option(role));
    I.usePlaywrightTo('Click to hide options', async ({ page }) => (await page.locator(this.buttons.allUsers.value)).click({ force: true }));
    I.verifyPopUpMessage(this.messages.roleAssigned(user));
  }
}

module.exports = new UsersPage();
module.exports.SericeAccountsPage = UsersPage;

const { I, inventoryAPI } = inject();

class ServiceAccountsPage {
  constructor() {
    this.url = 'graph/org/serviceaccounts';
    this.addAccountButton = locate('//a[@href="org/serviceaccounts/create"]');
    this.nameInput = locate('//input[@name="name"]');
    this.roleSelect = locate('//div[contains(@class, "grafana-select-value-container")]');
    this.roleSelectValue = (role) => locate(`//*[text()="${role}"]`);
    this.createButton = locate('//button[@type="submit"]');
    this.accountEditedMessage = 'Service account updated';
    this.addServiceAccountToken = locate('//span[text()="Add service account token"]');
    this.tokenName = locate('//input[@name="tokenName"]');
    this.generateTokenButton = locate('//span[text()="Generate token"]');
    this.tokenValue = locate('//input[@name="tokenValue"]');
    this.disableServiceAccountButton = (username) => locate(`//a[text()="${username}"]//ancestor::tr//span[text()="Disable"]`);
    this.enableServiceAccountButton = (username) => locate(`//a[text()="${username}"]//ancestor::tr//span[text()="Enable"]`);
    this.confirmDisableButton = I.useDataQA('data-testid Confirm Modal Danger Button');
  }

  createServiceAccount(username, role) {
    I.waitForVisible(this.addAccountButton);
    I.click(this.addAccountButton);
    I.waitForVisible(this.nameInput);
    I.fillField(this.nameInput, username);
    I.click(this.roleSelect);
    I.click(this.roleSelectValue(role));
    I.click(this.createButton);
    I.verifyPopUpMessage(this.accountEditedMessage);
  }

  async createServiceAccountToken(tokenName) {
    I.click(this.addServiceAccountToken);
    I.fillField(this.tokenName, tokenName);
    I.click(this.generateTokenButton);
    I.waitForVisible(this.tokenValue);

    return await I.grabValueFrom(this.tokenValue);
  }

  disableServiceAccount(username) {
    I.waitForVisible(this.disableServiceAccountButton(username));
    I.click(this.disableServiceAccountButton(username));
    I.click(this.confirmDisableButton);
    I.verifyPopUpMessage(this.accountEditedMessage);
  }

  enableServiceAccount(username) {
    I.waitForVisible(this.enableServiceAccountButton(username));
    I.click(this.enableServiceAccountButton(username));
    I.verifyPopUpMessage(this.accountEditedMessage);
  }

  async createServiceAccountApi(username, role) {
    const response = await I.sendPostRequest('graph/api/serviceaccounts/', { name: username, role }, { Authorization: `Basic ${await I.getAuth()}` });

    return response.data;
  }

  async createServiceAccountTokenApi(accountId, tokenName) {
    const response = await I.sendPostRequest(`graph/api/serviceaccounts/${accountId}/tokens`, { name: tokenName }, { Authorization: `Basic ${await I.getAuth()}` });

    return response.data;
  }
}

module.exports = new ServiceAccountsPage();
module.exports.SericeAccountsPage = ServiceAccountsPage;

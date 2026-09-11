import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';

export default class ServiceAccountsPage extends BasePage {
  url = 'graph/org/serviceaccounts';
  accountEditedMessage = 'Service account updated';
  builders = {
    accountRow: (username: string) =>
      this.grafanaIframe()
        .getByRole('row')
        .filter({
          has: this.grafanaIframe().getByRole('link', {
            exact: true,
            name: `Edit service account's ${username} details`,
          }),
        }),
    disableAccountButton: (username: string) =>
      this.builders.accountRow(username).getByRole('button', { name: 'Disable' }),
    enableAccountButton: (username: string) =>
      this.builders.accountRow(username).getByRole('button', { name: 'Enable' }),
    roleOption: (role: string) => this.grafanaIframe().getByRole('option', { exact: true, name: role }),
  };
  buttons = {
    addAccount: this.grafanaIframe().getByRole('link', { name: 'Add service account' }),
    addServiceAccountToken: this.grafanaIframe().getByRole('button', {
      name: 'Add service account token',
    }),
    closeAlert: this.grafanaIframe().getByLabel('Close alert'),
    confirmDisable: this.grafanaIframe().getByTestId('data-testid Confirm Modal Danger Button'),
    create: this.grafanaIframe().getByRole('button', { name: 'Create' }),
    generateToken: this.grafanaIframe().getByRole('button', { name: 'Generate token' }),
    roleSelect: this.grafanaIframe().getByRole('combobox', { name: 'Role' }),
  };
  elements = {};
  inputs = {
    name: this.grafanaIframe().getByRole('textbox', { name: 'Display name' }),
    tokenName: this.grafanaIframe().locator('input[name="tokenName"]'),
    tokenValue: this.grafanaIframe().locator('input[name="tokenValue"]'),
  };
  messages = {
    successPopUp: this.grafanaIframe().getByTestId('data-testid Alert success'),
  };

  closeSuccessPopUp = async () => {
    if ((await this.buttons.closeAlert.count()) > 0) {
      await this.buttons.closeAlert.first().click();
    }
  };

  createServiceAccount = async (username: string, role: string) => {
    await this.buttons.addAccount.click({ timeout: Timeouts.ONE_MINUTE });
    await this.inputs.name.fill(username, { timeout: Timeouts.ONE_MINUTE });
    await this.buttons.roleSelect.click();
    await this.builders.roleOption(role).click();
    await this.buttons.create.click();
  };

  createServiceAccountToken = async (tokenName: string): Promise<string> => {
    await this.buttons.addServiceAccountToken.click();
    await this.inputs.tokenName.fill(tokenName);
    await this.buttons.generateToken.click();
    await this.inputs.tokenValue.waitFor({ state: 'visible', timeout: Timeouts.ONE_MINUTE });

    return this.inputs.tokenValue.inputValue();
  };

  disableServiceAccount = async (username: string) => {
    await this.builders.disableAccountButton(username).click({ timeout: Timeouts.ONE_MINUTE });
    await this.buttons.confirmDisable.click();
  };

  enableServiceAccount = async (username: string) => {
    await this.builders.enableAccountButton(username).click({ timeout: Timeouts.ONE_MINUTE });
  };
}

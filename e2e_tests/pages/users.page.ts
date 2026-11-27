import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';

export default class UsersPage extends BasePage {
  url = 'graph/admin/users';
  builders = {
    accessRoles: (username: string) =>
      this.grafanaIframe()
        .getByRole('row')
        .filter({ has: this.page.getByRole('cell', { exact: true, name: username }) })
        .getByRole('combobox', { name: 'Access Roles' }),
    option: (name: string) => this.grafanaIframe().getByRole('option', { exact: true, name }),
    // Login, email and name can all hold the username, so match the row.
    userRow: (username: string) =>
      this.grafanaIframe()
        .getByRole('row')
        .filter({ has: this.page.getByRole('cell', { exact: true, name: username }) }),
  };
  buttons = {
    allUsers: this.grafanaIframe().getByTestId('data-testid all-users-tab'),
  };
  elements = {};
  inputs = {};
  messages = {};

  assignRole = async (username: string, roleTitle: string) => {
    await this.builders.accessRoles(username).click({ timeout: Timeouts.ONE_MINUTE });
    await this.builders.option(roleTitle).click();
    await this.buttons.allUsers.click({ force: true });
  };
}

import BasePage from '@pages/base.page';

export default class ChangePasswordPage extends BasePage {
  url = 'graph/profile/password';
  builders = {};
  buttons = {
    changePassword: this.grafanaIframe().getByRole('button', { name: 'Change Password' }),
  };
  elements = {};
  inputs = {
    confirmPassword: this.grafanaIframe().getByLabel('Confirm password', { exact: true }),
    newPassword: this.grafanaIframe().getByLabel('New password', { exact: true }),
    oldPassword: this.grafanaIframe().getByLabel('Old password', { exact: true }),
  };
  messages = {
    successPopUp: this.grafanaIframe().getByRole('status').or(this.grafanaIframe().getByRole('alert')),
  };
}

import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';
import { AccessRoleForm } from '@interfaces/accessControl';

export default class AccessRolesPage extends BasePage {
  url = 'graph/roles';
  builders = {
    option: (label: string) =>
      this.grafanaIframe()
        .getByRole('option')
        .filter({ has: this.page.getByText(label, { exact: true }) }),
    roleOptions: (title: string) =>
      this.grafanaIframe()
        .getByRole('row')
        .filter({ has: this.page.getByRole('cell', { exact: true, name: title }) })
        .getByRole('button', { name: 'Open role options' }),
  };
  buttons = {
    confirmDelete: this.grafanaIframe().getByRole('button', { name: 'Confirm and delete role' }),
    create: this.grafanaIframe().getByTestId('access-roles-create-role'),
    delete: this.grafanaIframe().getByRole('menuitem', { exact: true, name: 'Delete' }),
    edit: this.grafanaIframe().getByRole('menuitem', { exact: true, name: 'Edit' }),
    submit: this.grafanaIframe().getByTestId('add-edit-role-submit'),
  };
  elements = {};
  inputs = {
    description: this.grafanaIframe().getByTestId('role-description-field'),
    label: this.grafanaIframe().getByTestId('data-testid Select label-input'),
    name: this.grafanaIframe().getByTestId('role-name-field'),
    operator: this.grafanaIframe().getByTestId('data-testid Select match operator-input'),
    value: this.grafanaIframe().getByTestId('data-testid Select value-input'),
  };
  messages = {};

  createAccessRole = async (role: AccessRoleForm) => {
    await this.buttons.create.click({ timeout: Timeouts.ONE_MINUTE });
    await this.submitRoleForm(role);
  };

  deleteAccessRole = async (title: string) => {
    await this.builders.roleOptions(title).click({ timeout: Timeouts.ONE_MINUTE });
    await this.buttons.delete.click();
    await this.buttons.confirmDelete.click();
  };

  editAccessRole = async (role: AccessRoleForm) => {
    await this.builders.roleOptions(role.title).click({ timeout: Timeouts.ONE_MINUTE });
    await this.buttons.edit.click();
    await this.submitRoleForm(role);
  };

  submitRoleForm = async ({ description, label, operator, title, value }: AccessRoleForm) => {
    await this.inputs.name.fill(title, { timeout: Timeouts.ONE_MINUTE });
    await this.inputs.description.fill(description);
    await this.inputs.label.fill(label);
    await this.builders.option(label).click();
    await this.inputs.operator.fill(operator);
    await this.builders.option(operator).click();
    await this.inputs.value.fill(value);
    await this.builders.option(value).click({ timeout: Timeouts.ONE_MINUTE });
    await this.buttons.submit.click();
  };
}

const { locateOption } = require('../../helper/locatorHelper');

const { I } = inject();

class AccessRolesPage {
  constructor() {
    this.url = 'graph/roles';
    this.elements = {
      option: (optionName) => locateOption(optionName),
    };
    this.buttons = {
      create: locate('$access-roles-create-role'),
      submit: locate('$add-edit-role-submit'),
      openRoleOptions: (roleName) => locate(`//span[text()="${roleName}"]//ancestor::tr//button`),
      editRole: locate('//span[text()="Edit"]//ancestor::button'),
      deleteRole: locate('//span[text()="Delete"]//ancestor::button'),
      confirmDelete: locate('span').withText('Confirm and delete role').inside('button[type="submit"]'),
    };
    this.fields = {
      roleName: locate('[data-testid="role-name-field"]'),
      roleDescription: locate('[data-testid="role-description-field"]'),
      selectLabel: locate('[data-testid="data-testid Select label"]').find('input'),
      selectOperator: locate('[data-testid="data-testid Select match operator"]').find('input'),
      selectValue: locate('[data-testid="data-testid Select value"]').find('input'),
      selectValueText: locate('[data-testid="data-testid Select value"]'),
    };
    this.messages = {
      roleCreated: (roleName) => `Role “${roleName}” created Your new role is now ready to be assigned to any user.`,
      roleDeleted: (roleName) => `Role “${roleName}“ deleted The role no longer exists`,
      roleEdited: (roleName) => `Role “${roleName}“ changed Your role is now live and effective with the most recent changes.`,
    };
  }

  createAccessRole(role) {
    I.waitForVisible(this.buttons.create);
    I.click(this.buttons.create);
    I.waitForVisible(this.fields.roleName);
    I.fillField(this.fields.roleName, role.name);

    if (role.description) {
      I.fillField(this.fields.roleDescription, role.description);
    }

    I.fillField(this.fields.selectLabel, role.label);
    I.click(this.elements.option(role.label));

    I.fillField(this.fields.selectOperator, role.operator);
    I.click(this.elements.option(role.operator));

    I.fillField(this.fields.selectValue, role.value);
    I.waitForVisible(this.elements.option(role.value));
    I.click(this.elements.option(role.value));

    I.click(this.buttons.submit);

    I.verifyPopUpMessage(this.messages.roleCreated(role.name));
  }

  async editAccessRole(role) {
    I.waitForVisible(this.buttons.openRoleOptions(role.name));
    I.click(this.buttons.openRoleOptions(role.name));
    I.click(this.buttons.editRole);
    I.waitForVisible(this.fields.roleName);
    I.fillField(this.fields.roleName, role.name);

    if (role.description) {
      I.fillField(this.fields.roleDescription, role.description);
    }

    I.fillField(this.fields.selectLabel, role.label);
    I.click(this.elements.option(role.label));

    I.fillField(this.fields.selectOperator, role.operator);
    I.click(this.elements.option(role.operator));

    const currentValue = await I.grabTextFrom(this.fields.selectValueText);

    // dropdown option is not shown if it's the same as the current one
    if (currentValue !== role.value) {
      I.fillField(this.fields.selectValue, role.value);
      I.waitForVisible(this.elements.option(role.value));
      I.click(this.elements.option(role.value));
    }

    I.click(this.buttons.submit);

    I.verifyPopUpMessage(this.messages.roleEdited(role.name));
  }

  deleteAccessRole(roleName) {
    I.waitForVisible(this.buttons.openRoleOptions(roleName));
    I.click(this.buttons.openRoleOptions(roleName));
    I.click(this.buttons.deleteRole);
    I.click(this.buttons.confirmDelete);
    I.verifyPopUpMessage(this.messages.roleDeleted(roleName));
  }
}

module.exports = new AccessRolesPage();
module.exports.SericeAccountsPage = AccessRolesPage;

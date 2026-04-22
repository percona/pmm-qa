const { I, settingsAPI } = inject();

class RolesApi {
  constructor() {
    this.deleteUrl = '/v1/accesscontrol/roles';
    this.createUrl = '/v1/accesscontrol/roles';
    this.listUrl = '/v1/accesscontrol/roles';
    this.assignUrl = '/v1/accesscontrol/roles:assign';
  }

  async assignRole(role_ids, user_id) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = { role_ids, user_id };

    await I.sendPostRequest(this.assignUrl, body, headers);
  }

  async deleteRole(role_id, replacement_role_id = 1) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = { replacement_role_id, role_id };

    await I.sendDeleteRequest(`${this.deleteUrl}/${role_id}`, body, headers);
  }

  async deleteRoles(roleIds, replacement_role_id = 1) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    for await (const role_id of roleIds) {
      await this.deleteRole(role_id, replacement_role_id);
    }
  }

  async createRole(role) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = {
      description: role.description,
      filter: `{${role.label}${role.operator}"${role.value}"}`,
      title: role.name,
    };

    return (await I.sendPostRequest(this.createUrl, body, headers)).data.role_id;
  }

  async listRoles() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    return (await I.sendGetRequest(this.listUrl, headers)).data.roles;
  }

  async getNonDefaultRoleIds() {
    const roleIds = [];
    const defaultRoleId = await settingsAPI.getSettings('default_role_id');
    const roles = await this.listRoles();

    roles.forEach((role) => {
      if (role.role_id !== defaultRoleId) {
        roleIds.push(role.role_id);
      }
    });

    return roleIds;
  }
}

module.exports = new RolesApi();
module.exports.ProductTourDialog = RolesApi;

import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';
import { AccessRole, AccessRoleDetails, AccessRoleResponse } from '@interfaces/accessControl';

export default class AccessControlApi {
  constructor(private request: APIRequestContext) {}

  assignRole = async (userId: number, roleId: number | string) => {
    const response = await this.request.post(apiEndpoints.accessControl.rolesAssign, {
      data: {
        role_ids: [roleId],
        user_id: userId,
      },
      headers: GrafanaHelper.getAuthHeader(),
    });

    if (response.ok()) return;

    const body = await response.text();

    if (/already|exist|assigned/i.test(body)) return;

    throw new Error(`Assign role failed with status ${response.status()} and body: ${body}`);
  };

  ensureRole = async (role: AccessRole): Promise<AccessRoleDetails> => {
    const roles = await this.getRoles();
    const existingRole = roles.find((existingRole) => existingRole.title === role.title);

    if (existingRole) {
      expect(existingRole.filter).toEqual(role.filter);

      return existingRole;
    }

    const response = await this.request.post(apiEndpoints.accessControl.roles, {
      data: {
        description: `${role.title} access role`,
        filter: role.filter,
        title: role.title,
      },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    const updatedRoles = await this.getRoles();
    const createdRole = updatedRoles.find((updatedRole) => updatedRole.title === role.title);

    if (!createdRole) {
      throw new Error(`Role ${role.title} was not found after creation`);
    }

    return createdRole;
  };

  getRoles = async () => {
    const response = await this.request.get(apiEndpoints.accessControl.roles, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    return ((await response.json()) as AccessRoleResponse).roles;
  };
}

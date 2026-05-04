Feature('PMM Server Role Based Access Control (RBAC)').retry(2);

const newPsUser = { username: 'rbac_ps_test_user', password: 'Test1234!' };
const newPgUser = { username: 'rbac_pg_test_user', password: 'Test1234!' };
let rbacPsUserId;
let rbacPgUserId;
let psRole = {
  name: `psRole_${Date.now()}`,
  description: 'Test PS Role',
  label: 'service_type',
  operator: '=',
  value: 'mysql',
};
const pgRole = {
  name: `pgRole_${Date.now()}`,
  description: 'Test PG Role',
  label: 'service_type',
  operator: '=',
  value: 'postgresql',
};

Before(async ({ I, settingsAPI }) => {
  rbacPsUserId = await I.createUser(newPsUser.username, newPsUser.password);
  rbacPgUserId = await I.createUser(newPgUser.username, newPgUser.password);
  await I.Authorize();
  await settingsAPI.changeSettings({ rbac: true });
});

After(async ({ I, rolesApi }) => {
  const roleIds = await rolesApi.getNonDefaultRoleIds();

  await rolesApi.deleteRoles(roleIds, 1);
  await I.deleteUser(rbacPsUserId);
  await I.deleteUser(rbacPgUserId);
});

Scenario('PMM-T1580 - Verify creating Access Role @rbac', async ({ I, accessRolesPage }) => {
  I.amOnPage(accessRolesPage.url);
  accessRolesPage.createAccessRole(psRole);
});

Scenario('PMM-T1584 - Verify assigning Access role to user @rbac', async ({ I, usersPage, rolesApi }) => {
  await rolesApi.createRole(psRole);

  I.amOnPage(usersPage.url);
  usersPage.assignRole(newPsUser.username, psRole.name);
});

Scenario(
  'PMM-T1899 - Access Role based on Labels and Check Filtering of Metrics on Dashboard @rbac',
  async ({
    I, dashboardPage, accessRolesPage, rolesApi,
  }) => {
    await rolesApi.createRole(psRole);
    await rolesApi.createRole(pgRole);

    const roles = await rolesApi.listRoles();
    const psRoleId = roles.find((role) => role.title === psRole.name).role_id;
    const pgRoleId = roles.find((role) => role.title === pgRole.name).role_id;

    await rolesApi.assignRole([psRoleId], rbacPsUserId);
    await rolesApi.assignRole([pgRoleId], rbacPgUserId);

    await I.unAuthorize();

    await I.Authorize(newPsUser.username, newPsUser.password);

    I.amOnPage(dashboardPage.mySQLInstanceOverview.clearUrl);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.verifyThereAreNoGraphsWithoutData(4);

    I.amOnPage(dashboardPage.postgresqlInstanceOverviewDashboard.url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.verifyThatAllGraphsNoData(2);

    await I.unAuthorize();

    await I.Authorize(newPgUser.username, newPgUser.password);

    I.amOnPage(dashboardPage.mySQLInstanceOverview.clearUrl);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.verifyThatAllGraphsNoData(3);

    I.amOnPage(dashboardPage.postgresqlInstanceOverviewDashboard.url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.verifyThereAreNoGraphsWithoutData(2);

    await I.unAuthorize();

    psRole = {
      ...psRole, label: 'cluster', operator: '!=', value: 'dev',
    };

    await I.Authorize();

    I.amOnPage(accessRolesPage.url);
    await accessRolesPage.editAccessRole(psRole);

    await I.unAuthorize();

    await I.Authorize(newPsUser.username, newPsUser.password);

    I.amOnPage(I.buildUrlWithParams(dashboardPage.mySQLInstanceOverview.clearUrl, {
      environment: psRole.value,
      from: 'now-1m',
    }));
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.verifyThatAllGraphsNoData(2);
  },
);

Scenario('PMM-T1585 - Verify deleting Access role @rbac', async ({ I, accessRolesPage, rolesApi }) => {
  await rolesApi.createRole(psRole);
  await rolesApi.createRole(pgRole);

  I.amOnPage(accessRolesPage.url);
  accessRolesPage.deleteAccessRole(pgRole.name);
  accessRolesPage.deleteAccessRole(psRole.name);
});

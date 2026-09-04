Feature('PMM Server Role Based Access Control (RBAC)');

const newPsUser = { username: 'rbac_ps_test_user', password: 'Test1234!' };
const newPgUser = { username: 'rbac_pg_test_user', password: 'Test1234!' };
const dashboardTimeRange = { from: 'now-5m' };
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
    I, dashboardPage, accessRolesPage, rolesApi, grafanaAPI,
  }) => {
    // The MySQL and PostgreSQL dashboards below carry panels that pin `interval: 5m`,
    // so on a now-5m range they are only evaluated at 300s wall-clock boundaries. A
    // service whose first sample landed after the newest boundary renders "No data"
    // on them until the next one passes, no matter how many samples arrived since.
    // Wait the metrics out before asserting on what the panels render.
    await grafanaAPI.waitForMetricAtDashboardStep('min(mysql_global_status_uptime)');
    await grafanaAPI.waitForMetricAtDashboardStep('sum(mysql_global_variables_innodb_buffer_pool_size)');
    await grafanaAPI.waitForMetricAtDashboardStep('avg by (node_name) (node_memory_MemTotal_bytes)');

    await rolesApi.createRole(psRole);
    await rolesApi.createRole(pgRole);

    const roles = await rolesApi.listRoles();
    const psRoleId = roles.find((role) => role.title === psRole.name).role_id;
    const pgRoleId = roles.find((role) => role.title === pgRole.name).role_id;

    await rolesApi.assignRole([psRoleId], rbacPsUserId);
    await rolesApi.assignRole([pgRoleId], rbacPgUserId);

    await I.unAuthorize();

    await I.Authorize(newPsUser.username, newPsUser.password);

    I.amOnPage(I.buildUrlWithParams(dashboardPage.mySQLInstanceOverview.clearUrl, dashboardTimeRange));
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.waitForGraphsToHaveData(5);

    I.amOnPage(I.buildUrlWithParams(dashboardPage.postgresqlInstanceSummaryDashboard.url, dashboardTimeRange));
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.verifyThatAllGraphsNoData(5);

    await I.unAuthorize();

    await I.Authorize(newPgUser.username, newPgUser.password);

    I.amOnPage(I.buildUrlWithParams(dashboardPage.mySQLInstanceOverview.clearUrl, dashboardTimeRange));
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.verifyThatAllGraphsNoData(2);

    I.amOnPage(I.buildUrlWithParams(dashboardPage.postgresqlInstanceSummaryDashboard.url, dashboardTimeRange));
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.waitForGraphsToHaveData(3);

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
    await dashboardPage.verifyThatAllGraphsNoData(10);
  },
).retry(1);

Scenario('PMM-T1585 - Verify deleting Access role @rbac', async ({ I, accessRolesPage, rolesApi }) => {
  await rolesApi.createRole(psRole);
  await rolesApi.createRole(pgRole);

  I.amOnPage(accessRolesPage.url);
  accessRolesPage.deleteAccessRole(pgRole.name);
  accessRolesPage.deleteAccessRole(psRole.name);
});

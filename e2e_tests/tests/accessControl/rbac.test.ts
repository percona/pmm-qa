import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe.configure({ mode: 'default' });

const password = 'Test1234!pass';
const users = { pg: 'rbac_pg_test_user', ps: 'rbac_ps_test_user' } as const;
const userIds = { pg: 0, ps: 0 };
let accessControlFound = false;
const psRole = {
  description: 'Test PS Role',
  filter: '{service_type="mysql"}',
  title: `psRole_${Date.now()}`,
};
const pgRole = { filter: '{service_type="postgresql"}', title: `pgRole_${Date.now()}` };

pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
  accessControlFound = (await api.settingsApi.getSettings()).settings.enable_access_control;
  userIds.ps = await grafanaHelper.createUser(users.ps, password);
  userIds.pg = await grafanaHelper.createUser(users.pg, password);
  await grafanaHelper.authorize();
  await api.settingsApi.enableAccessControl();
});

pmmTest.afterEach(async ({ api, grafanaHelper, request }) => {
  const roles = (await api.accessControlApi.getRoles()).filter(({ title }) =>
    [psRole.title, pgRole.title].includes(title),
  );

  for (const { role_id } of roles) {
    const response = await request.delete(`${apiEndpoints.accessControl.roles}/${role_id}`, {
      data: { replacement_role_id: 1, role_id },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), `Delete role ${role_id}`).toEqual(200);
  }

  for (const userId of Object.values(userIds)) {
    expect((await grafanaHelper.deleteUser(userId)).status(), `Delete user ${userId}`).toEqual(200);
  }

  await api.settingsApi.updateSettings({ enable_access_control: accessControlFound });
});

pmmTest('PMM-T1580 - Verify creating Access Role @rbac', async ({ accessRolesPage, page }) => {
  await page.goto(accessRolesPage.url);
  await accessRolesPage.createAccessRole({
    description: psRole.description,
    label: 'service_type',
    operator: '=',
    title: psRole.title,
    value: 'mysql',
  });
  await expect(accessRolesPage.snackBar.alert(`Role “${psRole.title}” created`)).toContainText(
    'Your new role is now ready to be assigned to any user.',
    { timeout: Timeouts.THIRTY_SECONDS },
  );
});

pmmTest('PMM-T1584 - Verify assigning Access role to user @rbac', async ({ api, page, usersPage }) => {
  await api.accessControlApi.ensureRole(psRole);
  await page.goto(usersPage.url);
  await usersPage.assignRole(users.ps, psRole.title);
  await expect(usersPage.snackBar.alert(`User “${users.ps}” updated`)).toContainText(
    'New access roles added to the user.',
    { timeout: Timeouts.THIRTY_SECONDS },
  );
});

pmmTest(
  'PMM-T1899 - Access Role based on Labels and Check Filtering of Metrics on Dashboard @rbac',
  async ({ accessRolesPage, api, dashboard, grafanaHelper, page, urlHelper }) => {
    const mysqlOverviewUrl = urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceOverview.url, {
      from: 'now-5m',
      to: 'now',
    });
    const postgresqlSummaryUrl = urlHelper.buildUrlWithParameters(
      dashboard.postgresql.postgresqlInstanceSummary.url,
      { from: 'now-5m', to: 'now' },
    );

    await pmmTest.step('Wait for the dashboard metrics to resolve at the 5-minute step', async () => {
      await api.prometheusApi.waitForSeriesAtFiveMinuteBoundary('min(mysql_global_status_uptime)');
      await api.prometheusApi.waitForSeriesAtFiveMinuteBoundary(
        'sum(mysql_global_variables_innodb_buffer_pool_size)',
      );
      await api.prometheusApi.waitForSeriesAtFiveMinuteBoundary(
        'avg by (node_name) (node_memory_MemTotal_bytes)',
      );
    });

    await pmmTest.step('Assign the MySQL and PostgreSQL roles to their users', async () => {
      const { role_id: psRoleId } = await api.accessControlApi.ensureRole(psRole);
      const { role_id: pgRoleId } = await api.accessControlApi.ensureRole(pgRole);

      await api.accessControlApi.assignRole(userIds.ps, psRoleId);
      await api.accessControlApi.assignRole(userIds.pg, pgRoleId);
    });

    await pmmTest.step('Verify the MySQL role user sees MySQL metrics only', async () => {
      await grafanaHelper.unAuthorize();
      await grafanaHelper.authorize(users.ps, password);
      await dashboard.waitForNoDataPanelsAtMost(
        mysqlOverviewUrl,
        5,
        Timeouts.ONE_MINUTE,
        dashboard.waitForPanelsInView,
      );
      await dashboard.verifyPanelsWithDataInViewAtMost(postgresqlSummaryUrl, 5);
    });

    await pmmTest.step('Verify the PostgreSQL role user sees PostgreSQL metrics only', async () => {
      await grafanaHelper.unAuthorize();
      await grafanaHelper.authorize(users.pg, password);
      await dashboard.verifyPanelsWithDataInViewAtMost(mysqlOverviewUrl, 2);
      await dashboard.waitForNoDataPanelsAtMost(
        postgresqlSummaryUrl,
        3,
        Timeouts.ONE_MINUTE,
        dashboard.waitForPanelsInView,
      );
    });

    await pmmTest.step('Change the MySQL role to exclude the ps cluster', async () => {
      await grafanaHelper.unAuthorize();
      await grafanaHelper.authorize();
      await page.goto(accessRolesPage.url);
      await accessRolesPage.editAccessRole({
        description: psRole.description,
        label: 'cluster',
        operator: '!=',
        title: psRole.title,
        value: 'ps-single-dev-cluster',
      });
      await expect(accessRolesPage.snackBar.alert(`Role “${psRole.title}“ changed`)).toContainText(
        'Your role is now live and effective with the most recent changes.',
        { timeout: Timeouts.THIRTY_SECONDS },
      );
    });

    await pmmTest.step('Verify the changed role user sees no ps environment metrics', async () => {
      await grafanaHelper.unAuthorize();
      await grafanaHelper.authorize(users.ps, password);
      await dashboard.verifyPanelsWithDataInViewAtMost(
        urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceOverview.url, {
          environment: 'ps-dev',
          from: 'now-1m',
          to: 'now',
        }),
        10,
      );
    });
  },
);

pmmTest('PMM-T1585 - Verify deleting Access role @rbac', async ({ accessRolesPage, api, page }) => {
  await api.accessControlApi.ensureRole(psRole);
  await api.accessControlApi.ensureRole(pgRole);
  await page.goto(accessRolesPage.url);

  for (const { title } of [pgRole, psRole]) {
    await accessRolesPage.deleteAccessRole(title);
    await expect(accessRolesPage.snackBar.alert(`Role “${title}“ deleted`)).toContainText(
      'The role no longer exists',
      { timeout: Timeouts.THIRTY_SECONDS },
    );
  }
});

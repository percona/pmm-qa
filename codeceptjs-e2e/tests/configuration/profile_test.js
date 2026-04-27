/**
 * Note!
 * All tests with changing password must use UI login: {@code loginPage.login();}
 * to keep logout, re-login and restore admin password working.
 */

Feature('PMM User Profile tests');

const INITIAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const NEW_ADMIN_PASSWORD = 'admin1';

After(async ({ I, profileAPI }) => {
  // eslint-disable-next-line no-undef
  await tryTo(async () => {
    I.Authorize();
    await profileAPI.changePassword('admin', process.env.ADMIN_PASSWORD, INITIAL_ADMIN_PASSWORD);
  });
});

Scenario(
  'PMM-T1559 - Verify clients still can connect to PMM server after password\'s changing @user-password',
  async ({
    I, changePasswordPage, loginPage, pmmInventoryPage, grafanaAPI, inventoryAPI,
  }) => {
    await I.amOnPage(loginPage.url);
    await loginPage.login();

    await grafanaAPI.waitForMetric('pg_stat_activity_count', null);
    await grafanaAPI.waitForMetric('mysql_global_status_threads_connected', null);
    await grafanaAPI.waitForMetric('mongodb_up', null);
    await grafanaAPI.waitForMetric('node_cpu_seconds_total', null);

    await changePasswordPage.open();
    changePasswordPage.fillChangePasswordForm(process.env.ADMIN_PASSWORD, NEW_ADMIN_PASSWORD);
    changePasswordPage.applyChanges();
    I.signOut();
    await I.waitForVisible(loginPage.fields.loginInput, 30);
    process.env.ADMIN_PASSWORD = NEW_ADMIN_PASSWORD;
    await loginPage.login();

    await pmmInventoryPage.servicesTab.open();
    await pmmInventoryPage.servicesTab.pagination.selectRowsPerPage(100);

    // TODO: improve inventoryAPI.apiGetServices() to handle flexible auth.
    const services = Object.values((await inventoryAPI.apiGetServices()).data).flat(Infinity)
      .map((o) => ({ id: o.service_id, name: o.service_name }));

    for (const service of services) {
      I.assertEqual(
        await pmmInventoryPage.servicesTab.getServiceMonitoringStatus(service.name),
        'OK',
        `'${service.name}' is expected to have 'OK' status when all the agents are 'Running'`,
      );
    }

    await I.say('Verify QAN continues to receive data');
    // TODO: refactor grafanaAPI.getMetric() to have time range argument, add sleep 5 sec and get metrics for last 5 sec
    // Verify metrics exists: useless with current hardcoded time range
    await grafanaAPI.checkMetricExist('pg_stat_activity_count', null);
    await grafanaAPI.checkMetricExist('mysql_global_status_threads_connected', null);
    await grafanaAPI.checkMetricExist('mongodb_up', null);
    await grafanaAPI.checkMetricExist('node_cpu_seconds_total', null);
  },
);

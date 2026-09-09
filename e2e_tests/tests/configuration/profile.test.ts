import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const INITIAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const NEW_ADMIN_PASSWORD = 'admin1';
const MONITORED_METRICS = [
  'pg_stat_activity_count',
  'mysql_global_status_threads_connected',
  'mongodb_up',
  'node_cpu_seconds_total',
];

pmmTest.afterEach(async ({ api }) => {
  await api.grafanaApi.changePassword(NEW_ADMIN_PASSWORD, INITIAL_ADMIN_PASSWORD).catch(() => undefined);
  process.env.ADMIN_PASSWORD = INITIAL_ADMIN_PASSWORD;
  await api.grafanaApi.getDataSourceByName();
});

pmmTest(
  "PMM-T1559 - Verify clients still can connect to PMM server after password's changing @user-password",
  async ({ api, changePasswordPage, loginPage, page, servicesPage }) => {
    await pmmTest.step('Log in to PMM Server through the UI', async () => {
      await page.goto(loginPage.url);
      await loginPage.login(INITIAL_ADMIN_PASSWORD);
    });

    await pmmTest.step('Wait for the metrics of every monitored service', async () => {
      for (const metric of MONITORED_METRICS) {
        await api.grafanaApi.waitForMetric(metric, Timeouts.THIRTY_SECONDS);
      }
    });

    await pmmTest.step('Change the admin password', async () => {
      await page.goto(changePasswordPage.url);
      await expect(changePasswordPage.buttons.changePassword).toBeVisible({
        timeout: Timeouts.ONE_MINUTE,
      });
      await changePasswordPage.inputs.oldPassword.fill(INITIAL_ADMIN_PASSWORD);
      await changePasswordPage.inputs.newPassword.fill(NEW_ADMIN_PASSWORD);
      await changePasswordPage.inputs.confirmPassword.fill(NEW_ADMIN_PASSWORD);
      await changePasswordPage.buttons.changePassword.click();
      await expect(changePasswordPage.messages.successPopUp).toContainText('User password changed', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      process.env.ADMIN_PASSWORD = NEW_ADMIN_PASSWORD;
    });

    await pmmTest.step('Sign out and log back in with the new password', async () => {
      await page.goto('graph/logout');
      await expect(loginPage.inputs.username).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await loginPage.login(NEW_ADMIN_PASSWORD);
    });

    await pmmTest.step('Verify every inventory service is still monitored', async () => {
      await page.goto(servicesPage.url);
      await expect(servicesPage.buttons.addService).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await servicesPage.elements.rowsPerPageDropdown.click({ timeout: Timeouts.THIRTY_SECONDS });
      await servicesPage.builders.rowsPerPageOption('100').click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(servicesPage.elements.rowsPerPageDropdown).toHaveText('100', {
        timeout: Timeouts.THIRTY_SECONDS,
      });

      const { services } = await api.inventoryApi.getServices();

      for (const service of services) {
        await expect(
          servicesPage.builders.monitoringStatusByServiceName(service.service_name),
          `'${service.service_name}' is expected to have 'OK' status when all the agents are 'Running'`,
        ).toHaveText('OK', { timeout: Timeouts.ONE_MINUTE });
      }
    });

    await pmmTest.step('Verify QAN continues to receive data', async () => {
      for (const metric of MONITORED_METRICS) {
        await api.grafanaApi.waitForMetric(metric, Timeouts.ONE_MINUTE);
      }
    });
  },
);

import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
  await grafanaHelper.authorize();
  await api.alertingApi.removeAllAlertRules();
});

pmmTest.afterEach(async ({ api }) => {
  await api.settingsApi.updateSettings({ enable_alerting: true });
});

pmmTest(
  'PMM-T643 - Verify message about disabled IA @fb-alerting',
  async ({ alertingPage, api, page, settingsPage }) => {
    await api.settingsApi.updateSettings({ enable_alerting: false });
    await page.goto(alertingPage.url);
    await expect(alertingPage.elements.alertingDisabled).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(alertingPage.elements.alertingDisabled).toHaveText(
      'Percona Alerting is disabled. You can enable it in PMM Settings.',
    );
    await alertingPage.buttons.settingsLink.click();
    await expect(page).toHaveURL(new RegExp(settingsPage.urls.advanced), {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

pmmTest(
  'PMM-T481 + PMM-T620 + PMM-T776 - Verify IA tab bar, Verify after reloading the page user is on the same IA tab, Verify that user is able to see valid HTML Title on alerts page @fb-alerting',
  async ({ alertingPage, api, leftNavigation, page }) => {
    await api.settingsApi.updateSettings({ enable_alerting: true });
    await page.goto(alertingPage.url);
    await expect(page).toHaveTitle('Status - Alerting - Percona Monitoring and Management', {
      timeout: Timeouts.TEN_SECONDS,
    });

    await pmmTest.step('Open the Templates tab', async () => {
      await leftNavigation
        .menuItemLocator('alerts.perconaAlertTemplates')
        .click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(alertingPage.buttons.addTemplate).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await expect(page).toHaveURL(new RegExp(alertingPage.urls.templates));
      await expect(page).toHaveTitle('Alert rule templates - Alerting - Percona Monitoring and Management');
    });

    await pmmTest.step('Open the Alert rules tab', async () => {
      await leftNavigation.menuItemLocator('alerts.alertRules').click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(alertingPage.buttons.newAlertRule).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await expect(page).toHaveURL(new RegExp(alertingPage.urls.alertRules));
      await expect(page).toHaveTitle('Alert rules - Alerting - Percona Monitoring and Management');
    });

    await pmmTest.step('Open the Contact points tab', async () => {
      await leftNavigation
        .menuItemLocator('alerts.contactPoints')
        .click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(alertingPage.buttons.newContactPoint).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await expect(page).toHaveURL(new RegExp(alertingPage.urls.contactPoints));
      await expect(page).toHaveTitle('Contact points - Alerting - Percona Monitoring and Management');
    });

    await pmmTest.step('Open the Notification policies tab', async () => {
      await leftNavigation
        .menuItemLocator('alerts.notificationPolicies')
        .click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(alertingPage.buttons.newChildPolicy).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await expect(page).toHaveURL(new RegExp(alertingPage.urls.notificationPolicies));
      await expect(page).toHaveTitle('Notification policies - Alerting - Percona Monitoring and Management');
    });

    await pmmTest.step('Reload the page and verify the Notification policies tab is still open', async () => {
      await page.reload();
      await expect(alertingPage.buttons.newChildPolicy).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    });

    await pmmTest.step('Open the Silences tab', async () => {
      await leftNavigation.menuItemLocator('alerts.silences').click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(alertingPage.buttons.newSilence).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await expect(page).toHaveURL(new RegExp(alertingPage.urls.silences));
      await expect(page).toHaveTitle('Silences - Alerting - Percona Monitoring and Management');
    });

    await pmmTest.step('Open the Alert groups tab', async () => {
      await leftNavigation.menuItemLocator('alerts.alertGroups').click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(alertingPage.elements.groupByContainer).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await expect(page).toHaveURL(new RegExp(alertingPage.urls.alertGroups));
      await expect(page).toHaveTitle('Active notifications - Alerting - Percona Monitoring and Management');
    });

    await pmmTest.step('Open the Alert settings tab', async () => {
      await leftNavigation
        .menuItemLocator('alerts.alertSettings')
        .click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(alertingPage.buttons.viewConfiguration).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await expect(page).toHaveURL(new RegExp(alertingPage.urls.alertSettings));
      await expect(page).toHaveTitle('Settings - Alerting - Percona Monitoring and Management');
    });

    await pmmTest.step('Open the Status tab', async () => {
      await leftNavigation.menuItemLocator('alerts.alertStatus').click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(alertingPage.elements.noAlerts).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await expect(page).toHaveURL(new RegExp(alertingPage.url));
    });
  },
);

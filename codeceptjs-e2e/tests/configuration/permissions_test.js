const assert = require('assert');
const { users } = require('../helper/constants');

const {
  pmmSettingsPage, dashboardPage, remoteInstancesPage,
} = inject();

Feature('PMM Permission restrictions').retry(1);

const viewerRole = new DataTable(['username', 'password', 'dashboard']);

viewerRole.add([users.viewer.username, users.viewer.password, remoteInstancesPage.url]);
viewerRole.add([users.viewer.username, users.viewer.password, pmmSettingsPage.url]);
viewerRole.add([users.viewer.username, users.viewer.password, 'graph/inventory/nodes?orgId=1']);
viewerRole.add([users.viewer.username, users.viewer.password, 'graph/inventory/services?orgId=1']);

const editorRole = new DataTable(['username', 'password', 'dashboard']);

editorRole.add([users.editor.username, users.editor.password, remoteInstancesPage.url]);
editorRole.add([users.editor.username, users.editor.password, pmmSettingsPage.url]);
editorRole.add([users.editor.username, users.editor.password, 'graph/inventory/nodes?orgId=1']);
editorRole.add([users.editor.username, users.editor.password, 'graph/inventory/services?orgId=1']);

const ptSummaryRoleCheck = new DataTable(['username', 'password', 'dashboard']);

ptSummaryRoleCheck.add([users.editor.username, users.editor.password, dashboardPage.nodeSummaryDashboard.url]);
ptSummaryRoleCheck.add([users.viewer.username, users.viewer.password, dashboardPage.nodeSummaryDashboard.url]);

const settingsReadOnly = new DataTable(['username', 'password']);

settingsReadOnly.add([users.viewer.username, users.viewer.password]);
settingsReadOnly.add([users.editor.username, users.editor.password]);

BeforeSuite(async ({ I }) => {
  I.say('Creating users for the permissions test suite');
  const viewerId = await I.createUser(users.viewer.username, users.viewer.password);
  const adminId = await I.createUser(users.admin.username, users.admin.password);
  const editorId = await I.createUser(users.editor.username, users.editor.password);

  await I.setRole(viewerId);
  await I.setRole(adminId, 'Admin');
  await I.setRole(editorId, 'Editor');
});

Scenario(
  'PMM-T682 Verify backup locations access for user with viewer role [critical] @backup @grafana-pr',
  async ({
    I, homePage, settingsAPI, locationsPage,
  }) => {
    await settingsAPI.changeSettings({ backup: true });
    await I.Authorize(users.viewer.username, users.viewer.password);

    I.amOnPage(locationsPage.url);
    I.waitForVisible(homePage.fields.noAccessRightsSelector, 30);
    I.see('Insufficient access permissions.', homePage.fields.noAccessRightsSelector);
  },
);

Data(viewerRole).Scenario(
  'PMM-T824 - Verify viewer users do not see Inventory, Settings, Remote Instances Page @permissions-nightly  @gssapi-nightly @grafana-pr',
  async ({ I, current, homePage }) => {
    const { username, password, dashboard } = current;

    await I.Authorize(username, password);
    I.amOnPage(dashboard);
    I.waitForVisible(homePage.fields.noAccessRightsSelector, 30);
    I.see('Insufficient access permissions.', homePage.fields.noAccessRightsSelector);
  },
);

Data(editorRole).Scenario(
  'PMM-T824 - Verify editor users do not see Inventory, Settings, Remote Instances Page @permissions-nightly  @gssapi-nightly @grafana-pr',
  async ({ I, current, homePage }) => {
    const { username, password, dashboard } = current;

    await I.Authorize(username, password);
    I.amOnPage(dashboard);
    I.waitForVisible(homePage.fields.noAccessRightsSelector, 30);
    I.see('Insufficient access permissions.', homePage.fields.noAccessRightsSelector);
  },
);

Data(ptSummaryRoleCheck).Scenario(
  'PMM-T334 + PMM-T420 + PMM-T1726 - Verify Home dashboard and the pt-summary with viewer or editor role '
  + '@permissions-nightly  @gssapi-nightly @grafana-pr',
  async ({
    I, dashboardPage, current, adminPage, homePage,
  }) => {
    const { username, password, dashboard } = current;

    await I.Authorize(username, password);
    I.amOnPage(homePage.url);
    I.waitForVisible(dashboardPage.graphsLocator('Monitored Nodes'), 30);
    I.waitForVisible(dashboardPage.graphsLocator('Monitored DB Services'), 30);

    I.amOnPage(dashboard);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    adminPage.performPageUp(5);
    I.waitForElement(dashboardPage.nodeSummaryDashboard.ptSummaryDetail.reportContainer, 60);
    I.seeElement(dashboardPage.nodeSummaryDashboard.ptSummaryDetail.reportContainer);
  },
);

Data(settingsReadOnly).Scenario(
  'PMM-T1987 - Verify viewer/editor users can get settings/readonly @fb-settings',
  async ({
    I, current, loginPage, settingsAPI,
  }) => {
    const { username, password } = current;

    await I.amOnPage(loginPage.url);
    await loginPage.login(username, password);

    const cookie = await I.grabCookie('pmm_session');

    const { data: { settings } } = await I.sendGetRequest('v1/server/settings/readonly', {
      Cookie: `pmm_session=${cookie.value}`,
    });

    const expectedSettings = await settingsAPI.getSettings();

    assert.ok(settings.updates_enabled === expectedSettings.updates_enabled);
    assert.ok(settings.telemetry_enabled === expectedSettings.telemetry_enabled);
    assert.ok(settings.advisor_enabled === expectedSettings.advisor_enabled);
    assert.ok(settings.pmm_public_address === expectedSettings.pmm_public_address);
    assert.ok(settings.backup_management_enabled === expectedSettings.backup_management_enabled);
    assert.ok(settings.azurediscover_enabled === expectedSettings.azurediscover_enabled);
    assert.ok(settings.enable_access_control === expectedSettings.enable_access_control);
  },
);

Data(settingsReadOnly).Scenario(
  'verify viewer/editor users cannot update settings @fb-settings',
  async ({
    I, current, loginPage,
  }) => {
    const { username, password } = current;

    await I.amOnPage(loginPage.url);
    await loginPage.login(username, password);

    const cookie = await I.grabCookie('pmm_session');

    const r = await I.sendPutRequest('v1/server/settings', {
      enable_alerting: false,
      enable_telemetry: false,
      enable_advisor: false,
      updates_enabled: false,
    }, {
      Cookie: `pmm_session=${cookie.value}`,
    });

    assert.ok(r.status === 403);
  },
);

Scenario(
  'PMM-T1991 - verify viewer is not able to access rule templates page @fb-alerting @grafana-pr',
  async ({ I, ruleTemplatesPage }) => {
    await I.Authorize(users.viewer.username, users.viewer.password);
    I.amOnPage(ruleTemplatesPage.url);
    I.waitForText('Insufficient access permissions.', 10, ruleTemplatesPage.elements.unathorizedMessage);
  },
);

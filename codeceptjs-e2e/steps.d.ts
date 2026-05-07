/// <reference types='codeceptjs' />
type steps_file = typeof import('./tests/custom_steps.js');
type codeceptjsConfig = typeof import('./pr.codecept.js');
type credentials = typeof import('./tests/pages/credentials.js');
type accessRolesPage = typeof import('./tests/pages/administration/accessRolesPage.js');
type addInstanceAPI = typeof import('./tests/pages/api/addInstanceAPI.js');
type addInstancePage = typeof import('./tests/pages/addInstancePage.js');
type amiInstanceAPI = typeof import('./tests/pages/api/amiInstanceAPI.js');
type adminPage = typeof import('./tests/pages/adminPage.js');
type alertGroupsPage = typeof import('./tests/ia/pages/alertGroupsPage.js');
type alertRulesPage = typeof import('./tests/ia/pages/alertRulesPage.js');
type aiAdminPage = typeof import('./tests/ia/pages/alertingAdminPage.js');
type alertmanagerAPI = typeof import('./tests/pages/api/alertmanagerAPI.js');
type alertsAPI = typeof import('./tests/ia/pages/api/alertsAPI.js');
type alertsPage = typeof import('./tests/ia/pages/alertsPage.js');
type advisorsPage = typeof import('./tests/advisors/pages/advisorsPage.js');
type amiInstanceSetupPage = typeof import('./tests/pages/amiInstanceSetupPage.js');
type annotationAPI = typeof import('./tests/pages/api/annotationAPI.js');
type backupAPI = typeof import('./tests/backup/pages/api/backupAPI.js');
type backupInventoryPage = typeof import('./tests/backup/pages/inventoryPage.js');
type changePasswordPage = typeof import('./tests/configuration/pages/changePasswordPage.js');
type contactPointsAPI = typeof import('./tests/ia/pages/api/contactPointsAPI.js');
type contactPointsPage = typeof import('./tests/ia/pages/contactPointsPage.js');
type dashboardPage = typeof import('./tests/pages/dashboardPage.js');
type databaseChecksPage = typeof import('./tests/advisors/pages/databaseChecksPage.js');
type dbClusterSummaryDashboardPage = typeof import('./tests/PageObjects/Dashboards/Experimental/dbClusterSummaryDashboard.js');
type dumpAPI = typeof import('./tests/pages/api/dumpAPI.js');
type dumpPage = typeof import('./tests/pages/dumpPage.js');
type explorePage = typeof import('./tests/pages/explorePage.js');
type experimentalPostgresqlDashboardsPage = typeof import('./tests/PageObjects/Dashboards/Postgresql/ExperimentalPostgresqlDashboards.js');
type grafanaAPI = typeof import('./tests/pages/api/grafanaAPI.js');
type homePage = typeof import('./tests/pages/homePage.js');
type inventoryAPI = typeof import('./tests/pages/api/inventoryAPI.js');
type mysqlTableDetailsPage = typeof import('./tests/pages/mysqlTableDetailsPage.js');
type leftNavMenu = typeof import('./tests/pages/leftNavMenu.js');
type links = typeof import('./tests/helper/linksHelper.js');
type locationsPage = typeof import('./tests/backup/pages/locationsPage.js');
type locationsAPI = typeof import('./tests/backup/pages/api/locationsAPI.js');
type nPoliciesPage = typeof import('./tests/ia/pages/notificationPolicies.js');
type psMySql = typeof import('./tests/helper/psMySql.js');
type organizationEntitlementsPage = typeof import('./tests/pages/organizationEntitlementsPage.js');
type organizationTicketsPage = typeof import('./tests/pages/organizationTicketsPage.js');
type pmmDemoPage = typeof import('./tests/pages/pmmDemoPage.js');
type pmmInventoryPage = typeof import('./tests/configuration/pages/pmmInventoryPage.js');
type agentsPage = typeof import('./tests/configuration/pages/agentsPage.js');
type pmmServerAdminSettingsPage = typeof import('./tests/configuration/pages/pmmServerAdminSettingsPage.js');
type pmmSettingsPage = typeof import('./tests/configuration/pages/pmmSettingsPage.js');
type profileAPI = typeof import('./tests/configuration/api/profileApi.js');
type remoteInstancesPage = typeof import('./tests/pages/remoteInstancesPage.js');
type remoteInstancesHelper = typeof import('./tests/remoteInstances/remoteInstancesHelper.js');
type restorePage = typeof import('./tests/backup/pages/restorePage.js');
type rolesApi = typeof import('./tests/configuration/api/rolesApi.js');
type rulesAPI = typeof import('./tests/ia/pages/api/rulesAPI.js');
type ruleTemplatesPage = typeof import('./tests/ia/pages/ruleTemplatesPage.js');
type scheduledAPI = typeof import('./tests/backup/pages/api/scheduledAPI.js');
type scheduledPage = typeof import('./tests/backup/pages/scheduledPage.js');
type searchDashboardsModal = typeof import('./tests/pages/dashboards/components/searchDashboardsModal.js');
type serverApi = typeof import('./tests/pages/api/serverApi.js');
type serviceAccountsPage = typeof import('./tests/pages/administration/serviceAccountsPage.js');
type silencesPage = typeof import('./tests/ia/pages/silencesPage.js');
type iaCommon = typeof import('./tests/ia/pages/iaCommonPage.js');
type advisorsAPI = typeof import('./tests/advisors/pages/api/advisorsAPI.js');
type settingsAPI = typeof import('./tests/pages/api/settingsAPI.js');
type templatesAPI = typeof import('./tests/ia/pages/api/templatesAPI.js');
type qanAPI = typeof import('./tests/QAN/api/qanAPI.js');
type environmentOverviewPage = typeof import('./tests/pages/environmentOverviewPage.js');
type tooltips = typeof import('./tests/helper/tooltipHelper.js');
type statsAndLicensePage = typeof import('./tests/server-admin/pages/statsAndLicensePage.js');
type dataSourcePage = typeof import('./tests/pages/pmmSettingsPages/dataSourcePage.js');
type pmmTourPage = typeof import('./tests/pages/pmmTourPage.js');
type loginPage = typeof import('./tests/pages/loginPage.js');
type nodesOverviewPage = typeof import('./tests/pages/nodesOverviewPage.js');
type queryAnalyticsPage = typeof import('./tests/pages/queryAnalyticsPage.js');
type usersPage = typeof import('./tests/pages/administration/usersPage.js');
type agentCli = typeof import('./tests/pages/cliHelpers/agentCli.js');
type pmmUpgradePage = typeof import('./tests/pages/pmmUpgradePage.js');
type remoteInstancesFixture = typeof import('./tests/fixtures/remoteInstancesFixture.js');
type MongoDBHelper = import('./tests/helper/mongoDB.js');
type PostgresqlDBHelper = import('codeceptjs-postgresqlhelper');
type Grafana = import('./tests/helper/grafana_helper.js');
type FileHelper = import('./tests/helper/file_helper.js');
type PerformanceHelper = import('./tests/helper/performance_helper.js');
type BrowserHelper = import('./tests/helper/browser_helper.js');
type Mailosaur = import('codeceptjs-mailosaurhelper');
type DbHelper = import('codeceptjs-dbhelper');
type ChaiWrapper = import('codeceptjs-chai');
type LocalStorageHelper = import('./tests/helper/localStorageHelper.js');
type ApiHelper = import('./tests/helper/apiHelper.js');
type ReporterHelper = import('./tests/helper/reporter_helper.js');

declare namespace CodeceptJS {
  interface SupportObject { I: I, current: any, codeceptjsConfig: codeceptjsConfig, credentials: credentials, accessRolesPage: accessRolesPage, addInstanceAPI: addInstanceAPI, addInstancePage: addInstancePage, amiInstanceAPI: amiInstanceAPI, adminPage: adminPage, alertGroupsPage: alertGroupsPage, alertRulesPage: alertRulesPage, aiAdminPage: aiAdminPage, alertmanagerAPI: alertmanagerAPI, alertsAPI: alertsAPI, alertsPage: alertsPage, advisorsPage: advisorsPage, amiInstanceSetupPage: amiInstanceSetupPage, annotationAPI: annotationAPI, backupAPI: backupAPI, backupInventoryPage: backupInventoryPage, changePasswordPage: changePasswordPage, contactPointsAPI: contactPointsAPI, contactPointsPage: contactPointsPage, dashboardPage: dashboardPage, databaseChecksPage: databaseChecksPage, dbClusterSummaryDashboardPage: dbClusterSummaryDashboardPage, dumpAPI: dumpAPI, dumpPage: dumpPage, explorePage: explorePage, experimentalPostgresqlDashboardsPage: experimentalPostgresqlDashboardsPage, grafanaAPI: grafanaAPI, homePage: homePage, inventoryAPI: inventoryAPI, mysqlTableDetailsPage: mysqlTableDetailsPage, leftNavMenu: leftNavMenu, links: links, locationsPage: locationsPage, locationsAPI: locationsAPI, nPoliciesPage: nPoliciesPage, psMySql: psMySql, organizationEntitlementsPage: organizationEntitlementsPage, organizationTicketsPage: organizationTicketsPage, pmmDemoPage: pmmDemoPage, pmmInventoryPage: pmmInventoryPage, agentsPage: agentsPage, pmmServerAdminSettingsPage: pmmServerAdminSettingsPage, pmmSettingsPage: pmmSettingsPage, profileAPI: profileAPI, remoteInstancesPage: remoteInstancesPage, remoteInstancesHelper: remoteInstancesHelper, restorePage: restorePage, rolesApi: rolesApi, rulesAPI: rulesAPI, ruleTemplatesPage: ruleTemplatesPage, scheduledAPI: scheduledAPI, scheduledPage: scheduledPage, searchDashboardsModal: searchDashboardsModal, serverApi: serverApi, serviceAccountsPage: serviceAccountsPage, silencesPage: silencesPage, iaCommon: iaCommon, advisorsAPI: advisorsAPI, settingsAPI: settingsAPI, templatesAPI: templatesAPI, qanAPI: qanAPI, environmentOverviewPage: environmentOverviewPage, tooltips: tooltips, statsAndLicensePage: statsAndLicensePage, dataSourcePage: dataSourcePage, pmmTourPage: pmmTourPage, loginPage: loginPage, nodesOverviewPage: nodesOverviewPage, queryAnalyticsPage: queryAnalyticsPage, usersPage: usersPage, agentCli: agentCli, pmmUpgradePage: pmmUpgradePage, remoteInstancesFixture: remoteInstancesFixture }
  interface Methods extends Playwright, MongoDBHelper, PostgresqlDBHelper, Grafana, FileHelper, FileSystem, PerformanceHelper, BrowserHelper, REST, Mailosaur, DbHelper, ChaiWrapper, LocalStorageHelper, ApiHelper, ReporterHelper {}
  interface I extends ReturnType<steps_file>, WithTranslation<Methods> {}
  namespace Translation {
    interface Actions {}
  }
}

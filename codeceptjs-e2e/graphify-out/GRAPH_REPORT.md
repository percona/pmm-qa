# Graph Report - .  (2026-08-12)

## Corpus Check
- 281 files · ~101,182 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1859 nodes · 2720 edges · 202 communities (102 shown, 100 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- CodeceptJS Custom Steps and Fixtures
- Dashboard Overview and Health Tests
- Docker Public Address Variable Tests
- Repo Lint and Tooling Config
- Query Analytics Data Components
- PMM Inventory Page Tests
- Remote Instances Page Tests
- PMM Dump API Tests
- PMM Settings Page Tests
- Home and Postgres Dashboards
- Inventory API and Left Nav
- Grafana Helper and Playwright Setup
- Agents Page Tests
- Server Disconnect and Custom Steps
- PGSM Integration Tests
- JS Project Config
- Grafana API Tests
- Query Analytics Query Details
- Aurora Postgres Remote Instance Tests
- Left Navigation Migration
- Credentials and PS Integration Tests
- Backup Locations API Tests
- Admin Page Tests
- Advisors API Tests
- CONTRIBUTING Conventions
- Backup Inventory Tests
- MongoDB Metrics Tests
- MongoDB Helper
- STT Settings and Alerting API
- Add Instance API Tests
- Query Analytics Filters
- Database Checks Page Tests
- IA Alert Rules Page Tests
- Profile API Tests
- External Postgres Docker Tests
- Search Dashboards Tests
- Advisors Page Tests
- Backup API Tests
- MongoDB Instances Compare Dashboard
- IA Common and Alert Groups
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 184
- Community 185
- Community 186
- Community 187
- Community 188
- Community 189
- Community 190
- Community 191
- Community 192
- Community 193
- Community 194
- Community 199
- Community 200
- Community 201

## God Nodes (most connected - your core abstractions)
1. `SERVICE_TYPE` - 40 edges
2. `QueryAnalyticsData` - 38 edges
3. `Grafana` - 26 edges
4. `QueryAnalyticsQueryDetails` - 22 edges
5. `QueryAnalyticsFilters` - 20 edges
6. `MongoDBHelper` - 18 edges
7. `{ MongoClient }` - 17 edges
8. `Methods` - 13 edges
9. `locateOption()` - 13 edges
10. `MongodbInstancesCompareDashboard` - 12 edges

## Surprising Connections (you probably didn't know these)
- `external-pgsql-ssl.yml (Ansible playbook)` --conceptually_related_to--> `SSL certificate generation and validation for PMM test environments`  [INFERRED]
  testdata/external-services/external-pgsql-ssl.yml → pmm-ssl.yml
- `verifyPaginationButtonsState()` --indirect_call--> `value()`  [INFERRED]
  tests/ia/pages/iaCommonPage.js → tests/helper/hooks.js
- `parse()` --indirect_call--> `value()`  [INFERRED]
  tests/leftNavigation_migrated.js → tests/helper/hooks.js
- `PMM UI end-to-end tests README` --references--> `docker-compose.yml (default PMM environment)`  [EXTRACTED]
  README.md → docker-compose.yml
- `external-pgsql-ssl.yml (Ansible playbook)` --semantically_similar_to--> `external-pgsql.yml (Ansible playbook)`  [INFERRED] [semantically similar]
  testdata/external-services/external-pgsql-ssl.yml → testdata/external-services/external-pgsql.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **SSL-secured test environment configurations across DB engines and PMM** — docker_compose_mongodb_ssl, docker_compose_mysql_ssl, docker_compose_postgresql_ssl, pmm_ssl, testdata_external_services_external_pgsql_ssl [INFERRED 0.80]
- **PMM server+client docker-compose test environment variants** — docker_compose, docker_compose_nomad, docker_compose_disconnect, docker_compose_encryption, docker_compose_ubuntu, docker_compose_clickhouse [INFERRED 0.75]
- **QA test authoring and execution guidelines (conventions + tags)** — readme, contributing, readme_test_tags [INFERRED 0.75]
- **IA Template Parameter Edge-Case Test Fixtures** — tests_ia_templates_customparam, tests_ia_templates_spaceinparam, tests_ia_templates_specialcharinparam, tests_ia_templates_undefinedparam [INFERRED 0.75]
- **IA Standard Threshold Template Format Variants** — tests_ia_templates_template_yaml, tests_ia_templates_template_yml, tests_ia_templates_templateforrules [INFERRED 0.75]
- **IA TemplateForAutomation Input Variants** — tests_ia_templates_inputtemplate, tests_ia_templates_templatewithtiers, tests_ia_templates_range_empty [INFERRED 0.65]

## Communities (202 total, 100 thin omitted)

### Community 0 - "CodeceptJS Custom Steps and Fixtures"
Cohesion: 0.02
Nodes (81): accessRolesPage, Actions, addInstanceAPI, addInstancePage, adminPage, advisorsAPI, advisorsPage, agentCli (+73 more)

### Community 1 - "Dashboard Overview and Health Tests"
Cohesion: 0.04
Nodes (32): annotationLocator(), annotationText(), applyFilter(), assert, { DashboardPanelMenu }, expandFilters(), HomeDashboard, { I, adminPage } (+24 more)

### Community 2 - "Docker Public Address Variable Tests"
Cohesion: 0.05
Nodes (21): assert, publicIPs, assert, moment, { I }, ProductTourComponent, { I }, UpdatesAvailableModalComponent (+13 more)

### Community 3 - "Repo Lint and Tooling Config"
Cohesion: 0.05
Nodes (39): dotenv, eslint, eslint-config-airbnb, eslint-config-airbnb-base, eslint-config-airbnb-typescript, eslint-config-prettier, eslint-plugin-import, eslint-plugin-playwright (+31 more)

### Community 4 - "Query Analytics Data Components"
Cohesion: 0.06
Nodes (3): assert, { I, queryAnalyticsPage }, QueryAnalyticsData

### Community 5 - "PMM Inventory Page Tests"
Cohesion: 0.06
Nodes (6): { AGENT_NAMES }, assert, { I, inventoryAPI }, NodesTab, paginationPart, servicesTab

### Community 6 - "Remote Instances Page Tests"
Cohesion: 0.09
Nodes (21): addRemoteDetails(), addRemoteSSLDetails(), assert, clickAddInstanceAndWaitForSuccess(), createRemoteInstance(), discoverAzure(), discoverRDS(), fillFields() (+13 more)

### Community 7 - "PMM Dump API Tests"
Cohesion: 0.07
Nodes (22): assert, axios, buildDumpDownloadUrl(), countFilesRecursively(), downloadDump(), fs, getDump(), { I, codeceptjsConfig } (+14 more)

### Community 8 - "PMM Settings Page Tests"
Cohesion: 0.07
Nodes (9): addAlertmanagerRule(), assert, clearPublicAddress(), { communicationData, emailDefaults }, customClearField(), {
  I, adminPage, links, codeceptjsConfig, settingsAPI,
}, openAdvancedSettings(), waitForPmmSettingsPageLoaded() (+1 more)

### Community 9 - "Home and Postgres Dashboards"
Cohesion: 0.09
Nodes (22): assert, panels, { SERVICE_TYPE }, { inventoryAPI }, { SERVICE_TYPE }, serviceList, assert, { dashboardPage } (+14 more)

### Community 10 - "Inventory API and Left Nav"
Cohesion: 0.11
Nodes (26): value(), parse(), {
  AGENT_STATUS,
  AGENT_TYPE,
}, apiGetAgentDetailsViaAgentId(), apiGetAgents(), apiGetNodeInfoByServiceName(), apiGetPMMAgentInfoByServiceId(), apiGetServices() (+18 more)

### Community 11 - "Grafana Helper and Playwright Setup"
Cohesion: 0.10
Nodes (3): playwright, playwright, Grafana

### Community 12 - "Agents Page Tests"
Cohesion: 0.10
Nodes (16): { I }, paginationPart, TODO: describe agent type or update it to enum, getLastPageNumber(), getTotalOfItems(), { I }, { locateOption }, FIXME: add proper check when PMM-10803 will be fixed (+8 more)

### Community 13 - "Server Disconnect and Custom Steps"
Cohesion: 0.09
Nodes (13): AdmZip, assert, axios, buildUrl, buildUrlWithParams(), dontSeeEntriesInZip(), fs, getFileLineCount() (+5 more)

### Community 14 - "PGSM Integration Tests"
Cohesion: 0.08
Nodes (18): CLI_AGENT_STATUS, assert, connection, { faker }, filters, { I }, labels, TODO: unskip after https://perconadev.atlassian.net/browse/PMM-13544 (+10 more)

### Community 15 - "JS Project Config"
Cohesion: 0.08
Nodes (19): compilerOptions, allowJs, checkJs, module, moduleResolution, target, types, exclude (+11 more)

### Community 16 - "Grafana API Tests"
Cohesion: 0.10
Nodes (13): assert, checkMetricAbsent(), checkMetricExist(), getDataSourceUidByName(), getMetric(), { I }, waitForMetric(), waitForMetricAbsent() (+5 more)

### Community 17 - "Query Analytics Query Details"
Cohesion: 0.10
Nodes (3): assert, { I, queryAnalyticsPage }, QueryAnalyticsQueryDetails

### Community 18 - "Aurora Postgres Remote Instance Tests"
Cohesion: 0.09
Nodes (19): AGENT_NAMES, assert, instances, { remoteInstancesHelper, pmmInventoryPage }, { SERVICE_TYPE, AGENT_NAMES }, { adminPage }, assert, instances (+11 more)

### Community 19 - "Left Navigation Migration"
Cohesion: 0.13
Nodes (12): assert, { leftNavMenu }, TODO: Needs to be removed, Advisors are on by default hence no settings link any, sidebar, { I }, {
  LeftMenu, LeftSearchMenu, SubMenu, menuOption,
}, { I }, LeftMenu() (+4 more)

### Community 20 - "Credentials and PS Integration Tests"
Cohesion: 0.09
Nodes (17): { I }, { adminPage }, assert, connection, { SERVICE_TYPE }, { adminPage }, { isJenkinsGssapiJob }, querySources (+9 more)

### Community 21 - "Backup Locations API Tests"
Cohesion: 0.12
Nodes (11): clearAllLocations(), getLocationsList(), { I }, localStorageDefaultConfig, removeLocation(), { storageLocationConnection, psStorageLocationConnection }, storageType, { I, locationsAPI } (+3 more)

### Community 22 - "Admin Page Tests"
Cohesion: 0.10
Nodes (5): assert, { I }, navigateToDashboard(), prepareDashboardLocator(), prepareFolderLocator()

### Community 23 - "Advisors API Tests"
Cohesion: 0.13
Nodes (13): assert, getAdvisorCategory(), getAdvisorDetails(), getAdvisors(), getAllChecksList(), getFailedCheckBySummary(), getSecurityChecksResults(), { I } (+5 more)

### Community 24 - "CONTRIBUTING Conventions"
Cohesion: 0.13
Nodes (11): Assertion Conventions (verify prefix), Locator Conventions (Page Object, locate() > CSS > Xpath), Naming Conventions (methods, acronyms, test files), Test Data Conventions (Data Provider), docker-compose.yml (default PMM environment), Extra /slowlogs/ host directory needed to avoid MySQL-on-Docker-for-Mac lock during slowlog rotation tests, PMM UI end-to-end tests README, CodeceptJS test tags (@backup, @qan, @settings, etc.) (+3 more)

### Community 25 - "Backup Inventory Tests"
Cohesion: 0.10
Nodes (19): assert, createBackupTests, deleteArtifactsTests, faker, location, { locationsAPI }, moment, mongoConnection (+11 more)

### Community 26 - "MongoDB Metrics Tests"
Cohesion: 0.10
Nodes (17): AGENT_TYPE, gssapi, assert, connection, { gssapi }, mongo_test_user, assert, collectionNames (+9 more)

### Community 28 - "STT Settings and Alerting API"
Cohesion: 0.13
Nodes (10): inputs, apiDisableIA(), apiEnableIA(), assert, changeSettings(), defaultCheckIntervals, defaultResolution, disableAzure() (+2 more)

### Community 29 - "Add Instance API Tests"
Cohesion: 0.16
Nodes (13): addInstanceForSTT(), addMongodb(), addMysql(), addPostgresql(), addPostgreSQLGC(), addProxysql(), addRDS(), addRDSAurora() (+5 more)

### Community 31 - "Database Checks Page Tests"
Cohesion: 0.14
Nodes (11): assert, compareTooltipValues(), failedChecksInfoLocator(), {
  I, pmmInventoryPage, settingsAPI,
}, mouseOverInfoIcon(), numberOfFailedChecksLocator(), openFailedChecksListForService(), verifyDatabaseChecksPageElements() (+3 more)

### Community 32 - "IA Alert Rules Page Tests"
Cohesion: 0.16
Nodes (11): editPerconaAlert(), fillPerconaAlert(), { I }, openAlertRulesTab(), { rules, templates, filterOperators }, searchAndSelectResult(), selectFolder(), verifyAndReplaceInputField() (+3 more)

### Community 33 - "Profile API Tests"
Cohesion: 0.12
Nodes (6): assert, { I }, { I }, TODO: improve inventoryAPI.apiGetServices() to handle flexible auth., TODO: refactor grafanaAPI.getMetric() to have time range argument, add sleep 5 s, { I, homePage }

### Community 34 - "External Postgres Docker Tests"
Cohesion: 0.13
Nodes (10): { adminPage }, data, DashboardLinkContainer, assert, { I, queryAnalyticsPage, adminPage }, { DashboardLinkContainer }, { I }, { QueryAnalyticsData } (+2 more)

### Community 35 - "Search Dashboards Tests"
Cohesion: 0.13
Nodes (5): folders, { searchDashboardsModal }, folderWrapper, { I }, { isOvFAmiJenkinsJob }

### Community 36 - "Advisors Page Tests"
Cohesion: 0.16
Nodes (5): actionButton(), checkRow(), {
  I,
}, runAdvisors(), runAllAdvisors()

### Community 37 - "Backup API Tests"
Cohesion: 0.22
Nodes (11): assert, clearAllArtifacts(), deleteArtifact(), getArtifactByName(), getArtifactDate(), getArtifactsList(), getRestoreHistoryList(), { I } (+3 more)

### Community 39 - "IA Common and Alert Groups"
Cohesion: 0.14
Nodes (9): { settingsAPI, iaCommon, alertsPage }, assert, { I }, assert, { I }, assert, { I }, assert (+1 more)

### Community 40 - "Community 40"
Cohesion: 0.17
Nodes (8): { Agent }, bootstrapHook, { pageObjects, getChunks }, assert, expectUrlTimeParamToMatch(), moment, assert, { codeceptjsConfig }

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (13): ApiHelper, BrowserHelper, ChaiWrapper, DbHelper, FileHelper, Grafana, LocalStorageHelper, Mailosaur (+5 more)

### Community 42 - "Community 42"
Cohesion: 0.21
Nodes (9): assert, backupModes, clearAllSchedules(), getScheduledList(), getScheduleIdByName(), { I }, removeScheduledBackup(), waitForFirstExecution() (+1 more)

### Community 43 - "Community 43"
Cohesion: 0.17
Nodes (5): faker, { I }, { locateOption }, selectDropdownOption(), startRestoreCompatible()

### Community 44 - "Community 44"
Cohesion: 0.18
Nodes (5): { I }, { locateOption }, verifyBackupDetailsRow(), verifyBackupRowValues(), verifyBackupValues()

### Community 45 - "Community 45"
Cohesion: 0.17
Nodes (11): locateOptions, assert, { dashboardPage, homePage }, {
  inventoryAPI,
}, { locateOptions }, TODO: https://perconadev.atlassian.net/browse/PMM-12956, TODO: https://perconadev.atlassian.net/browse/PMM-12956, FIXME: 5 N/As once https://jira.percona.com/browse/PMM-10308 is fixed (+3 more)

### Community 46 - "Community 46"
Cohesion: 0.22
Nodes (8): createTable(), createUser(), deleteTable(), dropUser(), execute(), { I }, mysql, setUserPassword()

### Community 47 - "Community 47"
Cohesion: 0.15
Nodes (12): assert, page, FIXME: unskip after https://jira.percona.com/browse/PMM-11399 is fixed, TODO: unskip in scope of https://perconadev.atlassian.net/browse/PMM-12938, FIXME: unskip after https://jira.percona.com/browse/PMM-11399 is fixed, TODO: check ovf failure, FIXME: flaky test fix and unskip, rules (+4 more)

### Community 48 - "Community 48"
Cohesion: 0.15
Nodes (9): assert, { I }, assert, clientDbServices, { dashboardPage }, { SERVICE_TYPE }, annotation, { dashboardPage } (+1 more)

### Community 49 - "Community 49"
Cohesion: 0.17
Nodes (10): assert, editorRole, {
  pmmSettingsPage, dashboardPage, remoteInstancesPage,
}, ptSummaryRoleCheck, settingsReadOnly, { users }, viewerRole, assert (+2 more)

### Community 50 - "Community 50"
Cohesion: 0.17
Nodes (7): subPages, assert, { I }, { SERVICE_TYPE }, DB_CONFIG, remoteInstanceStatus, { SERVICE_TYPE }

### Community 51 - "Community 51"
Cohesion: 0.20
Nodes (9): AGENT_STATUS, assert, connection, { SERVICE_TYPE }, { AGENT_STATUS }, AgentCli, getLogLevel(), getLogLevelResponse() (+1 more)

### Community 52 - "Community 52"
Cohesion: 0.20
Nodes (7): assert, { I }, navigateToEditAlertRule(), openRowActions(), TODO: move to silencesPage, silenceAlert(), assert

### Community 53 - "Community 53"
Cohesion: 0.17
Nodes (11): assert, dashboardCheck, disableCollectorsTests, faker, instances, metrics, qanFilters, TODO: https://jira.percona.com/browse/PMM-9011 (+3 more)

### Community 54 - "Community 54"
Cohesion: 0.18
Nodes (6): faker, location, { locationsPage, locationsAPI }, s3Errors, { SERVICE_TYPE }, { I }

### Community 55 - "Community 55"
Cohesion: 0.25
Nodes (8): assert, createAlertRule(), createAlertRules(), faker, getFolderUID(), { I }, removeAlertRule(), removeAllAlertRules()

### Community 56 - "Community 56"
Cohesion: 0.20
Nodes (4): getSourceLocator(), { I }, templateRow(), YAML

### Community 57 - "Community 57"
Cohesion: 0.24
Nodes (8): getServiceName(), { I }, selectServiceName(), BaseDashboardPage, checkVacuumValues(), { I }, waitForLastAnalyzeValues(), waitForLastVacuumValues()

### Community 60 - "Community 60"
Cohesion: 0.20
Nodes (9): assert, aws_instances, azureServices, instances, qanFilters, TODO: https://jira.percona.com/browse/PMM-9011, {
  remoteInstancesPage, pmmInventoryPage, remoteInstancesHelper,
}, {
  SERVICE_TYPE, NODE_TYPE,
  AGENT_STATUS,
  AGENT_NAMES,
} (+1 more)

### Community 61 - "Community 61"
Cohesion: 0.20
Nodes (7): contactPointsAPI, FIXME: Skip until https://jira.percona.com/browse/PMM-11130 is fixed, rulesForAlerts, { users }, assert, { I }, Integrated Alerting How-To-Test README

### Community 62 - "Community 62"
Cohesion: 0.29
Nodes (9): { api }, assert, getAlertFromPD(), getAlertsForIncident(), getAlertsList(), { I }, verifyAlertInPagerDuty(), waitForAlerts() (+1 more)

### Community 63 - "Community 63"
Cohesion: 0.24
Nodes (6): assert, createCP(), deleteCP(), fillFields(), {
  I, iaCommon,
}, openMoreMenu()

### Community 64 - "Community 64"
Cohesion: 0.24
Nodes (6): assert, {
  I, alertRulesPage, ruleTemplatesPage, rulesAPI, templatesAPI, alertsPage, alertsAPI,
}, { locateOption }, shouldBeDisabled(), verifyButtonState(), verifyPaginationButtonsState()

### Community 65 - "Community 65"
Cohesion: 0.20
Nodes (3): ExplorePage, { I }, assert

### Community 66 - "Community 66"
Cohesion: 0.22
Nodes (9): adm-zip, codeceptjs-mailosaurhelper, codeceptjs-postgresqlhelper, dependencies, adm-zip, codeceptjs-mailosaurhelper, codeceptjs-postgresqlhelper, @types/lodash (+1 more)

### Community 67 - "Community 67"
Cohesion: 0.28
Nodes (8): args, { config }, findTestsWithTag(), fs, glob, main(), path, writeToSubsetFile()

### Community 68 - "Community 68"
Cohesion: 0.22
Nodes (8): assert, location, moment, TODO: unskip after https://perconadev.atlassian.net/browse/PMM-12988, { scheduledPage }, scheduleErrors, schedules, {
  SERVICE_TYPE,
  gssapi,
}

### Community 69 - "Community 69"
Cohesion: 0.31
Nodes (8): assert, clearAllTemplates(), createRuleTemplate(), createRuleTemplates(), faker, getTemplatesList(), { I, ruleTemplatesPage }, removeTemplate()

### Community 70 - "Community 70"
Cohesion: 0.22
Nodes (8): assert, page, TODO: Unskip after we bring back built-in templates, templates, units, { users }, usersTable, YAML

### Community 71 - "Community 71"
Cohesion: 0.25
Nodes (4): gencerts.sh script, genclient.sh script, genroot.sh script, genserver.sh script

### Community 72 - "Community 72"
Cohesion: 0.25
Nodes (5): assert, failedCheckRowLocator, intervalsTests, TODO: unskip after https://jira.percona.com/browse/PMM-8051, {
  settingsAPI, psMySql, advisorsAPI, databaseChecksPage,
}

### Community 73 - "Community 73"
Cohesion: 0.25
Nodes (6): location, { locationsPage, psMySql }, mysqlCredentials, TODO: uncomment when PMM-10899 will be fixed, TODO: add check file on AWS S3, { SERVICE_TYPE }

### Community 74 - "Community 74"
Cohesion: 0.25
Nodes (6): { I, settingsAPI }, dashboardTimeRange, newPgUser, newPsUser, pgRole, psRole

### Community 76 - "Community 76"
Cohesion: 0.29
Nodes (8): changeRowsPerPage(), getNodeLink(), getServiceId(), openAgents(), openServices(), verifyAgentHasStatusRunning(), verifyMetricsFlags(), verifyNodeAgentHasRDSExporter()

### Community 78 - "Community 78"
Cohesion: 0.29
Nodes (4): locateOption(), { I }, { locateOption }, UsersPage

### Community 80 - "Community 80"
Cohesion: 0.29
Nodes (3): assert, FileHelper, fs

### Community 81 - "Community 81"
Cohesion: 0.29
Nodes (3): AccessRolesPage, { I }, { locateOption }

### Community 82 - "Community 82"
Cohesion: 0.38
Nodes (5): assert, getAlerts(), getSilenced(), { I }, verifyAlerts()

### Community 83 - "Community 83"
Cohesion: 0.29
Nodes (7): expandEachDashboardRow(), graphLegendSeriesRowByTitle(), graphsLocator(), graphsLocatorPartialMatch(), openGraphDropdownMenu(), verifyMetricsExistence(), verifyMetricsExistencePartialMatch()

### Community 84 - "Community 84"
Cohesion: 0.29
Nodes (5): assert, clientDbServices, { isOvFAmiJenkinsJob, SERVICE_TYPE }, { psMySql, dashboardPage, databaseChecksPage }, { versionMinor, patchVersionDiff, majorVersionDiff }

### Community 85 - "Community 85"
Cohesion: 0.29
Nodes (5): assert, instances, remoteInstance, { remoteInstancesPage }, { SERVICE_TYPE, AGENT_NAMES }

### Community 86 - "Community 86"
Cohesion: 0.29
Nodes (6): assert, azureServices, filters, metrics, { remoteInstancesPage, remoteInstancesHelper }, { SERVICE_TYPE }

### Community 88 - "Community 88"
Cohesion: 0.33
Nodes (5): {
  advisorsPage, databaseChecksPage, codeceptjsConfig, psMySql,
}, assert, TODO: need to add functions to access pages via left side menu, { SERVICE_TYPE }, urls

### Community 90 - "Community 90"
Cohesion: 0.33
Nodes (4): assert, instances, remoteInstance, { remoteInstancesHelper }

### Community 92 - "Community 92"
Cohesion: 0.33
Nodes (5): NODE_TYPE, assert, instances, { NODE_TYPE, SERVICE_TYPE }, { remoteInstancesHelper, pmmInventoryPage }

### Community 93 - "Community 93"
Cohesion: 0.33
Nodes (5): assert, config, fs, { locateOption }, shell

### Community 94 - "Community 94"
Cohesion: 0.33
Nodes (6): getColumnLegendMaxValue(), panelByTitle(), panelDataByTitle(), panelValueByTitle(), verifyColumnLegendMaxValueAbove(), verifyColumnLegendValueAbove()

### Community 96 - "Community 96"
Cohesion: 0.33
Nodes (5): assert, { locateOptions }, { NODE_TYPE }, nodes, TODO: unskip after https://perconadev.atlassian.net/browse/PMM-14748 is fixed

### Community 97 - "Community 97"
Cohesion: 0.33
Nodes (4): assert, AUTH, axios, https

### Community 98 - "Community 98"
Cohesion: 0.40
Nodes (4): location, moment, { psMySql }, { SERVICE_TYPE }

### Community 105 - "Community 105"
Cohesion: 0.40
Nodes (4): { adminPage }, assert, connection, { SERVICE_TYPE }

### Community 106 - "Community 106"
Cohesion: 0.40
Nodes (3): { adminPage }, { isJenkinsGssapiJob }, querySources

### Community 107 - "Community 107"
Cohesion: 0.40
Nodes (4): assert, filters, FIXME: unskip when https://jira.percona.com/browse/PMM-11657 is fixed, shortCutTests

### Community 108 - "Community 108"
Cohesion: 0.50
Nodes (3): dataRetentionTable, page, TODO: (lunaticusgreen) Investigate these testcases, looks like codeceptjs bug

### Community 109 - "Community 109"
Cohesion: 0.50
Nodes (4): multiple-templates.yml (Bulk Template1/2/3), template.yaml Template (test_user_rule_yaml), template.yml Template (test_user_rule_yml), templateForRules.yaml Template (test_template_for_rules_yaml)

### Community 111 - "Community 111"
Cohesion: 0.67
Nodes (4): grabFailedReportTitles(), printFailedReportNames(), verifyThereAreNoGraphsWithoutData(), waitForGraphsToHaveData()

### Community 113 - "Community 113"
Cohesion: 0.67
Nodes (3): graphsLocator(), I, verifyNoDataShow()

### Community 114 - "Community 114"
Cohesion: 0.50
Nodes (3): { adminPage }, assert, serviceList

### Community 115 - "Community 115"
Cohesion: 0.50
Nodes (3): assert, { isJenkinsGssapiJob }, services

### Community 117 - "Community 117"
Cohesion: 0.50
Nodes (3): assert, remoteInstancesFixture, remoteUpgradeInstances

### Community 126 - "Community 126"
Cohesion: 0.67
Nodes (3): customParam.yml Template (Custom Parameter Name), spaceInParam.yml Template (Space In Parameter Name), specialCharInParam.yml Template (Special Character In Parameter Name)

## Knowledge Gaps
- **676 isolated node(s):** `allowJs`, `checkJs`, `module`, `moduleResolution`, `target` (+671 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **100 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Grafana` connect `Grafana Helper and Playwright Setup` to `Community 93`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 66` to `Repo Lint and Tooling Config`, `Grafana Helper and Playwright Setup`, `Community 149`, `Community 150`, `Community 151`, `Community 152`, `Community 153`, `Community 154`, `Community 155`, `Community 156`, `Community 157`, `Community 158`, `Community 159`, `Community 160`, `Community 161`, `Community 162`, `Community 163`, `Community 164`, `Community 165`, `Community 166`, `Community 167`, `Community 168`, `Community 169`, `Community 170`, `Community 171`, `Community 172`, `Community 173`, `Community 174`, `Community 175`, `Community 176`, `Community 177`, `Community 178`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `playwright` connect `Grafana Helper and Playwright Setup` to `Community 66`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **What connects `allowJs`, `checkJs`, `module` to the rest of the system?**
  _676 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CodeceptJS Custom Steps and Fixtures` be split into smaller, more focused modules?**
  _Cohesion score 0.024390243902439025 - nodes in this community are weakly interconnected._
- **Should `Dashboard Overview and Health Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.04156862745098039 - nodes in this community are weakly interconnected._
- **Should `Docker Public Address Variable Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.04830917874396135 - nodes in this community are weakly interconnected._
# CodeceptJS -> Playwright Migration Tracker

One row per CodeceptJS source test (98 unique files). The daily automation takes the top row whose
status is `pending`, migrates it per `.cursor/skills/codeceptjs-migration/SKILL.md`, live-verifies
it, and updates the row.

## How to use this tracker (automation contract)

- Pick the first row (top-to-bottom) with `status = pending`.
- The `Env` column is the PLANNED provisioning; ALWAYS confirm it by reading the source test's
  `Before`/`BeforeSuite` hook + `Data(...)` before provisioning. Update the row if it differs.
- `Setup` is the `setup_services` argument set for `pmm-framework.py` (see `context.md` sections 1c-1e).
  Empty `Setup` = no DB provisioning needed (server + client only, or no client either).
- Ordering is efficiency-first: consecutive rows share the same env bucket so the provisioned PMM
  environment can be reused day-to-day; within that, UI-only first, heaviest/integration last.
- Rows pre-set to `blocked-on-env` need infra the local host cannot create yet (cloud RDS/Aurora/Azure,
  AMI/OVF images, the external pmm-demo server). Move them to `pending` once that infra is available.
- **Best-fit target:** before migrating, pick the existing Playwright file that matches source
  *behavior* (page, feature, hooks). Only create a new `*.test.ts` when no fit exists. Update `Target`
  to the actual file used.
- **Source rename on done:** after live PASS, `git mv` `*_test.js` → `*_migrated.js` so Codecept CI
  (`tests/**/*_test.js`) skips it. Update `Source` column to the `_migrated.js` path.

## Status legend

`pending` -> not started | `in-progress` -> being migrated | `migrated` -> code done, not yet verified |
`needs-review` -> confidence <=95%, gaps listed in Notes | `done` -> live run PASSED | `failed` ->
live run failed (root cause in Notes) | `blocked-on-env` -> required infra unavailable.

## Env bucket summary

| Bucket | Env | Setup (setup_services) |
| --- | --- | --- |
| B1 | none (UI/server only) | (none) |
| B2 | pgsql / pdpgsql | `--database pgsql` or `--database pdpgsql` |
| B3 | ps / mysql | `--database ps=8.4` |
| B4 | psmdb | `--database psmdb` |
| B5 | valkey | `--database valkey` |
| B6 | pxc + haproxy | `--database haproxy --database ps --database pxc` |
| B7 | ssl variants | `--database ssl_mysql` / `ssl_psmdb` / `ssl_pdpgsql=16` |
| B8 | backup (ps + bucket) | `--database ps=8.4,BACKUP=true --database bucket` |
| B9 | qa-integration (multi-db) | per test (ps / psmdb / pdpgsql / pxc / pgss / pgsm) |
| B10 | migration | `--database <db>` (source) + pmm2->pmm3 flow |
| B11 | advisors | `--database pdpgsql` |
| B12 | upgrade (special harness) | pmm-server upgrade flow + `--database` |
| B13 | blocked (cloud/demo/ami/ovf) | external infra required |

## Migration rows

| # | Status | Bucket | Env | Setup | Source | Target | Tags | Conf% | Date | Notes/PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | done | B1 | none | | `codeceptjs-e2e/tests/leftNavigation_migrated.js` | `e2e_tests/tests/helpCenter.test.ts` | @menu | 98% | 2026-07-07 | PMM-T1830; source renamed; https://github.com/percona/pmm-qa/pull/1054 |
| 2 | pending | B1 | none | | `codeceptjs-e2e/tests/serverLogs_test.js` | `e2e_tests/tests/serverLogs.test.ts` | @server-logs | | | logs.zip download |
| 3 | pending | B1 | none | | `codeceptjs-e2e/tests/verifyAnnotations_test.js` | `e2e_tests/tests/verifyAnnotations.test.ts` | @annotations | | | confirm needs client |
| 4 | pending | B1 | none | | `codeceptjs-e2e/tests/configuration/verifyPMMSettingsPageElements_test.js` | `e2e_tests/tests/configuration/settingsPageElements.test.ts` | @settings | | | reuse `settingsPage` |
| 5 | pending | B1 | none | | `codeceptjs-e2e/tests/configuration/verifyServerAdminSettings_test.js` | `e2e_tests/tests/configuration/serverAdminSettings.test.ts` | @settings | | | |
| 6 | pending | B1 | none | | `codeceptjs-e2e/tests/configuration/profile_test.js` | `e2e_tests/tests/configuration/profile.test.ts` | @settings | | | |
| 7 | pending | B1 | none | | `codeceptjs-e2e/tests/server-admin/verifyGrafanaIsGone_test.js` | `e2e_tests/tests/serverAdmin/grafanaIsGone.test.ts` | @server-admin | | | |
| 8 | pending | B1 | none | | `codeceptjs-e2e/tests/administration/serviceAccounts_test.js` | `e2e_tests/tests/administration/serviceAccounts.test.ts` | @service-accounts | | | |
| 9 | pending | B1 | none | | `codeceptjs-e2e/tests/dashboards/verifyHomeDashboards_test.js` | `e2e_tests/tests/dashboards/homeDashboards.test.ts` | @dashboards | | | reuse `dashboard` fixture |
| 10 | pending | B1 | none | | `codeceptjs-e2e/tests/dashboards/verifyPMMHealthDashboard_test.js` | `e2e_tests/tests/dashboards/pmmHealthDashboard.test.ts` | @dashboards | | | |
| 11 | pending | B1 | none | | `codeceptjs-e2e/tests/dashboards/verifySearchDashboards_test.js` | `e2e_tests/tests/dashboards/searchDashboards.test.ts` | @dashboards | | | |
| 12 | pending | B1 | none | | `codeceptjs-e2e/tests/dashboards/verifyNodesOverviewDashboard_test.js` | `e2e_tests/tests/dashboards/nodesOverviewDashboard.test.ts` | @dashboards | | | node metrics (client) |
| 13 | pending | B1 | none | | `codeceptjs-e2e/tests/verifyInsightDashboards_test.js` | `e2e_tests/tests/dashboards/insightDashboards.test.ts` | @dashboards | | | root-level; confirm vs dashboards/ dup |
| 14 | pending | B1 | none | | `codeceptjs-e2e/tests/dashboards/verifyInsightDashboards_test.js` | `e2e_tests/tests/dashboards/insightDashboardsExtended.test.ts` | @dashboards | | | reconcile with #13 (near-duplicate) |
| 15 | pending | B1 | none | | `codeceptjs-e2e/tests/verifyOSDashboards_test.js` | `e2e_tests/tests/dashboards/osDashboards.test.ts` | @dashboards | | | node exporter |
| 16 | pending | B1 | none | | `codeceptjs-e2e/tests/verifyVMDashboards_test.js` | `e2e_tests/tests/dashboards/vmDashboards.test.ts` | @dashboards @nightly | | | VictoriaMetrics |
| 17 | pending | B1 | none | | `codeceptjs-e2e/tests/metrics/explorePage_test.js` | `e2e_tests/tests/metrics/explorePage.test.ts` | @metrics | | | |
| 18 | pending | B1 | none | | `codeceptjs-e2e/tests/ia/common_test.js` | `e2e_tests/tests/ia/common.test.ts` | @ia | | | alerting UI |
| 19 | pending | B1 | none | | `codeceptjs-e2e/tests/ia/alerts_test.js` | `e2e_tests/tests/ia/alerts.test.ts` | @ia @fb-alerting | | | |
| 20 | pending | B1 | none | | `codeceptjs-e2e/tests/ia/ruleTemplates_test.js` | `e2e_tests/tests/ia/ruleTemplates.test.ts` | @fb-alerting | | | |
| 21 | pending | B1 | none | | `codeceptjs-e2e/tests/ia/alertRules_test.js` | `e2e_tests/tests/ia/alertRules.test.ts` | @fb-alerting | | | |
| 22 | pending | B1 | none | | `codeceptjs-e2e/tests/encryption/encryption_test.js` | `e2e_tests/tests/encryption/encryption.test.ts` | @encryption | | | confirm DB needs |
| 23 | pending | B1 | none | | `codeceptjs-e2e/tests/verifyDump_test.js` | `e2e_tests/tests/verifyDump.test.ts` | @dump | | | pmm dump |
| 24 | pending | B1 | none | | `codeceptjs-e2e/tests/verifyNomad_test.js` | `e2e_tests/tests/verifyNomad.test.ts` | @nomad | | | |
| 25 | pending | B1 | none | | `codeceptjs-e2e/tests/configuration/verifyPMMServerDisconnect_test.js` | `e2e_tests/tests/configuration/pmmServerDisconnect.test.ts` | @disconnect | | | |
| 26 | pending | B2 | pgsql | `--database pgsql` | `codeceptjs-e2e/tests/configuration/verifyPMMSettingsPageFunctionality_test.js` | `e2e_tests/tests/configuration/settingsPageFunctionality.test.ts` | @settings @stt | | | |
| 27 | pending | B2 | pdpgsql | `--database pdpgsql` | `codeceptjs-e2e/tests/configuration/verifyPMMInventory_test.js` | `e2e_tests/tests/configuration/pmmInventory.test.ts` | @inventory | | | reuse `servicesPage`/`agentsPage` |
| 28 | pending | B2 | pdpgsql | `--database pdpgsql` | `codeceptjs-e2e/tests/configuration/verifyPMMInventoryPagination_test.js` | `e2e_tests/tests/configuration/pmmInventoryPagination.test.ts` | @inventory | | | |
| 29 | pending | B2 | pgsql | `--database pgsql` | `codeceptjs-e2e/tests/QAN/common_test.js` | `e2e_tests/tests/qan/common.test.ts` | @qan | | | reuse `queryAnalytics` |
| 30 | pending | B2 | pgsql | `--database pgsql` | `codeceptjs-e2e/tests/QAN/overview_test.js` | `e2e_tests/tests/qan/overview.test.ts` | @qan | | | |
| 31 | pending | B2 | pgsql | `--database pgsql` | `codeceptjs-e2e/tests/QAN/filters_test.js` | `e2e_tests/tests/qan/filters.test.ts` | @qan | | | |
| 32 | pending | B2 | pgsql | `--database pgsql` | `codeceptjs-e2e/tests/QAN/pagination_test.js` | `e2e_tests/tests/qan/pagination.test.ts` | @qan | | | |
| 33 | pending | B2 | pgsql | `--database pgsql` | `codeceptjs-e2e/tests/QAN/timerange_test.js` | `e2e_tests/tests/qan/timerange.test.ts` | @qan | | | |
| 34 | pending | B2 | pgsql | `--database pgsql` | `codeceptjs-e2e/tests/QAN/query_test.js` | `e2e_tests/tests/qan/query.test.ts` | @qan | | | |
| 35 | pending | B2 | pgsql | `--database pgsql` | `codeceptjs-e2e/tests/QAN/details_test.js` | `e2e_tests/tests/qan/details.test.ts` | @qan | | | |
| 36 | pending | B2 | pgsql | `--database pgsql` | `codeceptjs-e2e/tests/QAN/details_explain_test.js` | `e2e_tests/tests/qan/detailsExplain.test.ts` | @qan | | | |
| 37 | pending | B2 | pdpgsql | `--database pdpgsql` | `codeceptjs-e2e/tests/dashboards/verifyPostgresqlDashboards_test.js` | `e2e_tests/tests/dashboards/postgresqlDashboards.test.ts` | @dashboards | | | |
| 38 | pending | B2 | pdpgsql | `--database pdpgsql` | `codeceptjs-e2e/tests/dockerConfiguration/externalPostgres_test.js` | `e2e_tests/tests/dockerConfiguration/externalPostgres.test.ts` | @docker-configuration | | | external PG for pmm-server |
| 39 | pending | B3 | ps | `--database ps=8.4` | `codeceptjs-e2e/tests/verifyMysqlDashboards_test.js` | `e2e_tests/tests/dashboards/mysqlDashboards.test.ts` | @dashboards | | | reuse existing mysql POMs |
| 40 | pending | B3 | ps | `--database ps=8.4` | `codeceptjs-e2e/tests/metrics/verifyMysqlLogLevel_test.js` | `e2e_tests/tests/metrics/mysqlLogLevel.test.ts` | @metrics | | | |
| 41 | pending | B4 | psmdb | `--database psmdb` | `codeceptjs-e2e/tests/verifyMongodbDashboards_test.js` | `e2e_tests/tests/dashboards/mongodbDashboards.test.ts` | @dashboards | | | reuse `mongoDbHelper` |
| 42 | pending | B4 | psmdb | `--database psmdb` | `codeceptjs-e2e/tests/metrics/verifyMongoDB_test.js` | `e2e_tests/tests/metrics/mongodb.test.ts` | @metrics | | | |
| 43 | pending | B4 | psmdb | `--database psmdb` | `codeceptjs-e2e/tests/metrics/verifyMongoDBCollectionFlags_test.js` | `e2e_tests/tests/metrics/mongodbCollectionFlags.test.ts` | @metrics | | | |
| 44 | pending | B4 | psmdb | `--database psmdb` | `codeceptjs-e2e/tests/metrics/verifyMongoDBExperimental_test.js` | `e2e_tests/tests/metrics/mongodbExperimental.test.ts` | @metrics | | | |
| 45 | pending | B4 | psmdb | `--database psmdb,SETUP_TYPE=shards` | `codeceptjs-e2e/tests/dashboards/verifyMongodbPbmDashboard_test.js` | `e2e_tests/tests/dashboards/mongodbPbmDashboard.test.ts` | @dashboards | | | PBM backup dashboard |
| 46 | pending | B5 | valkey | `--database valkey` | `codeceptjs-e2e/tests/dashboards/verifyValkeyDashboards_test.js` | `e2e_tests/tests/dashboards/valkey/valkeyDashboardsExtra.test.ts` | @dashboards @pmm-valkey-integration | | | reuse valkey POMs |
| 47 | pending | B6 | pxc+haproxy | `--database haproxy --database ps --database pxc` | `codeceptjs-e2e/tests/qa-integration/pmm_pxc_integration_test.js` | `e2e_tests/tests/integration/pxc.test.ts` | @pmm-ps-pxc-haproxy-integration | | | |
| 48 | pending | B7 | ssl_mysql | `--database ssl_mysql` | `codeceptjs-e2e/tests/verifyTLSMySQLRemoteInstance_test.js` | `e2e_tests/tests/remoteInstances/tlsMysql.test.ts` | @ssl-mysql | | | @not-ui-pipeline |
| 49 | pending | B7 | ssl_psmdb | `--database ssl_psmdb` | `codeceptjs-e2e/tests/verifyTLSMongoDBRemoteInstance_test.js` | `e2e_tests/tests/remoteInstances/tlsMongodb.test.ts` | @ssl-mongo | | | |
| 50 | pending | B7 | ssl_pdpgsql | `--database ssl_pdpgsql=16` | `codeceptjs-e2e/tests/verifyTLSPostgresRemoteInstance_test.js` | `e2e_tests/tests/remoteInstances/tlsPostgres.test.ts` | @ssl-postgres | | | |
| 51 | pending | B8 | ps+bucket | `--database ps=8.4,BACKUP=true --database bucket` | `codeceptjs-e2e/tests/backup/locations_test.js` | `e2e_tests/tests/backup/locations.test.ts` | @backup | | | MinIO bucket |
| 52 | pending | B8 | ps+bucket | `--database ps=8.4,BACKUP=true --database bucket` | `codeceptjs-e2e/tests/backup/inventory_test.js` | `e2e_tests/tests/backup/inventory.test.ts` | @backup | | | reuse `backupsApi` |
| 53 | pending | B8 | ps+bucket | `--database ps=8.4,BACKUP=true --database bucket` | `codeceptjs-e2e/tests/backup/scheduled_test.js` | `e2e_tests/tests/backup/scheduled.test.ts` | @backup | | | |
| 54 | pending | B8 | ps+bucket | `--database ps=8.4,BACKUP=true --database bucket` | `codeceptjs-e2e/tests/backup/mysql/inventory_mysql_test.js` | `e2e_tests/tests/backup/mysql/inventoryMysql.test.ts` | @backup | | | |
| 55 | pending | B8 | ps+bucket | `--database ps=8.4,BACKUP=true --database bucket` | `codeceptjs-e2e/tests/backup/mysql/scheduled_mysql_test.js` | `e2e_tests/tests/backup/mysql/scheduledMysql.test.ts` | @backup | | | |
| 56 | pending | B9 | ps | `--database ps` | `codeceptjs-e2e/tests/qa-integration/pmm_ps_integration_test.js` | `e2e_tests/tests/integration/ps.test.ts` | @pmm-ps-integration @not-ui-pipeline | | | |
| 57 | pending | B9 | ps,replication | `--database ps,SETUP_TYPE=replication` | `codeceptjs-e2e/tests/qa-integration/pmm_ps_replica_integration_test.js` | `e2e_tests/tests/integration/psReplica.test.ts` | @not-ui-pipeline | | | |
| 58 | pending | B9 | psmdb | `--database psmdb` | `codeceptjs-e2e/tests/qa-integration/pmm_psmdb_integration_test.js` | `e2e_tests/tests/integration/psmdb.test.ts` | @pmm-psmdb-*-integration @not-ui-pipeline | | | arbiter/replica/regular variants |
| 59 | pending | B9 | pdpgsql | `--database pdpgsql` | `codeceptjs-e2e/tests/qa-integration/pmm_pdpgsql_integration_test.js` | `e2e_tests/tests/integration/pdpgsql.test.ts` | @not-ui-pipeline | | | |
| 60 | pending | B9 | pgsql,pgss | `--database pgsql,QUERY_SOURCE=pgstatements` | `codeceptjs-e2e/tests/qa-integration/pmm_pgss_integration_test.js` | `e2e_tests/tests/integration/pgss.test.ts` | @not-ui-pipeline | | | pg_stat_statements |
| 61 | pending | B9 | pdpgsql,pgsm | `--database pdpgsql,PGSM_BRANCH=...` | `codeceptjs-e2e/tests/qa-integration/pmm_pgsm_integration_test.js` | `e2e_tests/tests/integration/pgsm.test.ts` | @not-ui-pipeline | | | pg_stat_monitor |
| 62 | pending | B10 | pdpgsql | `--database pdpgsql` | `codeceptjs-e2e/tests/migration/pdpgsql_test.js` | `e2e_tests/tests/migration/pdpgsql.test.ts` | @migration | | | pmm2->pmm3 migration flow |
| 63 | pending | B10 | ps | `--database ps` | `codeceptjs-e2e/tests/migration/ps_test.js` | `e2e_tests/tests/migration/ps.test.ts` | @migration | | | |
| 64 | pending | B10 | psmdb | `--database psmdb` | `codeceptjs-e2e/tests/migration/psmdb_test.js` | `e2e_tests/tests/migration/psmdb.test.ts` | @migration | | | |
| 65 | pending | B11 | pdpgsql | `--database pdpgsql` | `codeceptjs-e2e/tests/advisors/advisors_test.js` | `e2e_tests/tests/advisors/advisors.test.ts` | @advisors | | | |
| 66 | pending | B11 | pdpgsql | `--database pdpgsql` | `codeceptjs-e2e/tests/advisors/stt/sttSettings_test.js` | `e2e_tests/tests/advisors/sttSettings.test.ts` | @stt | | | |
| 67 | pending | B11 | pdpgsql | `--database pdpgsql` | `codeceptjs-e2e/tests/advisors/stt/allChecks_test.js` | `e2e_tests/tests/advisors/allChecks.test.ts` | @stt | | | |
| 68 | pending | B11 | pdpgsql | `--database pdpgsql` | `codeceptjs-e2e/tests/advisors/stt/databaseChecks_test.js` | `e2e_tests/tests/advisors/databaseChecks.test.ts` | @stt | | | |
| 69 | pending | B11 | pdpgsql | `--database pdpgsql` | `codeceptjs-e2e/tests/advisors/stt/checksExecution_test.js` | `e2e_tests/tests/advisors/checksExecution.test.ts` | @stt | | | |
| 70 | pending | B11 | pdpgsql | `--database pdpgsql` | `codeceptjs-e2e/tests/advisors/v2/configuration_test.js` | `e2e_tests/tests/advisors/v2Configuration.test.ts` | @advisors | | | |
| 71 | pending | B1 | none | | `codeceptjs-e2e/tests/configuration/permissions_test.js` | `e2e_tests/tests/configuration/permissions.test.ts` | @permissions @grafana-pr | | | roles/permissions UI |
| 72 | pending | B1 | none | | `codeceptjs-e2e/tests/configuration/verifyRoleBasedAccessControl_test.js` | `e2e_tests/tests/configuration/rbac.test.ts` | @rbac | | | reuse `accessControlApi` |
| 73 | pending | B1 | none | | `codeceptjs-e2e/tests/verifyAddInstance_test.js` | `e2e_tests/tests/inventory/addInstance.test.ts` | @instances | | | add-instance UI |
| 74 | pending | B1 | none | | `codeceptjs-e2e/tests/verifyRemoteInstances_test.js` | `e2e_tests/tests/inventory/remoteInstances.test.ts` | @fb-instances | | | external exporter/HAProxy UI |
| 75 | pending | B2 | pdpgsql | `--database pdpgsql` | `codeceptjs-e2e/tests/dashboards/verifyGCRemoteInstance_test.js` | `e2e_tests/tests/dashboards/gcRemoteInstance.test.ts` | @dashboards | | | Google Cloud remote; confirm infra |
| 76 | pending | B4 | psmdb | `--database psmdb` | `codeceptjs-e2e/tests/verifyPTSummaryPanels_test.js` | `e2e_tests/tests/dashboards/ptSummaryPanels.test.ts` | @dashboards @pt-summary-nightly | | | multi-db summary |
| 77 | pending | B3 | ps | `--database ps=8.4` | `codeceptjs-e2e/tests/perf_test.js` | `e2e_tests/tests/perf.test.ts` | @perf | | | performance; confirm scope |
| 78 | pending | B1 | none | | `codeceptjs-e2e/tests/dockerConfiguration/verifySrvDataDirectory_test.js` | `e2e_tests/tests/dockerConfiguration/srvDataDirectory.test.ts` | @docker-configuration | | | may exist as srvFolder.test.ts - reconcile |
| 79 | pending | B1 | none | | `codeceptjs-e2e/tests/dockerConfiguration/publicAddressVariable_test.js` | `e2e_tests/tests/dockerConfiguration/publicAddressVariable.test.ts` | @docker-configuration | | | recreates pmm-server with env var |
| 80 | pending | B12 | upgrade | pmm-server upgrade flow | `codeceptjs-e2e/tests/upgrade/upgradePMM_test.js` | `e2e_tests/tests/upgrade/upgradePmm.test.ts` | @pmm-upgrade | | | special harness (old->new server) |
| 81 | pending | B12 | upgrade | pmm-server upgrade flow | `codeceptjs-e2e/tests/upgrade/customPassword_test.js` | `e2e_tests/tests/upgrade/customPassword.test.ts` | @pmm-upgrade | | | |
| 82 | pending | B12 | upgrade | pmm-server upgrade flow | `codeceptjs-e2e/tests/upgrade/dashboards_test.js` | `e2e_tests/tests/upgrade/dashboards.test.ts` | @pmm-upgrade | | | |
| 83 | pending | B12 | upgrade | pmm-server upgrade flow | `codeceptjs-e2e/tests/upgrade/settingsMetrics_test.js` | `e2e_tests/tests/upgrade/settingsMetrics.test.ts` | @pmm-upgrade | | | |
| 84 | pending | B12 | upgrade | pmm-server upgrade flow | `codeceptjs-e2e/tests/upgrade/externalService_test.js` | `e2e_tests/tests/upgrade/externalService.test.ts` | @pmm-upgrade | | | |
| 85 | pending | B12 | upgrade | pmm-server upgrade flow | `codeceptjs-e2e/tests/upgrade/ssl_test.js` | `e2e_tests/tests/upgrade/ssl.test.ts` | @pmm-upgrade | | | |
| 86 | pending | B12 | upgrade | pmm-server upgrade flow | `codeceptjs-e2e/tests/upgrade/advisorsAlerting_test.js` | `e2e_tests/tests/upgrade/advisorsAlerting.test.ts` | @pmm-upgrade | | | |
| 87 | pending | B12 | upgrade | pmm-server upgrade flow | `codeceptjs-e2e/tests/upgrade/annotationsPrometheus_test.js` | `e2e_tests/tests/upgrade/annotationsPrometheus.test.ts` | @pmm-upgrade | | | |
| 88 | blocked-on-env | B13 | cloud | AWS RDS instance required | `codeceptjs-e2e/tests/verifyAWSRDSMySQLInstance_test.js` | `e2e_tests/tests/remoteInstances/awsRdsMysql.test.ts` | @instances | | | needs AWS creds + RDS |
| 89 | blocked-on-env | B13 | cloud | AWS RDS instance required | `codeceptjs-e2e/tests/verifyAWSRDSPostgreSQLInstance_test.js` | `e2e_tests/tests/remoteInstances/awsRdsPostgres.test.ts` | @instances | | | needs AWS creds + RDS |
| 90 | blocked-on-env | B13 | cloud | Aurora instance required | `codeceptjs-e2e/tests/verifyAuroraMySQLRemoteInstance_test.js` | `e2e_tests/tests/remoteInstances/auroraMysql.test.ts` | @instances | | | needs AWS Aurora |
| 91 | blocked-on-env | B13 | cloud | Aurora instance required | `codeceptjs-e2e/tests/verifyAuroraPostgreSQLRemoteInstance_test.js` | `e2e_tests/tests/remoteInstances/auroraPostgres.test.ts` | @instances | | | needs AWS Aurora |
| 92 | blocked-on-env | B13 | cloud | Azure instance required | `codeceptjs-e2e/tests/verifyAzureMySQLPostgreSQLRemoteInstance_test.js` | `e2e_tests/tests/remoteInstances/azureMysqlPostgres.test.ts` | @instances | | | needs Azure creds |
| 93 | blocked-on-env | B13 | ami | AMI image required | `codeceptjs-e2e/tests/verifyInstanceIdAMISetup_test.js` | `e2e_tests/tests/ami/instanceIdAmiSetup.test.ts` | @ami | | | needs AWS AMI |
| 94 | blocked-on-env | B13 | ami/ovf | AMI+OVF images required | `codeceptjs-e2e/tests/upgrade/amiOvfUpgrade_test.js` | `e2e_tests/tests/upgrade/amiOvfUpgrade.test.ts` | @pmm-upgrade | | | needs AMI/OVF |
| 95 | blocked-on-env | B13 | ovf | OVF image required | `codeceptjs-e2e/tests/sshOVF_test.js` | `e2e_tests/tests/ovf/sshOvf.test.ts` | @ovf | | | needs OVF VM + SSH |
| 96 | blocked-on-env | B13 | pmm-demo | external pmm-demo server | `codeceptjs-e2e/tests/verifyPMMDemoDashboards_test.js` | `e2e_tests/tests/demo/pmmDemoDashboards.test.ts` | @pmm-demo @not-ui-pipeline | | | pmm-demo.percona.com |
| 97 | blocked-on-env | B13 | pmm-demo | external pmm-demo server | `codeceptjs-e2e/tests/verifyPMMDemoPermissionChecks_test.js` | `e2e_tests/tests/demo/pmmDemoPermissionChecks.test.ts` | @pmm-demo @not-ui-pipeline | | | |
| 98 | pending | B2 | pgsql | `--database pgsql` | `codeceptjs-e2e/tests/QAN/externalClickhouse_test.js` | `e2e_tests/tests/qan/externalClickhouse.test.ts` | @qan | | | external ClickHouse for QAN storage |

## Notes on reconciliation

- **Best-fit over filename:** the tracker `Target` column is a hint; always confirm by reading the
  source scenarios. Place into an existing Playwright file when behavior matches (e.g. help-page tests
  → `helpCenter.test.ts`, nav → `navigation.test.ts`). Create new files only when no fit exists.
- Some targets may already partially exist in `e2e_tests/tests/` (e.g. QAN under `tests/qan/rta/`,
  valkey dashboards, docker `srvFolder.test.ts`, `clickHouse.test.ts`). On the migration day, first
  check the target folder; if a test already covers the source, mark the row `done` with a note
  instead of duplicating. Rows #13/#14 (Insight dashboards root vs dashboards/) are likely
  near-duplicates - reconcile into one target.
- `@not-ui-pipeline` / cloud / demo / ami / ovf tests were excluded from the local-runnable buckets
  because they need infra beyond a local docker PMM. They are pre-marked `blocked-on-env`.

# Graph Report - .  (2026-08-12)

## Corpus Check
- Corpus is ~29,794 words - fits in a single context window. You may not need a graph.

## Summary
- 590 nodes · 1300 edges · 52 communities (18 shown, 34 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Dashboard and Grafana Panel Interfaces
- Alerting and Access Control API
- Inventory API and Metrics Helpers
- pmmTest Fixture and MongoDB Helper
- Path Aliases Config
- Dashboard Panel Components
- ESLint Config
- Test Data and Credentials Fixtures
- CLI Helper
- BasePage POM
- Grafana API
- Left Navigation Page
- QAN Real-Time Analytics Page
- Access Control API
- API Base and Real-Time Analytics API
- Backups API Types
- package.json Metadata
- BasePage Locator Types
- Backups API
- ESLint/Build Tooling Deps
- Inventory API
- Launchable Prepare Script
- Dashboards Registry Test Data
- MongoDB Helper Class
- QAN Stored Metrics Page
- QAN Query Analytics Page
- Updates Page
- Archive Helper
- Help Center Page
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
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

## God Nodes (most connected - your core abstractions)
1. `DashboardInterface` - 60 edges
2. `GrafanaPanel` - 55 edges
3. `pmmTest` - 44 edges
4. `BasePage` - 43 edges
5. `Timeouts` - 33 edges
6. `GrafanaHelper` - 26 edges
7. `PanelComponent` - 22 edges
8. `pmmTestDataType` - 21 edges
9. `RealTimeAnalyticsPage` - 21 edges
10. `LeftNavigation` - 20 edges

## Surprising Connections (you probably didn't know these)
- `pmmTestDataType` --references--> `Api`  [EXTRACTED]
  fixtures/dataTest.ts → api/api.ts
- `pmmTestDataType` --references--> `CliHelper`  [EXTRACTED]
  fixtures/dataTest.ts → helpers/cli.helper.ts
- `pmmTestDataType` --references--> `GrafanaHelper`  [EXTRACTED]
  fixtures/dataTest.ts → helpers/grafana.helper.ts
- `pmmTestDataType` --references--> `mocksHelper`  [EXTRACTED]
  fixtures/dataTest.ts → helpers/mocks.helper.ts
- `pmmTestDataType` --references--> `MongoDBHelper`  [EXTRACTED]
  fixtures/dataTest.ts → helpers/mongodb.helper.ts

## Import Cycles
- None detected.

## Communities (52 total, 34 thin omitted)

### Community 0 - "Dashboard and Grafana Panel Interfaces"
Cohesion: 0.11
Nodes (28): DashboardInterface, GrafanaPanel, GrafanaPanelType, MongodbUnusedIndexes, HaproxyInstanceSummary, MysqlCommandHandlerCountersCompare, MysqlGroupReplicationSummary, MysqlInnoDBCompressionDetails (+20 more)

### Community 1 - "Alerting and Access Control API"
Cohesion: 0.06
Nodes (26): AlertingApi, AlertTemplateBody, Headers, PmmVersion, VersionResponse, apiEndpoints, mocksHelper, AccessRole (+18 more)

### Community 2 - "Inventory API and Metrics Helpers"
Cohesion: 0.09
Nodes (20): panels(), replaceWildcards(), AgentStatus, GetService, GetServices, ServiceType, Dashboards, hasKnownNoDataMarker() (+12 more)

### Community 3 - "pmmTest Fixture and MongoDB Helper"
Cohesion: 0.12
Nodes (12): pmmTest, MongoConfig, Timeouts, UpdateInfo, config, config, configurations, srvConfigurations (+4 more)

### Community 4 - "Path Aliases Config"
Cohesion: 0.06
Nodes (33): ./api/*, ./components/*, ./fixtures/*, ./helpers/*, ./interfaces/*, node, ./pages/*, ./pages/dashboards/valkey/index.ts (+25 more)

### Community 5 - "Dashboard Panel Components"
Cohesion: 0.13
Nodes (10): BarGaugePanel, BarTimePanel, GaugePanel, PanelComponent, PolyStatPanel, StatPanel, StateTimePanel, TablePanel (+2 more)

### Community 6 - "ESLint Config"
Cohesion: 0.08
Nodes (25): ignoreList, env, es2021, node, extends, playwright, parser, plugins (+17 more)

### Community 7 - "Test Data and Credentials Fixtures"
Cohesion: 0.12
Nodes (11): data(), pmmTestDataType, Credentials, BuildUrlParameters, UrlHelper, SettingsPage, AgentsPage, NodesPage (+3 more)

### Community 8 - "CLI Helper"
Cohesion: 0.10
Nodes (4): CliHelper, getMetrics, ExecReturn, VacuumDashboard

### Community 9 - "BasePage POM"
Cohesion: 0.14
Nodes (4): BasePage, DownloadsPage, ServicesPage, StatsAndLicensePage

### Community 14 - "API Base and Real-Time Analytics API"
Cohesion: 0.21
Nodes (3): Api, RealTimeAnalyticsApi, ServerApi

### Community 15 - "Backups API Types"
Cohesion: 0.17
Nodes (9): BackupArtifact, BackupArtifactsResponse, BackupLocation, BackupLocationsResponse, BackupMode, LOCAL_STORAGE_CONFIG, ScheduledBackup, ScheduledBackupsResponse (+1 more)

### Community 16 - "package.json Metadata"
Cohesion: 0.17
Nodes (11): author, description, keywords, license, lint-staged, *.{ts}, main, name (+3 more)

### Community 17 - "BasePage Locator Types"
Cohesion: 0.27
Nodes (5): DropdownName, NestedLocatorMap, NestedLocators, TabNames, serviceTypes

### Community 19 - "ESLint/Build Tooling Deps"
Cohesion: 0.22
Nodes (9): build-url-ts, eslint, eslint-plugin-prettier, globals, devDependencies, build-url-ts, eslint, eslint-plugin-prettier (+1 more)

### Community 21 - "Launchable Prepare Script"
Cohesion: 0.32
Nodes (7): args, findTestsWithTag(), fs, glob, main(), path, writeToSubsetFile()

### Community 22 - "Dashboards Registry Test Data"
Cohesion: 0.43
Nodes (5): DashboardEntry, DASHBOARDS, nameFromUrl(), resolveServiceName(), outRoot

### Community 27 - "Archive Helper"
Cohesion: 0.50
Nodes (3): adm-zip, readZipArchive(), adm-zip

## Knowledge Gaps
- **119 isolated node(s):** `root`, `node`, `es2021`, `parser`, `playwright` (+114 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `ESLint/Build Tooling Deps` to `package.json Metadata`, `Archive Helper`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 36`, `Community 37`, `Community 38`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 44`, `Community 45`, `Community 46`, `Community 47`, `Community 48`, `Community 49`, `Community 50`, `Community 51`?**
  _High betweenness centrality (0.185) - this node is a cross-community bridge._
- **Why does `readZipArchive()` connect `Archive Helper` to `pmmTest Fixture and MongoDB Helper`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **Why does `adm-zip` connect `Archive Helper` to `ESLint/Build Tooling Deps`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **What connects `root`, `node`, `es2021` to the rest of the system?**
  _119 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard and Grafana Panel Interfaces` be split into smaller, more focused modules?**
  _Cohesion score 0.10699062233589088 - nodes in this community are weakly interconnected._
- **Should `Alerting and Access Control API` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `Inventory API and Metrics Helpers` be split into smaller, more focused modules?**
  _Cohesion score 0.08658536585365853 - nodes in this community are weakly interconnected._
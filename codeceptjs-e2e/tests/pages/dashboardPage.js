/* eslint-disable import/no-useless-path-segments */
const { I, adminPage } = inject();
const assert = require('assert');
const { DashboardPanelMenu } = require('./dashboards/components/DashboardPanelMenu');
const PmmHealthDashboard = require('./dashboards/experimental/pmmHealthDashboard');
const HomeDashboard = require('./dashboards/homeDashboard');
const PostgresqlTopQueriesDashboard = require('./dashboards/pgsql/postgresqlTopQueriesDashboard');
const PostgresqlInstancesOverviewExtendedDashboard = require('./dashboards/pgsql/postgresqlInstancesOverviewExtendedDashboard');
const MongodbPBMDetailsDashboard = require('./dashboards/mongodb/mongodbPBMDetailsDashboard');
const PostgresqlInstanceOverviewDashboard = require('./dashboards/pgsql/postgresqlInstanceOverviewDashboard');
const PostgresqlInstanceSummaryDashboard = require('./dashboards/pgsql/postgresqlInstanceSummaryDashboard');
const PostgresqlCheckpointDashboard = require('./dashboards/pgsql/postgresqlCheckpointDashboard');
const PostgresqlReplicationOverviewDashboard = require('./dashboards/pgsql/postgresqlReplicationOverviewDashboard');
const PostgresqlPatroniDashboard = require('./dashboards/pgsql/postgresqlPatroniDashboard');
const MongodbShardedClusterSummary = require('../pages/dashboards/mongodb/mongodbShardedClusterSummary');
const MySQLMyRocksDetailsDashboard = require('../pages/dashboards/mysql/mySQLMyRocksDetailsDashboard');
const { locateOption } = require('../helper/locatorHelper');
const MongodbInstancesCompareDashboard = require('../dashboards/pages/mongodb/mongodbInstancesCompareDashboard');
const ValkeyOverviewDashboard = require('../pages/dashboards/valkey/valkeyOverviewDashboard');
const ValkeyClientsDashboard = require('../pages/dashboards/valkey/valkeyClientsDashboard');
const ValkeyClusterDetailsDashboard = require('../pages/dashboards/valkey/valkeyClusterDetailsDashboard');
const ValkeyCommandDetailDashboard = require('../pages/dashboards/valkey/valkeyCommandDetailDashboard');
const ValkeyLoadDashboard = require('../pages/dashboards/valkey/valkeyLoadDashboard');
const ValkeyMemoryDashboard = require('../pages/dashboards/valkey/valkeyMemoryDashboard');
const ValkeyNetworkDashboard = require('../pages/dashboards/valkey/valkeyNetworkDashboard');
const ValkeyPersistenceDetailsDashboard = require('../pages/dashboards/valkey/valkeyPersistenceDetailsDashboard');
const ValkeyReplicationDashboard = require('../pages/dashboards/valkey/valkeyReplicationDashboard');
const ValkeySlowlogDashboard = require('../pages/dashboards/valkey/valkeySlowlogDashboard');

module.exports = {
  // insert your locators and methods here
  // setting locators
  slowQueriesText: locate('//section[contains(@data-testid, "Panel header Slow Queries") or contains(@data-testid, "Panel header Slow queries")]//div[@data-testid="TextPanel-converted-content"]'),
  slowQueriesValue: locate('//section[contains(@data-testid, "Panel header Slow Queries") or contains(@data-testid, "Panel header Slow queries")]//div[@data-testid="TextPanel-converted-content"]//span'),
  serviceNameDropdown:
    '//label[contains(text(), "Service Name")]/following-sibling::div',
  serviceName:
    '//label[contains(text(), "Service Name")]/following-sibling::div',
  serviceNameInput:
    '//input[@aria-controls="options-service_name"]',
  toggleAllValues: '[aria-label="Toggle all values"]',
  panel: 'div[data-viz-panel-key]',
  systemUptimePanel: (nodeName) => `//div[@class="panel-title"]//h2[text()="${nodeName} - System Uptime"]`,
  nodesCompareDashboard: {
    url: 'graph/d/node-instance-compare/nodes-compare?orgId=1&refresh=1m&from=now-5m&to=now',
    cleanUrl: 'graph/d/node-instance-compare/nodes-compare',
    metrics: [
      'System Info',
      'System Uptime',
      'CPU Cores',
      'RAM',
      'Saturation Metrics',
      'Load Average',
      'CPU Usage',
      'Interrupts',
      'Context Switches',
      'Memory Usage',
      'Swap Usage',
      'Swap Activity',
      'Mountpoint Usage',
      'Free Space',
      'Disk Operations',
      'Disk Bandwidth',
      'Disk IO Utilization',
      'Disk Latency',
      'Disk Load',
      'Network Traffic',
      'Network Utilization Hourly',
      'Load Average',
      'I/O Activity',
    ],
  },
  advancedDataExplorationDashboard: {
    url:
      'graph/d/prometheus-advanced/advanced-data-exploration?orgId=1&refresh=1m&var-metric=go_gc_duration_seconds',
    cleanUrl: 'graph/d/prometheus-advanced/advanced-data-exploration',
    metrics: [
      'View Actual Metric Values (Gauge)',
      'View Metric Rate of Change (Counter)',
      'Metric Rates',
      'Metric Data Table',
    ],
  },
  prometheusDashboard: {
    url: 'graph/d/prometheus/prometheus',
    metrics: [
      'Prometheus Process CPU Usage',
      'Prometheus Process Memory Usage',
      'Disk Space Utilization',
      'Time before run out of space',
      'Avg Chunk Time',
      'Samples Per Chunk',
      'Avg Chunk Size',
      'Bytes/Sample',
      'Head Block Size',
      'Avg Compaction Time',
      'WAL Fsync Time',
      'Head GC Latency',
      'Active Data Blocks',
      'Head Block',
      'Chunk Activity',
      'Reload block data from disk',
      'Compactions',
      'Ingestion',
      'Prometheus Targets',
      'Scraped Target by Job',
      'Scrape Time by Job',
      'Scraped Target by Instance',
      'Scrape Time by Instance',
      'Scrapes by Target Frequency',
      'Scrape Frequency Versus Target',
      'Scraping Time Drift',
      'Prometheus Scrape Interval Variance',
      'Slowest Job',
      'Largest Samples Job',
      'Prometheus Queries',
      'Prometheus Query Execution',
      'Prometheus Query Execution Latency',
      'Prometheus Query Execution Load',
      'HTTP Requests duration by Handler',
      'HTTP Response Average Size by Handler',
      'Top 10 metrics by time series count',
      'Top 10 hosts by time series count',
      'CPU Busy',
      'Mem Avail',
      'Disk Reads',
      'Disk Writes',
      'Network IO',
      'Sys Uptime',
    ],
  },
  prometheusExporterStatusDashboard: {
    url: 'graph/d/prometheus-status/prometheus-exporter-status?orgId=1&refresh=1m&from=now-5m&to=now',
    cleanUrl: 'graph/d/prometheus-status/prometheus-exporter-status',
    metrics: [
      'CPU Usage',
      'Memory Usage',
      'File Descriptors Used',
      'Exporter Uptime',
      'Collector Scrape Successful',
      'Collector Execution Time (Log Scale)',
      'Collector Execution Time',
      'MySQL Exporter Errors',
      'Rate of Scrapes',
      'MySQL up',
      'MongoDB Scrape Performance',
      'MongoDB Exporter Errors',
      'MongoDB up',
      'ProxySQL Scrape Performance',
      'ProxySQL Exporter Errors',
      'ProxySQL up',
      'Scrape Durations',
    ],
  },
  processDetailsDashboard: {
    url: 'graph/d/node-cpu-process/processes-details?from=now-45m&to=now',
  },
  nodeSummaryDashboard: {
    url: 'graph/d/node-instance-summary/node-summary',
    metrics: [
      'System Uptime',
      'System Summary',
      'Virtual CPUs',
      'Load Average',
      'RAM',
      'Memory Available',
      'CPU Usage',
      'CPU Saturation and Max Core Usage',
      'Interrupts and Context Switches',
      'Processes',
      'Memory Utilization',
      'Virtual Memory Utilization',
      'Swap Space',
      'Swap Activity',
      'I/O Activity',
      'Global File Descriptors Usage',
      'Disk IO Latency',
      'Disk IO Load',
      'Network Traffic',
      'Local Network Errors',
      'TCP Retransmission',
    ],
    ptSummaryDetail: {
      reportContainer: '//pre',
      ptHeaderText: '# Percona Toolkit System Summary Report ######################',
      remoteNodeText: 'No pmm-agent running on this node',
    },
  },
  prometheusExporterOverviewDashboard: {
    url: 'graph/d/prometheus-overview/prometheus-exporters-overview?orgId=1&refresh=1m&from=now-5m&to=now',
    cleanUrl: 'graph/d/prometheus-overview/prometheus-exporters-overview',
    metrics: [
      'Avg CPU Usage per Node',
      'Avg Memory Usage per Node',
      'Monitored Nodes',
      'Exporters Running',
      'CPU Usage',
      'Memory Usage',
      'CPU Cores Used',
      'CPU Used',
      'Mem Used',
      'Virtual CPUs',
      'RAM',
      'File Descriptors Used',
    ],
  },
  sharePanel: {
    elements: {
      imageRendererPluginInfoText: I.useDataQA('data-testid Alert info'),
      imageRendererPluginLink: locate(I.useDataQA('data-testid Alert info')).find('.external-link'),
    },
    messages: {
      imageRendererPlugin: 'Image renderer plugin not installedTo render a panel image, you must install the Image Renderer plugin. Please contact your PMM administrator to install the plugin.',
    },
  },
  proxysqlInstanceSummaryDashboard: {
    url: 'graph/d/proxysql-instance-summary/proxysql-instance-summary',
    metrics: [
      'Hostgroup Size',
      'Client Connections',
      'Client Questions',
      'Active Backend Connections',
      'Failed Backend Connections',
      'Top 30 Active Frontend Connections',
      'Client Frontend Connections',
      'Endpoint Status',
      'Queries Routed',
      'Query processor time efficiency',
      'Connection Free',
      'Endpoints Latency',
      'Executed Queries',
      'Queries Execution Time',
      'Queries Latency',
      // instead of 6 metrics, one metric 'Commands Latency All' is visible
      // 'Commands Latency - CREATE_TEMPORARY',//*
      // 'Commands Latency - DELETE',//*
      // 'Commands Latency - INSERT',//*
      // 'Commands Latency - SELECT',//*
      // 'Commands Latency - SELECT_FOR_UPDATE',//*
      // 'Commands Latency - UPDATE',//*
      'Query Cache memory',
      'Query Cache efficiency',
      'Network Traffic',
      'Mirroring efficiency',
      'Memory Utilization',
      'Memory Usage',
      'System Uptime',
      'Load Average',
      'RAM',
      'Memory Available',
      'Virtual Memory',
      'Disk Space',
      'Min Space Available',
      'Node',
      'CPU Usage',
      'CPU Saturation and Max Core Usage',
      'Disk I/O and Swap Activity',
      'Network Traffic',
    ],
  },
  pxcGaleraClusterSummaryDashboard: {
    url: 'graph/d/pxc-cluster-summary/pxc-galera-cluster-summary?orgId=1&',
    metrics: [
      'Percona XtraDB / Galera Cluster Size',
      'Flow Control Paused Time',
      'Flow Control Messages Sent',
      'Writeset Inbound Traffic',
      'Writeset Outbound Traffic',
      'Receive Queue',
      'Send Queue',
      'Transactions Received',
      'Transactions Replicated',
      'Average Incoming Transaction Size',
      'Average Replicated Transaction Size',
      'Average Galera Replication Latency',
      'Maximum Galera Replication Latency',
    ],
  },
  pxcGaleraClusterSummaryExperimentalDashboard: {
    url: 'graph/d/pxc_galera_cluster_summary/pxc-galera-cluster-summary-experimental',
    metrics: [
      'Number of clusters',
      'Services',
      'Node Size',
      'Active Alerts',
      'Cluster Summary',
      'Service Summary',
      'Query / second (QPS)',
      'Used Connections',
      'Aborted Connections',
      'Receive Queue',
      'Send Queue',
      'Flow Control',
      'Flow Control Paused Time',
      'Flow Control Messages Sent',
      'Writeset Inbound Traffic',
      'Writeset Outbound Traffic',
      'Total Bytes In/Out - Backend and Frontend',
      'Transactions Received',
      'Transactions Replicated',
      'Average Incoming Transaction Size',
      'Average Replicated Transaction Size',
      'CPU Busy All',
      'Memory Busy All',
      'Storage All',
      'Network IO All',
      'Client Thread Activity',
      'Thread Cache',
      'Temporary Objects',
      'MySQL Select Types',
      'MySQL Handlers',
      'InnoDB Data Reads',
      'InnoDB Data Writes',
      'InnoDB FSyncs',
      'InnoDB Locking',
      'Galera Replication Latency',
      'Average Galera Replication Latency',
      'Maximum Galera Replication Latency',
    ],
  },
  ValkeyOverviewDashboard: ValkeyOverviewDashboard,
  ValkeyClientsDashboard: ValkeyClientsDashboard,
  ValkeyClusterDetailsDashboard: ValkeyClusterDetailsDashboard,
  ValkeyCommandDetailDashboard: ValkeyCommandDetailDashboard,
  ValkeyLoadDashboard: ValkeyLoadDashboard,
  ValkeyMemoryDashboard: ValkeyMemoryDashboard,
  ValkeyNetworkDashboard: ValkeyNetworkDashboard,
  ValkeyPersistenceDetailsDashboard: ValkeyPersistenceDetailsDashboard,
  ValkeyReplicationDashboard: ValkeyReplicationDashboard,
  ValkeySlowlogDashboard: ValkeySlowlogDashboard,
  mySQLMyRocksDetailsDashboard: MySQLMyRocksDetailsDashboard,
  postgresqlInstanceSummaryDashboard: PostgresqlInstanceSummaryDashboard,
  postgresqlCheckpointDashboard: PostgresqlCheckpointDashboard,
  postgresqlReplicationOverviewDashboard: PostgresqlReplicationOverviewDashboard,
  postgresqlPatroniDashboard: PostgresqlPatroniDashboard,
  postgresqlInstanceCompareDashboard: {
    url: 'graph/d/postgresql-instance-compare/postgresql-instances-compare?orgId=1&from=now-5m&to=now',
    cleanUrl: 'graph/d/postgresql-instance-compare/postgresql-instances-compare',
    metrics: [
      'Service Info',
      'PostgreSQL Connections',
      'Active Connections',
      'Tuples',
      'Transactions',
    ],
  },
  postgresqlInstanceOverviewDashboard: PostgresqlInstanceOverviewDashboard,
  mongodbPBMDetailsDashboard: MongodbPBMDetailsDashboard,
  mongodbOverviewDashboard: {
    url: 'graph/d/mongodb-instance-summary/mongodb-instance-summary',
    metrics: [
      'Node',
      'MongoDB Uptime',
      'QPS',
      'Latency',
      'ReplSet',
      'Current ReplSet State',
      'Command Operations',
      'Latency Detail',
      'Connections',
      'Cursors',
      'Document Operations',
      'Queued Operations',
      'Query Efficiency',
      'Scanned and Moved Objects',
      'getLastError Write Time',
      'getLastError Write Operations',
      'Assert Events',
      'Page Faults',
      'System Uptime',
      'Load Average',
      'RAM',
      'Memory Available',
      'Virtual Memory',
      'Disk Space',
      'Min Space Available',
      'Node',
      'CPU Usage',
      'CPU Saturation and Max Core Usage',
      'Disk I/O and Swap Activity',
      'Network Traffic',
    ],
  },
  mongoDbShardedClusterSummary: MongodbShardedClusterSummary,
  mongoDbInstanceSummaryDashboard: {
    url: 'graph/d/mongodb-instance-summary/mongodb-instance-summary?orgId=1&refresh=1m&from=now-5m&to=now',
    clearUrl: 'graph/d/mongodb-instance-summary/mongodb-instance-summary',
  },
  mysqlInstanceSummaryDashboard: {
    url: 'graph/d/mysql-instance-summary/mysql-instance-summary?orgId=1&refresh=1m&from=now-5m&to=now',
    clearUrl: 'graph/d/mysql-instance-summary/mysql-instance-summary',
    metrics: [
      'Node',
      'MySQL Uptime',
      'Version',
      'Current QPS',
      'InnoDB Buffer Pool Size',
      'Buffer Pool Size of Total RAM',
      'Service Summary',
      'MySQL Connections',
      'MySQL Aborted Connections',
      'MySQL Client Thread Activity',
      'MySQL Thread Cache',
      'MySQL Temporary Objects',
      'MySQL Slow Queries',
      'MySQL Select Types',
      'MySQL Sorts',
      'MySQL Table Locks',
      'MySQL Questions',
      'MySQL Network Traffic',
      'MySQL Network Usage Hourly',
      'MySQL Internal Memory Overview',
      'Top Command Counters',
      'Top Command Counters Hourly',
      'MySQL Handlers',
      'MySQL Transaction Handlers',
      'Process States',
      'Top Process States Hourly',
      'MySQL Query Cache Memory',
      'MySQL Query Cache Activity',
      'MySQL File Openings',
      'MySQL Open Files',
      'MySQL Table Open Cache Status',
      'MySQL Open Tables',
      'MySQL Table Definition Cache',
    ],
  },
  mongodbInstancesCompareDashboard: MongodbInstancesCompareDashboard,
  mysqlUserDetailsDashboard: {
    url: 'graph/d/mysql-user/mysql-user-details?orgId=1&refresh=1m&from=now-5m&to=now',
    clearUrl: 'graph/d/mysql-user/mysql-user-details',
    metrics: [
      'Active Users',
      'Lost Connections',
      'Denied Connections',
      'Access Denied',
      'Users Activity',
      'Users by Connections Created',
      'Users by Concurrent Connections',
      'Users by Lost Connections',
      'Top Users by Denied Connections',
      'Users by Busy Load',
      'Users by CPU Time',
      'Users by Traffic',
      'Users by Bytes Written to The Binary Log',
      'Rows Fetched',
      'Rows Read',
      'Rows Updated',
      'Users by Rows Fetched/Read',
      'Users by Rows Updated',
      'Users by Rollback Transactions',
      'Users by Commit Transactions',
      'Users by Update Commands',
      'Users by Select Commands',
      'Users by Other Commands',
      'Users by Access Denied',
      'Users by Empty Queries',
      'MySQL Uptime',
      'Version',
      'Current QPS',
      'File Handlers Used',
      'Table Open Cache Miss Ratio',
      'Table Open Cache Size',
      'Table Definition Cache Size',
      'Service',
      'MySQL Connections',
      'MySQL Client Thread Activity',
      'MySQL Handlers',
      'Top Command Counters',
      'Process States',
      'MySQL Network Traffic',
      'System Uptime',
      'Load Average',
      'RAM',
      'Memory Available',
      'Virtual Memory',
      'Disk Space',
      'Min Space Available',
      'Node',
      'CPU Usage',
      'CPU Saturation and Max Core Usage',
      'Disk I/O and Swap Activity',
      'Network Traffic',
    ],
  },
  mongoDbInstanceOverview: {
    url: 'graph/d/mongodb-instance-overview/mongodb-instances-overview?orgId=1&refresh=1m',
    clearUrl: 'graph/d/mongodb-instance-overview/mongodb-instances-overview',
    metrics: [
      'Services',
      'Min MongoDB Uptime',
      'Total Used Resident Memory',
      'Total Used Virtual Memory',
      'Total Used Mapped Memory',
      'Total Current QPS',
      'Top Connections',
      'Top Opened Cursors',
      'Min QPS',
      'Max Latency',
      'Top 5 Connections',
      'Current Connections',
      'Top 5 Total Cursors',
      'Total Cursors',
      'Pinned Cursors',
      'Pinned Cursors',
      'Top 5 noTimeout Cursors',
      'noTimeout Cursors',
      'Top 5 Command Latency',
      'Command Latency',
      'Top 5 Read Latency',
      'Read Latency',
      'Top 5 Write Latency',
      'Write Latency',
      'Min Index Scanned Ratio',
      'Max Index Scanned Ratio',
      'Min Document Scanned Ratio',
      'Max Document Scanned Ratio',
      'Top 5 Index Scan Ratios',
      'Index Scan Ratios',
      'Top 5 Document Scan Ratios',
      'Document Scan Ratios',
      'Top 5 Index Filtering Effectiveness',
      'Index Filtering Effectiveness',
      'Top Opcounters',
      'Top Document Operations',
      'Top Queued Operations',
      'Total Assert Events',
      'Top 5 Command Operations',
      'Command Operations',
      'Top 5 Getmore Operations',
      'Getmore Operations',
      'Top 5 Delete Operations',
      'Delete Operations',
      'Top 5 Insert Operations',
      'Insert Operations',
      'Top 5 Update Operations',
      'Update Operations',
      'Top 5 Query Operations',
      'Query Operations',
      'Top 5 Document Delete Operations',
      'Document Delete Operations',
      'Top 5 Document Insert Operations',
      'Document Insert Operations',
      'Top 5 Document Return Operations',
      'Document Return Operations',
      'Top 5 Document Update Operations',
      'Document Update Operations',
      'Top 5 Queued Read Operations',
      'Queued Read Operations',
      'Top 5 Queued Write Operations',
      'Queued Write Operations',
      'Top 5 Assert Msg Events',
      'Assert Msg Events',
      'Top 5 Assert Regular Events',
      'Assert Regular Events',
      'Top 5 Assert Rollovers Events',
      'Assert Rollovers Events',
      'Top 5 Assert User Events',
      'Assert User Events',
      'Top 5 Assert Msg Events',
      'Assert Warning Events',
    ],
  },
  mySQLInstanceOverview: {
    url: 'graph/d/mysql-instance-overview/mysql-instances-overview?orgId=1&from=now-2m&to=now&refresh=1m',
    clearUrl: 'graph/d/mysql-instance-overview/mysql-instances-overview',
    metrics: [
      'Services',
      'Min MySQL Uptime',
      'Max MySQL Uptime',
      'Total Current QPS',
      'Total InnoDB Buffer Pool Size',
      'Top MySQL Used Connections',
      'Top MySQL Client Threads Connected',
      'Top MySQL Idle Client Threads',
      'Top MySQL Threads Cached',
      'Top 5 MySQL Used Connections',
      'MySQL Used Connections',
      'Top 5 MySQL Aborted Connections',
      'Aborted Connections',
      'Top 5 MySQL Client Threads Connected',
      'MySQL Client Threads Connected',
      'Top 5 MySQL Active Client Threads',
      'MySQL Idle Client Threads',
      'Top 5 MySQL Thread Cached',
      'Percentage of Cached MySQL Threads',
      'Top MySQL Queries',
      'Top MySQL Questions',
      'Top InnoDB I/O Data Reads',
      'Top InnoDB I/O Data Writes',
      'Top Data Fsyncs',
      'Top 5 MySQL Queries',
      'MySQL QPS',
      'Top 5 MySQL Questions',
      'MySQL Questions in Queries',
      'Top 5 Data Reads',
      'Percentage of Data Read',
      'Top 5 Data Writes',
      'Percentage of Data Writes',
      'Top 5 Data Fsyncs',
      'Percentage of Data Fsyncs',
      'Top MySQL Questions',
      'Top MySQL Selects',
      'Top MySQL Sorts',
      'Top MySQL Aborted Connections',
      'Top MySQL Table Locks',
      'MySQL Temporary Objects',
      'Top 5 MySQL Selects',
      'MySQL Selects',
      'Top 5 MySQL Sorts',
      'MySQL Sorts',
      'Top 5 MySQL Table Locks',
      'MySQL Table Locks',
      'Top MySQL Incoming Network Traffic',
      'Top MySQL Outgoing Network Traffic',
      'Top MySQL Used Query Cache',
      'Top Percentage of File Openings to Opened Files',
      'Top Percentage of Opened Files to the Limit',
      'Top 5 MySQL Incoming Network Traffic',
      'Top 5 MySQL Outgoing Network Traffic',
      'MySQL Query Cache Size',
      'MySQL Used Query Cache',
      'Top 5 MySQL File Openings',
      'Percentage of File Openings to Opened Files',
      'Top 5 MySQL Opened Files',
      'Percentage of Opened Files to the Limit',
      'Top Open Cache Miss Ratio',
      'Min MySQL Opened Table Definitions',
      'Top MySQL Opened Table Definitions',
      'Top MySQL Open Table Definitions',
      'Top Open Table Definitions to Definition Cache',
      'Lowest 5 Open Cache Hit Ratio',
      'Open Cache Miss Ratio',
      'MySQL Table Definition Cache',
      'Top 5 MySQL Opened Table Definitions',
      'Top 5 MySQL Open Table Definitions',
      'Percentage of Open Table Definitions to Table Definition Cache',
    ],
    urlWithRDSFilter:
      'graph/d/mysql-instance-overview/mysql-instances-overview?orgId=1&'
      + 'from=now-5m&to=now&refresh=1m&var-interval=$__auto_interval_interval&var-region=All&'
      + 'var-environment=All&var-cluster=rds57-cluster&var-replication_set=All&var-az=&'
      + 'var-node_type=All&var-node_model=&var-database=All&var-service_type=All&var-schema=All',
  },
  mysqlInstancesCompareDashboard: {
    url: 'graph/d/mysql-instance-compare/mysql-instances-compare?orgId=1&refresh=1m&from=now-5m&to=now',
    clearUrl: 'graph/d/mysql-instance-compare/mysql-instances-compare',
    metrics: [
      'Service Info',
      'MySQL Uptime',
      'Current QPS',
      'DB Connections',
      'InnoDB Buffer Pool Size',
      'Buffer Pool Size of Total RAM',
      'MySQL Connections',
      'MySQL Aborted Connections',
      'MySQL Questions',
      'MySQL Client Thread Activity',
      'MySQL Thread Cache',
      'MySQL Temporary Objects',
      'MySQL Select Types',
      'MySQL Slow Queries',
      'MySQL Sorts',
      'MySQL Table Locks',
      'MySQL Network Traffic',
      'MySQL Network Usage Hourly',
      'MySQL Internal Memory Overview',
      'Top Command Counters',
      'Top Command Counters Hourly',
      'MySQL Handlers',
      'MySQL Transaction Handlers',
      'Process States',
      'Top 5 Process States Hourly',
      'MySQL Query Cache Memory',
      'MySQL Query Cache Activity',
      'MySQL File Openings',
      'MySQL Open Files',
      'MySQL Table Open Cache Status',
      'MySQL Open Tables',
      'MySQL Table Definition Cache',
    ],
  },
  mysqlReplcationDashboard: {
    url: '/graph/d/mysql-replicaset-summary/mysql-replication-summary?orgId=1&refresh=1m',
    clearUrl: '/graph/d/mysql-replicaset-summary/mysql-replication-summary',
    metrics: [
      'Node',
      'IO Thread Running',
      'SQL Thread Running',
      'Replication Error No',
      'Read Only',
      'Replication Delay',
      'MySQL Replication Lag',
      'Binlogs Size',
      'Binlog Data Written Hourly',
      'Binlogs Count',
      'Binlogs Created Hourly',
      'Relay Log Space',
      'Relay Log Written Hourly',
    ],
  },
  groupReplicationDashboard: {
    url: 'graph/d/mysql-group-replicaset-summary/mysql-group-replication-summary?orgId=1&refresh=1m',
    clearUrl: 'graph/d/mysql-group-replicaset-summary/mysql-group-replication-summary',
    metrics: [
      'Group Replication Service States',
      'PRIMARY Service',
      'Replication Group Members',
      'Replication Lag',
      'Transport Time',
      'Replication Delay',
      'Transaction Apply Time',
      'Transaction Time Inside the Local Queue',
      'Checked Transactions',
      'Transactions Row Validating',
      'Applied Transactions',
      'Sent Transactions',
      'Received Transactions Queue',
      'Rolled Back Transactions',
      'Transactions in the Queue for Checking',
      'Detected Conflicts',
    ],
  },
  mysqlPXCGaleraNodeSummaryDashboard: {
    url: 'graph/d/pxc-node-summary/pxc-galera-node-summary?orgId=1&refresh=1m',
    clearUrl: 'graph/d/pxc-node-summary/pxc-galera-node-summary',
    metrics: [
      'Ready to Accept Queries',
      'Local State',
      'Desync Mode',
      'Cluster Status',
      'gcache Size',
      'FC (normal traffic)',
      'Galera Replication Latency',
      'Galera Replication Queues',
      'Galera Cluster Size',
      'Galera Flow Control',
      'Galera Parallelization Efficiency',
      'Galera Writing Conflicts',
      'Available Downtime before SST Required',
      'Galera Writeset Count',
      'Galera Writeset Size',
      'Galera Writeset Traffic',
      'Galera Network Usage Hourly',
    ],
  },
  mysqlPXCGaleraNodesCompareDashboard: {
    url: 'graph/d/pxc-nodes-compare/pxc-galera-nodes-compare?orgId=1&refresh=1m',
    clearUrl: 'graph/d/pxc-nodes-compare/pxc-galera-nodes-compare',
    metrics: [
      'Ready to Accept Queries',
      'Local State',
      'Desync Mode',
      'Cluster Status',
      'gcache Size',
      'FC (normal traffic)',
    ],
    tabs: [
      'Galera Replication Latency',
      'Galera Replication Queues',
      'Galera Flow Control',
      'Galera Writing Conflicts',
      'Galera Writeset Count',
      'Galera Writeset Traffic',
      'Galera Parallelization Efficiency',
      'Available Downtime before SST Required',
      'Galera Writeset Size',
      'Galera Network Usage Hourly',
    ],
  },
  victoriaMetricsDashboard: {
    url: 'graph/d/victoriametrics/victoriametrics?orgId=1',
    metrics: [
      'Uptime',
      'Version',
      'CPU Usage',
      'Memory Usage',
      'Disk Usage',
      'Total Datapoints',
      'Index Size',
      'Concurrent Inserts',
      'Cache Memory Usage',
      'Time before run out of space',
      'Requests',
      'Active Time Series Changes',
      'Queries Duration',
      'Queries Duration Details',
      'Cache Memory Usage',
      'Cache Size',
      'Concurrent Inserts',
      'Error Requests',
      'Disk Space Usage - Datapoints',
      'Disk Space Usage - Index',
      'Datapoints Ingestions',
      'Pending Datapoints',
      'Datapoints',
      'LSM Parts',
      'Active Merges',
      'Merge speed',
      'TCP Connections',
      'Ignored Rows',
      'Logging Messages',
      'Churn Rate',
      'Slow Queries',
      'Slow Inserts',
      'Memory Usage',
      'Time Series',
      'Top 10 metrics by time series count',
      'Top 10 hosts by time series count',
      'Flags',
      'CPU Busy',
      'Mem Avail',
      'Disk Reads',
      'Disk Writes',
      'Network IO',
      'Sys Uptime',
    ],
  },
  mongodbReplicaSetSummaryDashboard: {
    url: 'graph/d/mongodb-replicaset-summary/mongodb-replset-summary?orgId=1&refresh=1m&from=now-5m&to=now',
    cleanUrl: 'graph/d/mongodb-replicaset-summary/mongodb-replset-summary',
    metrics: [
      'Feature Compatibility Version',
      'Nodes',
      'DBs',
      'Last Election',
      'Node States',
      'Top Hottest Collections by Read',
      'Query execution times',
      'Top Hottest Collections by Write',
      'Query Efficiency',
      'Queued Operations',
      'Reads & Writes',
      'Connections',
      'Size of Collections',
      'Number of Collections',
      'Replication Lag',
      'Oplog Recovery Window',
      'Flow Control',
      'Nodes Overview',
      'CPU Usage',
      'CPU Saturation and Max Core Usage',
      'Disk I/O and Swap Activity',
      'Network Traffic',
    ],
  },
  victoriaMetricsAgentsOverviewDashboard: {
    url: 'graph/d/vmagent/victoriametrics-agents-overview?orgId=1&refresh=5m',
    metrics: [
      'Current Uptime',
      'Scraped Targets UP',
      'Scraped Samples',
      'Dropped Samples',
      'Logged Errors',
      'Uptime',
      'Scraped Samples',
      'Remotely  Written Samples',
      'Dropped Samples (Persistent Queue)',
      'Persistent Queue Size',
      'Dropped Samples (Relabeling)',
      'HTTP Requests',
      'Logged Errors/Warnings',
      'HTTP Requests Details',
      'HTTP Errors',
      'Scrapes',
      'Samples',
      'Scrapes p0.95 Response Size',
      'Timeout Scrapes',
      'Failed Scrapes',
      'Dial Errors',
      'Gunzip Failed Scrapes',
      'Scrapes Duration',
      'Write Requests',
      'Write Errors',
      'Parsed Rows',
      'Dropped Invalid Rows',
      'Remote Write Requests',
      'Remote Write Size',
      'Block Size Rows',
      'Block Size in Bytes',
      'Requests Retry Rate',
      'Established Connections',
      'Remote Write Duration',
      'CPU Usage',
      'Memory Usage',
      'Threads',
      'Network  Usage',
    ],
  },

  mysqlAmazonAuroraDetails: {
    url: 'graph/d/mysql-amazonaurora/mysql-amazon-aurora-details?orgId=1&refresh=1m',
    metrics: [
      'Amazon Aurora Transaction Commits',
      'Amazon Aurora Load',
      'Aurora Memory Used',
      'Amazon Aurora Statement Latency',
      'Amazon Aurora Special Command Counters',
      'Amazon Aurora Problems',
    ],
  },

  mongoDbCollectionDetails: {
    url: 'graph/d/mongodb-collection-details/mongodb-collection-details?orgId=1&refresh=1m',
    clearUrl: 'graph/d/mongodb-collection-details/mongodb-collection-details',
    metrics: [
      'Top 10 Largest Collections by Document Count',
      'Top 10 Largest Collections by Size',
      'Total Databases Size',
      'Top 5 Most Fragmented Collections by Freeable Size',
      'Top 5 Collections by Documents Read',
      'Top 5 Collections by Documents Changed',
    ],
  },
  mongoDbCollectionsOverview: {
    url: 'graph/d/mongodb-collections-overview/mongodb-collections-overview?orgId=1&refresh=1m',
    clearUrl: 'graph/d/mongodb-collections-overview/mongodb-collections-overview',
    metrics: [
      'Top 5 Databases By Size',
      'Collections in Database',
      'Indexes in Database',
      'Avg Object Size in Database',
      'Index Size in Database',
      'Data Size for Database',
      'Top 5 Hottest Collections by Read  (Total)',
      'Top 5 Hottest Collections by Write (Total)',
      'Top 5 Hottest Collections by Read (Rate)',
      'Top 5 Hottest Collections by Write (Rate)',
      'Collections statistics  for All (rate)',
      'Collections statistics  for All (summary)',
      'Collections statistics  admin',
      'Collections statistics  config',
    ],
  },

  mongoDbOplogDetails: {
    url: 'graph/d/mongodb-oplog-details/mongodb-oplog-details?orgId=1&refresh=1m',
    clearUrl: 'graph/d/mongodb-oplog-details/mongodb-oplog-details',
    metrics: [
      'Oplog Recovery Window',
      'Oplog Buffered Operations',
      'Oplog Getmore Time',
      'Oplog Processing Time',
      'Oplog Buffer Capacity',
      'Oplog Operations',
      'Oplog GB/Hour',
    ],
  },

  osDiskDetails: {
    noDataElements: 3,
    naElements: 0,
    clearUrl: 'graph/d/node-disk/disk-details',
    metrics: [
      'Mountpoint Usage',
      'Disk Latency',
      'Disk Operations',
      'Disk Bandwidth',
      'Disk Load',
      'Disk IO Utilization',
      'Avg Disks Operations Merge Ratio',
      'Disk IO Size',
    ],
  },

  osMemoryDetails: {
    noDataElements: 6,
    naElements: 0,
    clearUrl: 'graph/d/node-memory/memory-details',
    metrics: [
      'Memory Usage',
      'Free Memory Percent',
      'Total Pages Size',
      'Anonymous Memory Size',
      'File Cache Memory Size',
      'Swap Activity',
      'Swap Space',
      'Memory Usage Types',
      'Vmalloc',
      'Shared Memory',
      'Kernel Memory Stack',
      'Committed Memory',
      'Non-file Backed Pages Size',
      'Kernel Cache',
      'DirectMap Pages',
      'Bounce Memory',
      'NFS Pages Size',
      'Unevictable/MLocked Memory',
      'Huge Pages Size',
      'HugePages Statistic',
      'Memory Pages',
      'IO activity',
      'Cache Pages',
      'Anonymous Memory Pages',
      'Shmem Pages',
      'Dirty Pages',
      'Pages Allocated to Page Tables',
      'Bounce Buffer Pages',
      'Misc Pages',
      'Pages Mapped by Files',
      'Kernel Stack Pages',
      'Slab Pages',
      'Allocations',
      'Refill',
      'Direct Scan',
      'Kswapd Scan',
      'Steal Direct',
      'Steal Kswapd',
    ],
  },
  pmmHealth: PmmHealthDashboard,
  homeDashboard: HomeDashboard,
  postgresqlTopQueriesDashboard: PostgresqlTopQueriesDashboard,
  postgresqlInstancesOverviewExtendedDashboard: PostgresqlInstancesOverviewExtendedDashboard,
  osNodesOverview: {
    noDataElements: 3,
    clearUrl: 'graph/d/node-instance-overview/nodes-overview',
    metrics: [
      'Nodes',
      'Min Node Uptime',
      'DB Instances',
      'Min DB Uptime',
      'Total Virtual CPUs',
      'Total RAM',
      'Virtual Memory Total',
      'Disk Space Total',
      'Regions',
      'Types',
      'Nodes',
      'Regions',
      'Service Types',
      'Services',
      'Top Usage',
      'Top Steal',
      'Top I/O Wait',
      'Top Saturation',
      'Top Switches',
      'Top Load',
      'Top Runnable Procs',
      'Top Blocked Procs',
      'Top 5 CPU Usage',
      'CPU Usage',
      'Top 5 CPU Steal',
      'CPU Steal',
      'Top 5 CPU I/O Wait',
      'CPU I/O Wait',
      'Top 5 CPU Saturation',
      'CPU Saturation',
      'Top 5 Context Switches',
      'Switches',
      'Top 5 Runnable Processes',
      'Runnable Processes',
      'Top 5 Blocked Processes',
      'Blocked Processes',
      'Min Memory Available',
      'Min Virtual Memory Available',
      'Top File Cache Active Memory',
      'Min Swap Available',
      'Top Swap Reads',
      'Top Swap Writes',
      'Free Memory Percent',
      'Available Virtual Memory Percent',
      'Free Swap Space Percent',
      'Top 5 Used Memory',
      'Top 5 Free Memory',
      'Top 5 Used Virtual Memory',
      'Top 5 Available Virtual Memory',
      'Top 5 Used Swap Space',
      'Top 5 Free Swap Space',
      'Top 5 Swap In (Reads)',
      'Top 5 Swap Out (Writes)',
      'Min Free Space Available',
      'Top I/O Load',
      ' Top Disk Latency',
      ' Top Disk Operations',
      ' Top Disk Bandwidth',
      ' Top I/O Activity',
      'Top 5 Disk I/O Load',
      'Disk I/O Load',
      'Top 5 Disk Latency',
      ' Disk Latency',
      'Top 5 Disk Bandwidth',
      ' Disk Bandwidth',
      'Top 5 I/O Activity',
      'I/O Activity',
      ' Top Receive Network Traffic',
      ' Top Transmit Network Traffic',
      'Top Errors',
      'Top Drop',
      'Top Retransmission',
      'Top Retransmit rate',
      'Top 5 Network Traffic',
      'Network Traffic',
      'Top 5 Local Network Errors',
      'Errors',
      'Top 5 TCP Retransmission',
      'Retransmission',
      'Top 5 Local Network Drop',
      'Drop',
    ],
  },

  fields: {
    breadcrumbs: {
      folder: locate('.page-toolbar').find('[aria-label="Search links"] > a'),
      dashboardName: locate('.page-toolbar').find('[aria-label="Search dashboard by name"]'),
    },
    annotationMarker: I.useDataQA('data-testid annotation-marker'),
    clearSelection: '//a[@ng-click="vm.clearSelections()"]',
    collapsedDashboardRow: '//button[@aria-label="Expand row"]',
    collapsedDashboardRowByName: (rowName) => `//*[@aria-label="Expand row" and contains(@data-testid, "${rowName}")]`,
    dataLinkForRoot: '//div[contains(text(), "Data links")]/..//a',
    Last2Days: '//span[contains(text(), "Last 2 days")]',
    metricTitle: '$header-container',
    metricPanel: '//section[@class="panel-container"]',
    mongoDBServiceSummaryContent: locate('$pt-summary-fingerprint').withText('Mongo Executable'),
    mySQLServiceSummaryContent: locate('$pt-summary-fingerprint').withText('Percona Toolkit MySQL Summary Report'),
    navbarLocator: '.page-toolbar',
    notAvailableDataPoints: '//div[contains(text(),"No data")]',
    notAvailableMetrics: '//span[contains(text(), "N/A")]',
    otherReportTitleWithNoData:
      '//span[contains(text(),"No Data")]//ancestor::div[contains(@class,"panel-container")]//span[contains(@class,"panel-title-text")]',
    panelLoading: locate('div').withAttr({ class: 'panel-loading' }),
    postgreSQLServiceSummaryContent: locate('$pt-summary-fingerprint').withText('Detected PostgreSQL version:'),
    reportTitle: locate('$header-container').inside(locate('[class$="panel-container"]')),
    reportTitleWithNA:
      locate('$header-container')
        .inside(locate('[class$="panel-container"]')
          .withDescendant('//*[(text()="No data") or (text()="NO DATA") or (text()="N/A") or (text()="-") or (text() = "No Data")]')),
    reportTitleWithNoData:
    locate('$header-container')
      .inside(locate('[class$="panel-container"]')
        .withDescendant('//*[contains(text(),"No data") or contains(text(), "NO DATA") or contains(text(),"N/A")) or (text()="-") or (text() = "No Data")]')),
    rootUser: '//div[contains(text(), "root")]',
    serviceSummary: I.useDataQA('data-testid dashboard-row-title-Service Summary'),
    timeRangePickerButton: I.useDataQA('data-testid TimePicker Open Button'),
    refresh: I.useDataQA('data-testid RefreshPicker run button'),
    allFilterDropdownOptions: '//div[@role="option" and not(.="All")]',
    skipTourButton: '//button[span[text()="Skip"]]',
    closeModal: '//button[@aria-label="Close"]',
    openFiltersDropdownLocator: (filterName) => locate(`//label[contains(text(), "${filterName}")]/following-sibling::div`),
    filterDropdownOptionsLocator: (filterName) => locateOption(filterName),
    filterDropdownValueLocator: (filterValue) => locate('div').withAttr({ role: 'option' }).withText(filterValue),
    filterSelectedValues: (filterName) => locate(`//label[contains(text(), "${filterName}")]/following-sibling::div/div/div/div[contains(@class, "multi-value-container") or contains(@class, "singleValue")]`),
    refreshIntervalPicker: I.useDataQA('data-testid RefreshPicker interval button'),
    refreshIntervalOption: (interval) => locate(`//*[@role="menuitemradio"]//span[text()="${interval}"]`),
    clickablePanel: (name) => locate('$header-container').withText(name).find('a'),
    dashboardTitle: (name) => locate('span').withText(name),
    metricPanelNa: (name) => `//section[@aria-label="${name}"]//span[text()="N/A"]`,
    loadingElement: locate('//div[@aria-label="Panel loading bar"]'),
    multiSelect: (filterName) => locate(`//label[contains(text(), "${filterName}")]/following-sibling::div//div[contains(@class,"grafana-select-multi-value-container")]`),
  },

  async checkNavigationBar(text) {
    I.waitForVisible(this.fields.navbarLocator, 30);
    const navbarText = await I.grabTextFrom(this.fields.navbarLocator);

    assert.ok(navbarText.includes(text));
  },

  annotationLocator(number = 1) {
    return `(//div[@data-testid="data-testid annotation-marker"])[${number}]`;
  },

  annotationTagText(tagValue) {
    return `//span[contains(text(),  '${tagValue}')]`;
  },

  annotationText(annotationTitle) {
    return `//div[contains(text(), '${annotationTitle}')]`;
  },

  verifyAnnotationsLoaded(title, number = 1) {
    I.waitForElement(this.fields.annotationMarker, 30);
    I.usePlaywrightTo('Move mouse to anotation', async ({ page }) => {
      await page.locator(this.annotationLocator(number)).hover();
    });
    I.waitForVisible(this.annotationText(title), 30);
  },

  async verifyMetricsExistence(metrics) {
    I.click(this.fields.reportTitle);
    await adminPage.performPageDown(5);
    for (const i in metrics) {
      I.pressKey('PageDown');
      await this.expandEachDashboardRow();
      I.waitForElement(this.graphsLocator(metrics[i]), 5);
      I.scrollTo(this.graphsLocator(metrics[i]));
    }
  },

  async verifyMetricsExistencePartialMatch(metrics) {
    for (const i in metrics) {
      I.pressKey('PageDown');
      await this.expandEachDashboardRow();
      I.waitForElement(this.graphsLocatorPartialMatch(metrics[i]), 5);
      I.scrollTo(this.graphsLocatorPartialMatch(metrics[i]));
    }
  },

  openGraphDropdownMenu(metric) {
    I.waitForVisible(this.graphsLocator(metric), 10);
    I.moveCursorTo(this.graphsLocator(metric), 10);
    I.click(this.graphsLocator(metric).find('[title="Menu"]'));
  },

  graphsLocator(metricName) {
    return locate(`[data-testid^="data-testid Panel header ${metricName}"]`);
  },

  graphsLocatorPartialMatch(metricName) {
    // Support wildcard '*' in metricName to match any sequence of characters (for dynamic IDs).
    // Build an XPath using contains() segments when wildcard is present for broader matching.
    if (metricName.includes('*')) {
      // Split on '*' and ensure all fixed fragments appear in order.
      const parts = metricName.split('*').filter(Boolean);
      // Start with panels
      let xpath = "//section[contains(@data-testid,'Panel header')";
      for (const p of parts) {
        xpath += ` and contains(@data-testid,'${p}')`;
      }
      xpath += ']';
      return locate(xpath);
    }
    return locate(`[data-testid*="data-testid Panel header"][data-testid*="${metricName}"]`);
  },

  graphLegendSeriesRowByTitle(metricName, title) {
    return this.graphsLocator(metricName).find(`//tr[@class="graph-legend-series "][td//button[contains(@title, '${title}')]]`);
  },

  panelByTitle(title) {
    return I.useDataQA(`data-testid Panel header ${title}`);
  },

  panelDataByTitle(title) {
    return locate(this.panelByTitle(title)).find(I.useDataQA('data-testid Data link'));
  },

  panelValueByTitle(title) {
    return locate(this.panelByTitle(title)).find('//div[@data-testid="data-testid panel content"]//span');
  },

  async verifyColumnLegendMaxValueAbove(panelTitle, serviceName, expectedValue, timeout = 60) {
    const maxValueLegendLocator = this.getColumnLegendMaxValue(panelTitle, serviceName);

    await this.verifyColumnLegendValueAbove(maxValueLegendLocator.value, panelTitle, serviceName, expectedValue, timeout);
  },

  async verifyColumnLegendValueAbove(legendLocator, panelTitle, serviceName, expectedValue, timeout = 60) {
    await I.usePlaywrightTo('Get Text from Element', async ({ page }) => {
      let retries = 0;
      let actualValue = 0;

      const valueLocator = await page.locator(legendLocator).first();

      while (actualValue < expectedValue) {
        // eslint-disable-next-line no-plusplus
        if (retries++ > timeout) throw new Error(`Value in panel ${panelTitle} for ${serviceName} was never above ${expectedValue} and is ${actualValue}`);

        if (await valueLocator.isVisible()) {
          actualValue = await valueLocator.textContent();
        }

        await page.waitForTimeout(1000);

        if (actualValue >= expectedValue) return;
      }
    });
  },

  getColumnLegendMaxValue(panelTitle, serviceName) {
    return locate(this.panelByTitle(panelTitle)).find(`//button[contains(@title, '${serviceName}')]//ancestor::tr//td[position()='3']`);
  },

  async waitForAllGraphsToHaveData(timeout = 60) {
    await I.waitForInvisible(this.fields.notAvailableMetrics, timeout);
    await I.waitForInvisible(this.fields.notAvailableDataPoints, timeout);
  },

  async waitForGraphsToHaveData(acceptableNACount = 0, timeoutInSeconds = 60) {
    let currentIteration = 0;
    let numberOfNAElements = 1000;

    // eslint-disable-next-line no-plusplus
    while (currentIteration++ <= timeoutInSeconds) {
      numberOfNAElements = await I.grabNumberOfVisibleElements(this.fields.reportTitleWithNA);

      if (numberOfNAElements < acceptableNACount) {
        return;
      }

      I.wait(1);
    }

    const titles = await this.grabFailedReportTitles(this.fields.reportTitleWithNA);
    const url = await I.grabCurrentUrl();

    await this.printFailedReportNames(acceptableNACount, numberOfNAElements, titles, url);
  },

  async verifyThereAreNoGraphsWithoutData(acceptableNACount = 0) {
    const numberOfNAElements = await I.grabNumberOfVisibleElements(this.fields.reportTitleWithNA);

    I.say(`Number of no data and N/A elements is = ${numberOfNAElements}`);
    if (numberOfNAElements > acceptableNACount) {
      const titles = await this.grabFailedReportTitles(this.fields.reportTitleWithNA);

      const url = await I.grabCurrentUrl();

      await this.printFailedReportNames(acceptableNACount, numberOfNAElements, titles, url);
    }
  },

  // acceptableDataCount - Defect in testing software, even when all tha tables are without data then condition are not met,
  async verifyThatAllGraphsNoData(acceptableDataCount = 0) {
    const numberOfNAElements = await I.grabNumberOfVisibleElements(this.fields.reportTitleWithNA);
    const allGraphs = await I.grabNumberOfVisibleElements(this.fields.reportTitle);

    I.say(`Number of no data and N/A elements is = ${numberOfNAElements}`);
    I.say(`Number of all graph elements is = ${allGraphs}`);
    if ((allGraphs - numberOfNAElements) > acceptableDataCount) {
      assert.equal(
        (allGraphs - numberOfNAElements) <= acceptableDataCount,
        true,
        `Expected ${allGraphs} Elements without data but found ${numberOfNAElements} on Dashboard ${await I.grabCurrentUrl()}.`,
      );
    }
  },

  async printFailedReportNames(expectedNumber, actualNumber, titles, dashboardUrl) {
    assert.equal(
      actualNumber <= expectedNumber,
      true,
      `Expected ${expectedNumber} Elements without data but found ${actualNumber} on Dashboard ${dashboardUrl}. Report Names are ${titles}`,
    );
  },

  async grabFailedReportTitles(selector) {
    return await I.grabTextFromAll(selector);
  },

  async expandEachDashboardRow() {
    await I.usePlaywrightTo('expanding collapsed rows', async ({ page }) => {
      const getCollapsedRowsLocators = async () => await page.locator(this.fields.collapsedDashboardRow).all();
      let collapsedRowsLocators = await getCollapsedRowsLocators();

      while (collapsedRowsLocators.length > 0) {
        await page.keyboard.press('End');
        await collapsedRowsLocators[0].scrollIntoViewIfNeeded();
        await collapsedRowsLocators[0].click();
        collapsedRowsLocators.shift();

        collapsedRowsLocators = await getCollapsedRowsLocators();
      }
    });
  },

  async expandDashboardRow(rowName) {
    await I.usePlaywrightTo('Expand collapsed row', async ({ page }) => {
      const rowLocator = await page.locator(this.fields.collapsedDashboardRowByName(rowName));

      await rowLocator.scrollIntoViewIfNeeded();
      await rowLocator.click();
    });
  },

  waitForDashboardOpened() {
    I.waitForElement(this.fields.metricTitle, 60);
    I.waitForDetached(this.fields.loadingElement, 60);
    I.click(this.fields.metricTitle);
  },

  expandFilters(filterName) {
    const dropdownLocator = this.fields.openFiltersDropdownLocator(filterName);

    // This is due to some instances with many services take filter to load
    // I.wait(1);
    I.waitForElement(dropdownLocator, 30);
    I.click(dropdownLocator);
    // click one more time to expand the multiselect dropdown
    I.forceClick(dropdownLocator);

    return '[aria-label="Variable options"]';
  },

  async applyFilter(filterName, filterValue) {
    const filterValueLocator = this.fields.filterDropdownValueLocator(filterValue);
    const filterDropdownOptionsLocator = this.fields.filterDropdownOptionsLocator(filterValue);
    const dropdownLocator = this.fields.openFiltersDropdownLocator(filterName);
    const selectedFilterValue = await I.grabTextFrom(dropdownLocator);
    const isMultiSelect = await I.grabNumberOfVisibleElements(this.fields.multiSelect(filterName)) > 0;

    // If there is only one value for a filter it is selected by default
    if (selectedFilterValue !== 'All' && selectedFilterValue === filterValue) {
      I.seeTextEquals(filterValue, dropdownLocator);
    } else {
      this.expandFilters(filterName);
      I.waitForElement(filterDropdownOptionsLocator, 30);
      I.waitForVisible(filterValueLocator, 30);
      I.click(filterValueLocator);

      // close dropdown if it's multi select
      if (isMultiSelect) {
        I.pressKey('Escape');
      }
    }
  },

  async getSelectedFilterValues(filterName) {
    const values = this.fields.filterSelectedValues(filterName);

    return I.grabTextFromAll(values);
  },

  async getTimeRange() {
    return await I.grabTextFrom(this.fields.timeRangePickerButton);
  },

  async waitAndSwitchTabs(ammountOfTabs) {
    for (let i = 0; i <= 10; i++) {
      const numberOfTabs = await I.grabNumberOfTabs();

      if (numberOfTabs === ammountOfTabs) {
        I.switchToNextTab(1);
        break;
      }
    }
  },

  selectRefreshTimeInterval(timeInterval) {
    I.click(this.fields.refreshIntervalPicker);
    I.click(this.fields.refreshIntervalOption(timeInterval));
  },

  async clickSkipPmmTour() {
    I.wait(2);
    const numberOfElements = await I.grabNumberOfVisibleElements(this.fields.skipTourButton);

    if (numberOfElements >= 1) {
      I.click(this.fields.skipTourButton);
    }
  },

  async clickUpgradeModal() {
    I.wait(2);
    const numberOfElements = await I.grabNumberOfVisibleElements(this.fields.closeModal);

    if (numberOfElements >= 1) {
      I.click(this.fields.closeModal);
    }
  },

  /**
   * Creates and returns a panel menu(displayed on dasboard) object to interact in test in a piped style
   *
   * @param   panelTitle    title of a panel tointeract with
   * @return  {DashboardPanelMenu} instance
   */
  panelMenu(panelTitle) {
    return new DashboardPanelMenu(panelTitle);
  },

  async verifySlowQueriesPanel(timeFrame) {
    I.waitForVisible(this.slowQueriesText);
    const queryCount = await I.grabTextFrom(this.slowQueriesValue);
    const queryText = await I.grabTextFrom(this.slowQueriesText);

    if (parseInt(queryCount, 10) === 0) {
      throw new Error('Count of Slow Queries should be greater than 0');
    }

    if (!queryText.includes(timeFrame)) {
      throw new Error(`Slow queries text (${queryText.replace('\n', '').trim()}) should contains expected time frame: ${timeFrame}`);
    }
  },
};

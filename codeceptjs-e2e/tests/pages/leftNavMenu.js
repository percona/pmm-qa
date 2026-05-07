const {
  LeftMenu, LeftSearchMenu, SubMenu, menuOption,
} = require('./menuTemplates.js');

// to keep arguments short
const da = 'Dashboards';
const sy = 'Operating System (OS)';
const ms = 'MySQL';
const mo = 'MongoDB';
const ps = 'PostgreSQL';
const sa = 'Server admin';
const co = 'Configuration';
const al = 'Alerting';
const ad = 'Advisors';
const bm = 'Backup';

/**
 * Implements left Navigation Grafana Menu. Intended to be used UX goes, ex.:
 *    leftNavMenu.pmmDashboards.menu.systemNode.menu.nodeOverview.click()
 */
module.exports = {
  search: new LeftSearchMenu('Search dashboards', 'search=open'),
  dashboards: new LeftMenu(
    'Dashboards',
    '/graph/',
    {
      browse: menuOption(da, 'Browse', '/graph/dashboards'),
      playlists: menuOption(da, 'Playlists', '/graph/playlists'),
      snapshots: menuOption(da, 'Snapshots', '/graph/dashboard/snapshots'),
      libraryPanels: menuOption(da, 'Library panels', '/graph/library-panels'),
      dashboard: menuOption(da, 'New dashboard', '/graph/dashboard/new?orgId=1'),
      folder: menuOption(da, 'New folder', '/graph/dashboards/folder/new'),
      import: menuOption(da, 'Import', '/graph/dashboard/import'),
    },
  ),
  systemNode: new LeftMenu(
    'Operating System (OS)',
    '/graph/d/node-instance-overview/',
    {
      nodeOverview: menuOption(sy, 'Overview', '/graph/d/node-instance-overview/nodes-overview'),
      nodeSummary: menuOption(sy, 'Summary', '/graph/d/node-instance-summary/node-summary'),
      cpuUtilization: menuOption(sy, 'CPU utilization', '/graph/d/node-cpu/cpu-utilization-details'),
      disk: menuOption(sy, 'Disk', '/graph/d/node-disk/disk-details'),
      memory: menuOption(sy, 'Memory', '/graph/d/node-memory/memory-details'),
      network: menuOption(sy, 'Network', '/graph/d/node-network/network-details'),
      temperature: menuOption(sy, 'Temperature', '/graph/d/node-temp/node-temperature-details'),
      numa: menuOption(sy, 'NUMA', '/graph/d/node-memory-numa/numa-details'),
      processes: menuOption(sy, 'Processes', '/graph/d/node-cpu-process/processes-details'),
    },
  ),
  mySql: new LeftMenu(
    'MySQL',
    '/graph/d/mysql-instance-overview/mysql-instances-overview',
    {
      mySqlOverview: menuOption(ms, 'Overview', '/graph/d/mysql-instance-overview/mysql-instances-overview'),
      mySqlSummary: menuOption(ms, 'Summary', '/graph/d/mysql-instance-summary/mysql-instance-summary'),
      highAvailability: new SubMenu(
        ms,
        'High availability',
        '#',
        {
          mySqlGroupReplicationSummary: menuOption(ms, 'Group replication summary', '/graph/d/mysql-group-replicaset-summary/mysql-group-replication-summary', 2),
          mySQLReplicationSummary: menuOption(ms, 'Replication summary', '/graph/d/mysql-replicaset-summary/mysql-replication-summary', 2),
          pxc_galeraClusterSummary: menuOption(ms, 'PXC/Galera cluster summary', '/graph/d/pxc-cluster-summary/pxc-galera-cluster-summary', 2),
          pxc_galeraNodeSummary: menuOption(ms, 'PXC/Galera node summary', '/graph/d/pxc-node-summary/pxc-galera-node-summary', 2),
          pxc_galeraNodesCompare: menuOption(ms, 'PXC/Galera nodes compare', '/graph/d/pxc-nodes-compare/pxc-galera-nodes-compare', 2),
        },
      ),
      MySqlCommand_HandlerCountersCompare: menuOption(ms, 'Command/Handler counters compare', '/graph/d/mysql-commandhandler-compare/mysql-command-handler-counters-compare'),
      mySqlInnoDbDetails: menuOption(ms, 'InnoDB details', '/graph/d/mysql-innodb/mysql-innodb-details'),
      mySqlInnoDbCompressionDetails: menuOption(ms, 'InnoDB compression', '/graph/d/mysql-innodb-compression/mysql-innodb-compression-details'),

      mySqlPerformanceSchemaDetails: menuOption(ms, 'Performance schema', '/graph/d/mysql-performance-schema/mysql-performance-schema-details'),
      mysqlTableDetails: menuOption(ms, 'Table details', '/graph/d/mysql-table/mysql-table-details'),
      mySqlTokuDbDetails: menuOption(ms, 'TokuDB details', '/graph/d/mysql-tokudb/mysql-tokudb-details'),
    },
  ),
  mongoDb: new LeftMenu(
    'MongoDB',
    '/graph/d/mongodb-instance-overview/mongodb-instances-overview',
    {
      mongoDbInstanceOverview: menuOption(mo, 'Overview', '/graph/d/mongodb-instance-overview/mongodb-instances-overview'),
      mongoDbInstanceSummary: menuOption(mo, 'Summary', '/graph/d/mongodb-instance-summary/mongodb-instance-summary'),
      highAvailability: new SubMenu(
        mo,
        'High availability',
        '#',
        {
          mongoDbClusterSummary: menuOption(mo, 'Cluster summary', '/graph/d/mongodb-cluster-summary/mongodb-cluster-summary', 2),
          mongoDbReplSetSummary: menuOption(mo, 'ReplSet summary', '/graph/d/mongodb-replicaset-summary/mongodb-replset-summary', 2),
        },
      ),
      mongoDbInMemoryDetails: menuOption(mo, 'InMemory', '/graph/d/mongodb-inmemory/mongodb-inmemory-details'),
      mongoDbMmaPv1Details: menuOption(mo, 'MMAPv1', '/graph/d/mongodb-mmapv1/mongodb-mmapv1-details'),
      mongoDbWiredTigerDetails: menuOption(mo, 'WiredTiger', '/graph/d/mongodb-wiredtiger/mongodb-wiredtiger-details'),
    },
  ),
  postgreSql: new LeftMenu(
    'PostgreSQL',
    '/graph/d/postgresql-instance-overview/postgresql-instances-overview',
    {
      postgreSqlOverview: menuOption(ps, 'Overview', '/graph/d/postgresql-instance-overview/postgresql-instances-overview'),
      postgreSqlSummary: menuOption(ps, 'Summary', '/graph/d/postgresql-instance-summary/postgresql-instance-summary'),
    },
  ),
  proxySql: new LeftMenu('ProxySQL', '/graph/d/proxysql-instance-summary/proxysql-instance-summary'),
  haProxy: new LeftMenu('HAProxy', '/graph/d/haproxy-instance-summary/haproxy-instance-summary'),

  queryAnalytics: new LeftMenu('Query Analytics (QAN)', '/graph/d/pmm-qan/pmm-query-analytics'),
  explore: new LeftMenu('Explore', '/graph/explore'),
  alerting: new LeftMenu(
    'Alerting',
    '/graph/alerting/alerts',
    {
      alertRules: menuOption(al, 'Alert rules', '/graph/alerting/list'),
      receivers: menuOption(al, 'Contact points', '/graph/alerting/notifications'),
      amRoutes: menuOption(al, 'Notification policies', '/graph/alerting/routes'),
      silences: menuOption(al, 'Silences', '/graph/alerting/silences'),
      groups: menuOption(al, 'Groups', '/graph/alerting/groups'),
      alertingAdmin: menuOption(al, 'Admin', '/graph/alerting/admin'),
      newAlertRule: menuOption(al, 'New alert rule', '/graph/alerting/new'),
    },
  ),
  advisors: new LeftMenu(
    'Advisors',
    '/graph/advisors/insights',
    {
      advisorInsights: menuOption(ad, 'Advisor Insights', '/graph/advisors/insights'),
      configurationAdvisors: menuOption(ad, 'Configuration Advisors', '/graph/advisors/configuration'),
      securityAdvisors: menuOption(ad, 'Security Advisors', '/graph/advisors/security'),
    },
  ),
  backups: new LeftMenu(
    'Backup',
    '/graph/backup/inventory',
    {
      allBackups: menuOption(bm, 'All Backups', '/graph/backup/inventory'),
      scheduledBackupJobs: menuOption(bm, 'Scheduled Backup Jobs', '/graph/backup/scheduled'),
      restores: menuOption(bm, 'Restores', '/graph/backup/restore'),
      storageLocations: menuOption(bm, 'Storage Locations', '/graph/backup/locations'),
    },
  ),
  configuration: new LeftMenu(
    'Configuration',
    '/graph/inventory/services',
    {
      serviceAccounts: menuOption(co, 'Service accounts', '/graph/org/serviceaccounts'),
      apiKeys: menuOption(co, 'API keys', '/graph/org/apikeys'),
      preferences: menuOption(co, 'Preferences', '/graph/org'),
      plugins: menuOption(co, 'Plugins', '/graph/plugins'),
      teams: menuOption(co, 'Teams', '/graph/org/teams'),
      dataSources: menuOption(co, 'Data sources', '/graph/datasources'),
      users: menuOption(co, 'Users', '/graph/org/users'),
      pmmSettings: menuOption(co, 'Settings', '/graph/settings/metrics-resolution'),
      pmmInventory: menuOption(co, 'Inventory', '/graph/inventory/services'),
      addInstance: menuOption(co, 'Add Service', '/graph/add-instance'),
    },
  ),
  serverAdmin: new LeftMenu(
    'Server admin',
    '/graph/admin/users',
    {
      stats: menuOption(sa, 'Stats and license', '/graph/admin/upgrading'),
      users: menuOption(sa, 'Users', '/graph/admin/users'),
      orgs: menuOption(sa, 'Organizations', '/graph/admin/orgs'),
      settings: menuOption(sa, 'Settings', '/graph/admin/settings'),
    },
  ),
};

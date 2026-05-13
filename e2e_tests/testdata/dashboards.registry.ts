export interface DashboardEntry {
  folder: string;
  cluster?: string;
  replicationSet?: string;
  serviceName?: string;
  url: string;
}

export const DASHBOARDS: DashboardEntry[] = [
  { folder: 'Insight', url: 'graph/d/pmm-home/home-dashboard' },
  { folder: 'Insight', url: 'graph/d/prometheus-advanced/advanced-data-exploration' },
  { folder: 'Insight', url: 'graph/d/prometheus-status/prometheus-exporter-status' },
  { folder: 'Insight', url: 'graph/d/prometheus-overview/prometheus-exporters-overview' },
  { folder: 'Insight', url: 'graph/d/victoriametrics/victoriametrics' },
  { folder: 'Insight', url: 'graph/d/vmagent/victoriametrics-agents-overview' },

  { folder: 'MongoDB', url: 'graph/d/mongodb-backup-details/mongodb-backup-details' },
  {
    cluster: 'replicaset',
    folder: 'MongoDB',
    url: 'graph/d/mongodb-collections-overview/mongodb-collections-overview',
  },
  { folder: 'MongoDB', url: 'graph/d/mongodb-inmemory/mongodb-inmemory-details' },
  {
    cluster: 'replicaset',
    folder: 'MongoDB',
    url: 'graph/d/mongodb-instance-summary/mongodb-instance-summary',
  },
  { folder: 'MongoDB', url: 'graph/d/mongodb-instance-compare/mongodb-instances-compare' },
  { folder: 'MongoDB', url: 'graph/d/mongodb-instance-overview/mongodb-instances-overview' },
  { folder: 'MongoDB', url: 'graph/d/mongodb-mmapv1/mongodb-mmapv1-details' },
  { folder: 'MongoDB', url: 'graph/d/mongodb-oplog-details/mongodb-oplog-details' },
  {
    folder: 'MongoDB',
    replicationSet: 'rs',
    url: 'graph/d/mongodb-replicaset-summary/mongodb-replset-summary',
  },
  { folder: 'MongoDB', url: 'graph/d/mongodb-router-summary/mongodb-router-summary' },
  { folder: 'MongoDB', url: 'graph/d/mongodb-cluster-summary/mongodb-sharded-cluster-summary' },
  { folder: 'MongoDB', url: 'graph/d/mongodb-wiredtiger/mongodb-wiredtiger-details' },

  { folder: 'MySQL', url: 'graph/d/haproxy-instance-summary/haproxy-instance-summary' },
  { folder: 'MySQL', url: 'graph/d/mysql-amazonaurora/mysql-amazon-aurora-details' },
  { folder: 'MySQL', url: 'graph/d/mysql-commandhandler-compare/mysql-command-handler-counters-compare' },
  { folder: 'MySQL', url: 'graph/d/mysql-group-replicaset-summary/mysql-group-replication-summary' },
  { folder: 'MySQL', url: 'graph/d/mysql-innodb-compression/mysql-innodb-compression-details' },
  { folder: 'MySQL', url: 'graph/d/mysql-innodb/mysql-innodb-details' },
  { folder: 'MySQL', url: 'graph/d/mysql-instance-summary/mysql-instance-summary' },
  { folder: 'MySQL', url: 'graph/d/mysql-instance-compare/mysql-instances-compare' },
  { folder: 'MySQL', url: 'graph/d/mysql-instance-overview/mysql-instances-overview' },
  { folder: 'MySQL', url: 'graph/d/mysql-myisamaria/mysql-myisam-aria-details' },
  { folder: 'MySQL', url: 'graph/d/mysql-myrocks/mysql-myrocks-details' },
  { folder: 'MySQL', url: 'graph/d/mysql-performance-schema/mysql-performance-schema-details' },
  { folder: 'MySQL', url: 'graph/d/mysql-queryresponsetime/mysql-query-response-time-details' },
  {
    folder: 'MySQL',
    serviceName: 'ps_pmm_replication_8_4_2*',
    url: 'graph/d/mysql-replicaset-summary/mysql-replication-summary',
  },
  { folder: 'MySQL', url: 'graph/d/mysql-table/mysql-table-details' },
  { folder: 'MySQL', url: 'graph/d/mysql-user/mysql-user-details' },
  { folder: 'MySQL', url: 'graph/d/mysql-waitevents-analysis/mysql-wait-event-analyses-details' },
  { folder: 'MySQL', url: 'graph/d/proxysql-instance-summary/proxysql-instance-summary' },
  { folder: 'MySQL', url: 'graph/d/pxc-cluster-summary/pxc-galera-cluster-summary' },
  { folder: 'MySQL', url: 'graph/d/pxc-node-summary/pxc-galera-node-summary' },
  { folder: 'MySQL', url: 'graph/d/pxc-nodes-compare/pxc-galera-nodes-compare' },

  { folder: 'OS', url: 'graph/d/node-cpu/cpu-utilization-details' },
  { folder: 'OS', url: 'graph/d/node-disk/disk-details' },
  { folder: 'OS', url: 'graph/d/node-memory/memory-details' },
  { folder: 'OS', url: 'graph/d/node-network/network-details' },
  { folder: 'OS', url: 'graph/d/node-instance-summary/node-summary' },
  { folder: 'OS', url: 'graph/d/node-temp/node-temperature-details' },
  { folder: 'OS', url: 'graph/d/node-instance-compare/nodes-compare' },
  { folder: 'OS', url: 'graph/d/node-instance-overview/nodes-overview' },
  { folder: 'OS', url: 'graph/d/node-memory-numa/numa-details' },
  { folder: 'OS', url: 'graph/d/node-cpu-process/processes-details' },

  {
    folder: 'PostgreSQL',
    serviceName: 'pdpgsql_pmm_patroni_17_1',
    url: 'graph/d/postgresql-checkpoints-overview/postgresql-checkpoints-buffers-and-wal-usage',
  },
  {
    folder: 'PostgreSQL',
    serviceName: 'pdpqsql_pmm_17_1',
    url: 'graph/d/postgresql-instance-summary/postgresql-instance-summary',
  },
  { folder: 'PostgreSQL', url: 'graph/d/postgresql-instance-compare/postgresql-instances-compare' },
  { folder: 'PostgreSQL', url: 'graph/d/postgresql-instance-overview/postgresql-instances-overview' },
  {
    folder: 'PostgreSQL',
    url: 'graph/d/postgresql-overview-extended/postgresql-instances-overview-extended',
  },
  { folder: 'PostgreSQL', url: 'graph/d/postgresql-patroni-details/postgresql-patroni-details' },
  { folder: 'PostgreSQL', url: 'graph/d/postgresql-replication-overview/postgresql-replication-overview' },
  { folder: 'PostgreSQL', url: 'graph/d/postgresql-top-queries/postgresql-top-queries' },

  { folder: 'Query Analytics', url: 'graph/d/pmm-qan/pmm-query-analytics' },

  { folder: 'Valkey', url: 'graph/d/valkey-clients/valkey-redis-clients' },
  { folder: 'Valkey', url: 'graph/d/valkey-cluster-details/valkey-redis-cluster-details' },
  { folder: 'Valkey', url: 'graph/d/valkey-command-details/valkey-redis-command-detail' },
  { folder: 'Valkey', url: 'graph/d/valkey-load/valkey-redis-load' },
  { folder: 'Valkey', url: 'graph/d/valkey-memory/valkey-redis-memory' },
  { folder: 'Valkey', url: 'graph/d/valkey-network/valkey-redis-network' },
  { folder: 'Valkey', url: 'graph/d/valkey-overview/valkey-redis-overview' },
  { folder: 'Valkey', url: 'graph/d/valkey-persistence-details/valkey-redis-persistence-details' },
  { folder: 'Valkey', url: 'graph/d/valkey-replication/valkey-redis-replication' },
  { folder: 'Valkey', url: 'graph/d/valkey-slowlog/valkey-redis-slowlog' },
];

/** Extract dashboard name from the URL path (last segment). */
export const nameFromUrl = (url: string): string => url.split('/').pop() ?? 'unknown';

/** Resolve wildcard service names (e.g. "ps_pmm_replication_8_4_2*") via inventory API. */
export const resolveServiceName = async (
  sn: string | undefined,
  inventoryApi: { getServiceDetailsByRegex: (regex: string) => Promise<{ service_name: string }> },
): Promise<string | undefined> => {
  if (!sn?.endsWith('*')) return sn;

  return (await inventoryApi.getServiceDetailsByRegex(`${sn.slice(0, -1)}.*`)).service_name;
};

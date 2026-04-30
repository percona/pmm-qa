const emailDefaults = {
  type: 'email',
  serverAddress: 'test.server.com:465',
  hello: 'server.com',
  from: 'sender@mail.com',
  authType: 'None',
  username: 'test',
  password: 'test',
};

module.exports = {
  emailDefaults,
  communicationData: [
    emailDefaults, {
      ...emailDefaults,
      authType: 'Plain',
    }, {
      ...emailDefaults,
      authType: 'Login',
    }, {
      ...emailDefaults,
      authType: 'CRAM-MD5',
    }, {
      type: 'slack',
      url: 'https://hook',
    },
  ],
  telemetryTooltipData: 'Option to send usage data back to Percona to let us make our product better.\n'
    + '\n'
    + 'We gather and send the following information to Percona:\n'
    + '\n'
    + 'PMM Server Integration Alerting feature enabled/disabled\n'
    + 'Maximum number of active concurrent alerts in the last 24 hours\n'
    + 'Number of Alerts configured\n'
    + 'PMM Server Security Thread Tool feature enabled/disabled\n'
    + 'PMM Server Backup Management feature enabled\n'
    + 'PMM Server alert manager integration - used/not used\n'
    + 'PMM Server Check Updates feature disabled\n'
    + 'Detailed information about version and comment of monitored MySQL services\n'
    + 'Number of monitored MySQL services with RocksDB Engine\n'
    + 'InnoDB buffer pool size\n'
    + 'Average number of running threads for last day\n'
    + 'Average number of running queries\n'
    + 'Data usage of MySQL\n'
    + 'Monitored MongoDB services version\n'
    + 'Runtime for general collector of MongoDB exporter\n'
    + 'Runtime for diagnostic data collector of MongoDB exporter\n'
    + 'Runtime for collection statistics collector of MongoDB exporter\n'
    + 'Runtime for database statistics collector of MongoDB exporter\n'
    + 'Runtime for index statistics collector of MongoDB exporter\n'
    + 'Runtime for top metrics collector of MongoDB exporter\n'
    + 'Runtime for replication status collector of MongoDB exporter\n'
    + 'Monitored MongoDB edition\n'
    + 'Returns number of members in MongoDB replica set\n'
    + 'Returns number of arbiters in MongoDB replica set\n'
    + 'Returns number of shards in MongoDB cluster. If cluster is not sharded it returns 0\n'
    + 'Returns used engine type for MongoDB\n'
    + 'Returns 1 if encryption at rest is enabled on the mongo instance, otherwise returns 0\n'
    + 'Returns the type of how encryption at rest was enabled (using local file, kmip or vault)\n'
    + 'PostgreSQL version inside PMM server\n'
    + 'Monitored PostgreSQL services version\n'
    + 'Monitored HAProxy services version\n'
    + 'Monitored ProxySQL services version\n'
    + 'Total Grafana users\n'
    + 'Monthly active users\n'
    + 'Daily active users\n'
    + 'Total Grafana organisations\n'
    + 'Grafana annotation count\n'
    + 'Data retention period\n'
    + 'Monitored nodes count\n'
    + 'Monitored services count\n'
    + 'Monitored environments count\n'
    + 'Monitored clusters count\n'
    + 'Agents version\n'
    + 'Agents version PMM_AGENT running on PMM server\n'
    + 'Agents version PMM_AGENT\n'
    + 'Agents version VM_AGENT\n'
    + 'Agents version NODE_EXPORTER\n'
    + 'Agents version MYSQLD_EXPORTER\n'
    + 'Agents version MONGODB_EXPORTER\n'
    + 'Agents version POSTGRES_EXPORTER\n'
    + 'Agents version PROXYSQL_EXPORTER\n'
    + 'Agents version QAN_MYSQL_PERFSCHEMA_AGENT\n'
    + 'Agents version QAN_MYSQL_SLOWLOG_AGENT\n'
    + 'Agents version QAN_MONGODB_PROFILER_AGENT\n'
    + 'Agents version QAN_POSTGRESQL_PGSTATEMENTS_AGENT\n'
    + 'Agents version QAN_POSTGRESQL_PGSTATMONITOR_AGENT\n'
    + 'Agents version RDS_EXPORTER\n'
    + 'Agents version EXTERNAL_EXPORTER\n'
    + 'Agents version AZURE_DATABASE_EXPORTER\n'
    + 'PMM Node type\n'
    + 'Node type\n'
    + 'PMM node CPU Usage\n'
    + 'PMM node CPU Architecture\n'
    + 'PMM node CPU core count\n'
    + 'PMM node memory size\n'
    + 'PMM node memory usage\n'
    + 'PMM node disk capacity\n'
    + 'PMM node OS name\n'
    + 'PMM node OS version\n'
    + 'K8s Clusters Count\n'
    + 'Advisor - number of downloaded checks per name\n'
    + 'Advisor - number of executed checks per name\n'
    + 'Advisor - number of failed checks per name\n'
    + 'Grafana Users Count\n'
    + 'Grafana Dark Theme Users Count\n'
    + 'Grafana Light Theme Users Count\n'
    + 'Grafana Default Theme Users Count\n'
    + 'Grafana Custom Dashboards Count\n'
    + 'Grafana Custom Dashboards Count By Pillar\n'
    + 'PMM Server API usage\n'
    + 'How many storages configured by types\n'
    + 'How many backup tasks scheduled by types\n'
    + 'Backup/restore jobs sliced by different parameters',
};

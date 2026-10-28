import { AddRemoteInstance } from '@api/remoteInstance.api';

export const awsCredentials = {
  accessKey: process.env.PMM_QA_AWS_ACCESS_KEY_ID ?? '',
  secretKey: process.env.PMM_QA_AWS_ACCESS_KEY ?? '',
};

export const remoteDatabases = [
  {
    cluster: 'remote-mysql-cluster',
    environment: 'remote-mysql',
    host: 'mysql',
    password: 'pmm%*&agent-password',
    port: '3306',
    serviceName: 'mysql_remote_new',
    type: 'mysql',
    username: 'pmm-agent',
  },
  {
    cluster: 'remote-mongodb-cluster',
    environment: 'remote-mongodb',
    host: 'mongo',
    password: 'root-!@#%^password',
    replicationSet: 'remote-mongodb-replica',
    serviceName: 'mongodb_remote_new',
    type: 'mongodb',
    username: 'root',
  },
  {
    cluster: 'remote-postgres-cluster',
    environment: 'remote-postgres',
    host: 'postgres',
    password: 'pmm-^*&@agent-password',
    port: '5432',
    serviceName: 'postgresql_remote_new',
    type: 'postgresql',
    username: 'postgres',
  },
  {
    cluster: 'proxy_clstr',
    environment: 'proxy_env',
    host: 'proxysql',
    password: 'yxZq!4SGv0A1',
    serviceName: 'proxysql_remote_new',
    type: 'proxysql',
    username: 'proxyadmin',
  },
] as const;

export const externalExporter = {
  cluster: 'remote-external-cluster',
  environment: 'remote-external-service',
  host: 'external_pmm',
  metricsPath: '/metrics',
  port: '42200',
  serviceName: 'external_service_new',
};

export const haproxy = { host: 'haproxy_pmm', port: '42100', serviceName: 'haproxy_remote' };

export const rdsMysql57 = {
  cluster: 'rds57-cluster',
  environment: 'RDS MySQL 5.7',
  password: process.env.REMOTE_AWS_MYSQL_PASSWORD ?? '',
  replicationSet: 'rds57-replication',
  serviceName: 'pmm-qa-rds-mysql-5-7-39',
  username: process.env.REMOTE_AWS_MYSQL_USER ?? '',
};

export const azureCredentials = {
  clientId: process.env.AZURE_CLIENT_ID ?? '',
  clientSecret: process.env.AZURE_CLIENT_SECRET ?? '',
  subscriptionId: process.env.AZURE_SUBSCRIPTION_ID ?? '',
  tenantId: process.env.AZURE_TENNANT_ID ?? '',
};

export const azureDatabases = [
  {
    cluster: 'Azure MySQL cluster',
    environment: 'Azure MySQL environment',
    instanceToMonitor: 'pmm2-qa-mysql',
    password: process.env.AZURE_MYSQL_PASS ?? '',
    replicationSet: 'Azure MySQL replica',
    serviceName: 'azure-MySQL',
    username: process.env.AZURE_MYSQL_USER ?? '',
  },
  {
    cluster: 'Azure PostgreSQL cluster',
    environment: 'Azure PostgreSQL environment',
    instanceToMonitor: 'pmm2-qa-postgresql',
    password: process.env.AZURE_POSTGRES_PASS ?? '',
    replicationSet: 'Azure PostgreSQL replica',
    serviceName: 'azure-PostgreSQL',
    username: process.env.AZURE_POSTGRES_USER ?? '',
  },
] as const;

export const auroraInstanceId = 'pmm-qa-aurora3-mysql-instance-1';

export const auroraMysql: AddRemoteInstance = {
  rds: {
    add_node: { node_name: auroraInstanceId, node_type: 'NODE_TYPE_REMOTE_NODE' },
    address: process.env.PMM_QA_AURORA3_MYSQL_HOST ?? '',
    aws_access_key: awsCredentials.accessKey,
    aws_secret_key: awsCredentials.secretKey,
    az: 'us-east-2a',
    cluster: 'mysqlaws_aurora3',
    disable_basic_metrics: false,
    disable_enhanced_metrics: false,
    engine: 'DISCOVER_RDS_ENGINE_MYSQL',
    instance_id: auroraInstanceId,
    isRDS: true,
    password: process.env.PMM_QA_AURORA3_MYSQL_PASSWORD ?? '',
    pmm_agent_id: 'pmm-server',
    port: '42001',
    qan_mysql_perfschema: true,
    rds_exporter: true,
    region: 'us-east-2',
    replication_set: 'rds_mysql_repl',
    service_name: auroraInstanceId,
    tls_skip_verify: true,
    username: 'pmm',
  },
};

export const editedLabels = (
  serviceName: string,
  labels: { cluster?: string; environment?: string; replicationSet?: string },
) => ({
  cluster: `${labels.cluster ?? `${serviceName} cluster`} edited`,
  environment: `${labels.environment ?? `${serviceName} environment`} edited`,
  replicationSet: `${labels.replicationSet ?? `${serviceName} replicationSet`} edited`,
});

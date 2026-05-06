const { SERVICE_TYPE } = require('../helper/constants');

const remoteInstanceStatus = {
  mysql: {
    ps_5_7: {
      enabled: true,
    },
    ps_8_0: {
      enabled: true,
    },
    ps_8_4: {
      enabled: true,
    },
    ms_8_0_ssl: {
      enabled: false,
    },
  },
  mongodb: {
    psmdb_4_2: {
      enabled: true,
    },
    psmdb_4_4: {
      enabled: true,
    },
    mongodb_4_4_ssl: {
      enabled: false,
    },
  },
  postgresql: {
    pdpgsql_13_3: {
      enabled: true,
    },
    postgres_13_3_ssl: {
      enabled: false,
    },
  },
  proxysql: {
    proxysql_2_1_1: {
      enabled: process.env.OVF_TEST !== 'yes',
    },
  },
  haproxy: {
    haproxy_2: {
      enabled: true,
    },
  },
  external: {
    redis: {
      enabled: true,
    },
  },
  aws: {
    aws_rds_5_7: {
      enabled: true,
    },
    aws_rds_8_0: {
      enabled: true,
    },
    aws_rds_8_4: {
      enabled: true,
    },
    aws_rds_5_6: {
      enabled: false,
    },
    aws_postgresql_12: {
      enabled: true,
    },
  },
  azure: {
    azure_mysql: {
      enabled: true,
    },
    azure_postgresql: {
      enabled: true,
    },
  },
  // Skipped because of random failures
  gc: {
    gc_postgresql: {
      enabled: false,
      // enabled: process.env.OVF_TEST !== 'yes',
    },
    gc_mysql57: {
      enabled: true,
    },
    gc_mysql80: {
      enabled: true,
    },
    gc_pgsql_13: {
      enabled: true,
    },
  },
  aurora: {
    aurora2: {
      enabled: true,
    },
  },
};

let SERVER_HOST; let EXTERNAL_EXPORTER_HOST; let DB_CONFIG = {};
let PMM_SERVER_OVF_AMI_SETUP = 'false';

DB_CONFIG = {
  MYSQL_SERVER_PORT: '3306',
  MYSQL_HOST_SERVER_PORT: '3309',
  POSTGRES_SERVER_PORT: '5432',
  POSTGRES_HOST_SERVER_PORT: '5432',
  MONGODB_SERVER_PORT: '27017',
  PROXYSQL_SERVER_PORT: '6033',
};

if (process.env.AMI_UPGRADE_TESTING_INSTANCE === 'true' || process.env.OVF_UPGRADE_TESTING_INSTANCE === 'true') {
  PMM_SERVER_OVF_AMI_SETUP = 'true';
  SERVER_HOST = process.env.VM_CLIENT_IP;
  EXTERNAL_EXPORTER_HOST = process.env.VM_CLIENT_IP;
  DB_CONFIG.MYSQL_SERVER_PORT = '42300';
  DB_CONFIG.MONGODB_SERVER_PORT = '42100';
  DB_CONFIG.POSTGRES_SERVER_PORT = '42200';
  DB_CONFIG.PROXYSQL_SERVER_PORT = '46032';
}

if (process.env.OVF_TEST === 'yes') {
  PMM_SERVER_OVF_AMI_SETUP = 'true';
  SERVER_HOST = process.env.SERVER_IP;
  EXTERNAL_EXPORTER_HOST = process.env.SERVER_IP;
  DB_CONFIG.POSTGRES_SERVER_PORT = '5433';
}

module.exports = {
  remote_instance: {
    mysql: {
      ps_5_7: {
        host: (PMM_SERVER_OVF_AMI_SETUP === 'true' ? SERVER_HOST : 'mysql'),
        server_port: DB_CONFIG.MYSQL_SERVER_PORT,
        host_server_port: DB_CONFIG.MYSQL_HOST_SERVER_PORT,
        username: 'pmm-agent',
        password: 'pmm%*&agent-password',
        clusterName: 'mysql_clstr',
      },
      ps_8_0: {
        host: 'ps_pmm_8_0_1',
        port: '3306',
        username: 'root',
        password: 'GRgrO9301RuF',
        clusterName: 'mysql_clstr',
      },
      ps_8_4: {
        host: 'ps_pmm_8_4_1',
        port: '3306',
        username: 'root',
        password: 'GRgrO9301RuF',
        clusterName: 'mysql_clstr',
      },
      ms_8_0_ssl: {
        host: '192.168.0.1',
        port: '3308',
        username: 'root',
        password: 'lj#%zXe83hT4',
        clusterName: 'mysql-ssl-cluster',
        environment: 'mysql-ssl-env',
        tlsCAFile: '/tmp/ssl/pmm-ui-tests/testdata/mysql/ssl-cert-scripts/certs/root-ca.pem',
        tlsCertificateKeyFile: '/tmp/ssl/pmm-ui-tests/testdata/mysql/ssl-cert-scripts/certs/client-key.pem',
        tlsCertificateFile: '/tmp/ssl/pmm-ui-tests/testdata/mysql/ssl-cert-scripts/certs/client-cert.pem',
      },
    },
    mongodb: {
      psmdb_4_2: {
        host: (PMM_SERVER_OVF_AMI_SETUP === 'true' ? SERVER_HOST : 'mongo'),
        port: DB_CONFIG.MONGODB_SERVER_PORT,
        username: 'root',
        password: 'root-!@#%^password',
        clusterName: 'mongo_clstr',
      },
      psmdb_7: {
        host: (PMM_SERVER_OVF_AMI_SETUP === 'true' ? SERVER_HOST : 'rs101'),
        port: DB_CONFIG.MONGODB_SERVER_PORT,
        username: 'pbm',
        password: 'pbmpass',
        clusterName: 'mongo_clstr',
      },
      mongodb_4_4_ssl: {
        host: '192.168.0.1',
        port: '27018',
        clusterName: 'mongo-ssl-cluster',
        environment: 'mongo-ssl-env',
        tlsCAFile: '/tmp/ssl/pmm-ui-tests/testdata/mongodb/certs/ca.crt',
        tlsCertificateKeyFile: '/tmp/ssl/pmm-ui-tests/testdata/mongodb/certs/client.pem',
        tlsCertificateKeyFilePassword: '/tmp/ssl/pmm-ui-tests/testdata/mongodb/certs/client.key',
      },
    },
    postgresql: {
      pdpgsql_13_3: {
        host: (PMM_SERVER_OVF_AMI_SETUP === 'true' ? SERVER_HOST : 'postgres'),
        server_port: DB_CONFIG.POSTGRES_SERVER_PORT,
        host_server_port: DB_CONFIG.POSTGRES_HOST_SERVER_PORT,
        username: 'postgres',
        password: 'pmm-^*&@agent-password',
        clusterName: 'pgsql_clstr',
      },
      pdpgsql_17: {
        host: (PMM_SERVER_OVF_AMI_SETUP === 'true' ? SERVER_HOST : 'pdpgsql_pmm_17_1'),
        server_port: DB_CONFIG.POSTGRES_SERVER_PORT,
        host_server_port: DB_CONFIG.POSTGRES_HOST_SERVER_PORT,
        username: 'pmm',
        password: 'pmm',
        clusterName: 'pgsql_clstr',
      },
      postgres_13_3_ssl: {
        host: '192.168.0.1',
        port: '5439',
        clusterName: 'postgresql-ssl-cluster',
        environment: 'postgresql-ssl-env',
        tlsCAFile: '/tmp/ssl/pmm-ui-tests/testdata/pgsql/ssl-cert-scripts/certs/root-ca.pem',
        tlsCertFile: '/tmp/ssl/pmm-ui-tests/testdata/pgsql/ssl-cert-scripts/certs/client-cert.pem',
        tlsKeyFile: '/tmp/ssl/pmm-ui-tests/testdata/pgsql/ssl-cert-scripts/certs/client-key.pem',
      },
    },
    proxysql: {
      proxysql_2_1_1: {
        host: (PMM_SERVER_OVF_AMI_SETUP === 'true' ? SERVER_HOST : 'proxysql'),
        port: DB_CONFIG.PROXYSQL_SERVER_PORT,
        username: 'proxyadmin',
        password: 'yxZq!4SGv0A1',
        environment: 'proxy_env',
        clusterName: 'proxy_clstr',
      },
      pxc_proxysql_8: {
        host: (PMM_SERVER_OVF_AMI_SETUP === 'true' ? SERVER_HOST : 'pxc_proxysql_pmm_8.0'),
        port: DB_CONFIG.PROXYSQL_SERVER_PORT,
        username: 'proxysql_user',
        password: 'passw0rd',
        environment: 'proxy_env',
        clusterName: 'proxy_clstr',
      },
    },
    haproxy: {
      haproxy_2: {
        host: (PMM_SERVER_OVF_AMI_SETUP === 'true' ? EXTERNAL_EXPORTER_HOST : 'haproxy_pmm'),
        port: '42100',
        clusterName: 'haproxy_clst',
      },
    },
    external: {
      redis: {
        host: 'external_pmm',
        port: '42200',
        clusterName: 'redis_external_exporter',
        environment: 'redis_external',
        group: 'redis-remote',
        metricsPath: '/metrics',
        schema: 'http',
      },
    },
    aws: {
      aws_access_key: process.env.PMM_QA_AWS_ACCESS_KEY_ID,
      aws_secret_key: process.env.PMM_QA_AWS_ACCESS_KEY,
      aws_rds_5_7: {
        address: process.env.REMOTE_AWS_MYSQL57_HOST,
        username: process.env.REMOTE_AWS_MYSQL_USER,
        password: process.env.REMOTE_AWS_MYSQL_PASSWORD,
        clusterName: 'aws_rds_mysql_5_7',
        port: 42001,
      },
      aws_rds_8_0: {
        address: process.env.REMOTE_AWS_MYSQL80_HOST,
        username: process.env.REMOTE_AWS_MYSQL80_USER,
        password: process.env.REMOTE_AWS_MYSQL80_PASSWORD,
        clusterName: 'aws_rds_mysql_8_0',
        port: 42001,
      },
      aws_rds_8_4: {
        address: process.env.PMM_QA_MYSQL_RDS_8_4_HOST,
        username: process.env.PMM_QA_MYSQL_RDS_8_4_USER,
        password: process.env.PMM_QA_MYSQL_RDS_8_4_PASSWORD,
        clusterName: 'aws_rds_mysql_8_4',
        port: 42001,
      },
      aws_rds_5_6: {
        address: secret(process.env.REMOTE_AWS_MYSQL57_HOST),
        username: secret(process.env.REMOTE_AWS_MYSQL_USER),
        password: secret(process.env.REMOTE_AWS_MYSQL_PASSWORD),
        clusterName: 'aws_rds_mysql_5_6',
        port: 3306,
      },
      aws_postgresql_13: {
        address: process.env.PMM_QA_RDS_PGSQL13_HOST,
        userName: process.env.PMM_QA_RDS_PGSQL13_USER,
        password: process.env.PMM_QA_RDS_PGSQL13_PASSWORD,
        clusterName: 'aws_postgresql_13',
        port: 42001,
      },
      aws_postgresql_14: {
        address: process.env.PMM_QA_PGSQL_RDS_14_HOST,
        userName: process.env.PMM_QA_RDS_PGSQL14_USER,
        password: process.env.PMM_QA_RDS_PGSQL14_PASSWORD,
        clusterName: 'aws_postgresql_14',
        port: 42001,
      },
      aws_postgresql_15: {
        address: process.env.PMM_QA_RDS_PGSQL15_HOST,
        userName: process.env.PMM_QA_RDS_PGSQL15_USER,
        password: process.env.PMM_QA_RDS_PGSQL15_PASSWORD,
        clusterName: 'aws_postgresql_15',
        port: 42001,
      },
      aws_postgresql_16: {
        address: process.env.PMM_QA_RDS_PGSQL16_HOST,
        userName: process.env.PMM_QA_RDS_PGSQL16_USER,
        password: process.env.PMM_QA_RDS_PGSQL16_PASSWORD,
        clusterName: 'aws_postgresql_15',
        port: 42001,
      },
      aws_postgresql_17: {
        address: process.env.PMM_QA_RDS_PGSQL17_HOST,
        userName: process.env.PMM_QA_RDS_PGSQL17_USER,
        password: process.env.PMM_QA_RDS_PGSQL17_PASSWORD,
        clusterName: 'aws_postgresql_13',
        port: 42001,
      },
      aurora: {
        aws_access_key: process.env.PMM_QA_AWS_ACCESS_KEY_ID,
        aws_secret_key: process.env.PMM_QA_AWS_ACCESS_KEY,
        port: '42001',
        username: 'pmm',
        mysqlaurora2: {
          address: process.env.PMM_QA_AURORA2_MYSQL_HOST,
          password: process.env.PMM_QA_AURORA2_MYSQL_PASSWORD,
          instance_id: 'pmm-qa-aurora2-mysql-instance-1',
          cluster_name: 'mysqlaws_aurora2',
        },
        mysqlaurora3: {
          username: process.env.PMM_QA_AURORA3_MYSQL_USER,
          address: process.env.PMM_QA_AURORA3_MYSQL_HOST,
          port: process.env.PMM_QA_AURORA3_MYSQL_PORT,
          password: process.env.PMM_QA_AURORA3_MYSQL_PASSWORD,
          instance_id: 'pmm-qa-aurora3-mysql-instance-1',
          cluster_name: 'mysqlaws_aurora3',
        },
        postgres15aurora: {
          address: process.env.PMM_QA_RDS_AURORA_PGSQL15_HOST,
          username: process.env.PMM_QA_RDS_AURORA_PGSQL15_USER,
          password: process.env.PMM_QA_RDS_AURORA_PGSQL15_PASSWORD,
          instance_id: 'pmm-qa-rds-aurora-15-instance-1',
          cluster_name: 'postgres15aws_aurora',
        },
        postgres16aurora: {
          address: process.env.PMM_QA_RDS_AURORA_PGSQL16_HOST,
          username: process.env.PMM_QA_RDS_AURORA_PGSQL16_USER,
          password: process.env.PMM_QA_RDS_AURORA_PGSQL16_PASSWORD,
          instance_id: 'pmm-qa-aurora-postgres-16-6-instance-1',
          cluster_name: 'postgres16aws_aurora',
        },
      },
    },
    azure: {
      azure_client_id: secret(process.env.AZURE_CLIENT_ID),
      azure_client_secret: secret(process.env.AZURE_CLIENT_SECRET),
      azure_tenant_id: secret(process.env.AZURE_TENNANT_ID),
      azure_subscription_id: secret(process.env.AZURE_SUBSCRIPTION_ID),
      azure_mysql: {
        userName: secret(process.env.AZURE_MYSQL_USER),
        password: secret(process.env.AZURE_MYSQL_PASS),
      },
      azure_postgresql: {
        userName: secret(process.env.AZURE_POSTGRES_USER),
        password: secret(process.env.AZURE_POSTGRES_PASS),
      },
    },
    gc: {
      gc_postgresql: {
        address: process.env.GCP_SERVER_IP,
        userName: process.env.GCP_USER,
        password: process.env.GCP_USER_PASSWORD,
      },
      gc_mysql57: {
        type: 'mysql',
        serviceName: 'gc-mysql57',
        port: '3306',
        host: secret(process.env.GCP_MYSQL57_HOST),
        username: secret(process.env.GCP_MYSQL57_USER),
        password: secret(process.env.GCP_MYSQL57_PASSWORD),
        cluster: 'gc-mysql57',
        environment: 'gc-mysql57',
      },
      gc_mysql80: {
        type: 'mysql',
        serviceName: 'gc-mysql80',
        port: '3306',
        host: secret(process.env.GCP_MYSQL80_HOST),
        username: secret(process.env.GCP_MYSQL80_USER),
        password: secret(process.env.GCP_MYSQL80_PASSWORD),
        cluster: 'gc-mysql80',
        environment: 'gc-mysql80',
      },
      gc_mysql84: {
        type: 'mysql',
        serviceName: 'gc-mysql84',
        port: '3306',
        host: secret(process.env.GCP_MYSQL84_HOST),
        username: secret(process.env.GCP_MYSQL84_USER),
        password: secret(process.env.GCP_MYSQL84_PASSWORD),
        cluster: 'gc-mysql84',
        environment: 'gc-mysql84',
      },
      gc_pgsql_13: {
        type: 'postgresql',
        // using postgres in name makes sure both exporter and QAN agents are verified
        serviceName: 'gc-postgres13',
        port: '5432',
        database: process.env.GCP_PGSQL13_USER,
        host: secret(process.env.GCP_PGSQL13_HOST),
        username: secret(process.env.GCP_PGSQL13_USER),
        password: secret(process.env.GCP_PGSQL13_PASSWORD),
        cluster: 'gc-pgsql13',
        environment: 'gc-pgsql13',
      },
      gc_pgsql_14: {
        type: 'postgresql',
        // using postgres in name makes sure both exporter and QAN agents are verified
        serviceName: 'gc-postgres14',
        port: '5432',
        database: process.env.GCP_PGSQL14_USER,
        host: secret(process.env.GCP_PGSQL14_HOST),
        username: secret(process.env.GCP_PGSQL14_USER),
        password: secret(process.env.GCP_PGSQL14_PASSWORD),
        cluster: 'gc-pgsql14',
        environment: 'gc-pgsql14',
      },
      gc_pgsql_15: {
        type: 'postgresql',
        // using postgres in name makes sure both exporter and QAN agents are verified
        serviceName: 'gc-postgres15',
        port: '5432',
        database: process.env.GCP_PGSQL15_USER,
        host: secret(process.env.GCP_PGSQL15_HOST),
        username: secret(process.env.GCP_PGSQL15_USER),
        password: secret(process.env.GCP_PGSQL15_PASSWORD),
        cluster: 'gc-pgsql15',
        environment: 'gc-pgsql15',
      },
      gc_pgsql_16: {
        type: 'postgresql',
        // using postgres in name makes sure both exporter and QAN agents are verified
        serviceName: 'gc-postgres16',
        port: '5432',
        database: process.env.GCP_PGSQL16_USER,
        host: secret(process.env.GCP_PGSQL16_HOST),
        username: secret(process.env.GCP_PGSQL16_USER),
        password: secret(process.env.GCP_PGSQL16_PASSWORD),
        cluster: 'gc-pgsql16',
        environment: 'gc-pgsql16',
      },
      gc_pgsql_17: {
        type: 'postgresql',
        // using postgres in name makes sure both exporter and QAN agents are verified
        serviceName: 'gc-postgres17',
        port: '5432',
        database: process.env.GCP_PGSQL17_USER,
        host: secret(process.env.GCP_PGSQL17_HOST),
        username: secret(process.env.GCP_PGSQL17_USER),
        password: secret(process.env.GCP_PGSQL17_PASSWORD),
        cluster: 'gc-pgsql17',
        environment: 'gc-pgsql17',
      },
    },
  },

  // Used for Adding Remote Instance during Upgrade Tests runs for AMI and Docker via API
  instanceTypes: {
    mysql: (remoteInstanceStatus.mysql.ps_8_4.enabled ? 'MySQL' : undefined),
    postgresql: (remoteInstanceStatus.postgresql.pdpgsql_13_3.enabled ? 'PostgreSQL' : undefined),
    mongodb: (remoteInstanceStatus.mongodb.psmdb_4_2.enabled ? 'MongoDB' : undefined),
    proxysql: (remoteInstanceStatus.proxysql.proxysql_2_1_1.enabled ? 'ProxySQL' : undefined),
    rds: (remoteInstanceStatus.aws.aws_rds_8_4.enabled ? 'RDS' : undefined),
    rdsAurora: (remoteInstanceStatus.aurora.aurora2.enabled ? 'RDSAurora' : undefined),
    postgresGC: (remoteInstanceStatus.gc.gc_postgresql.enabled ? 'postgresGC' : undefined),
  },

  // Generic object for each service type, used by both UI/Upgrade jobs depending on the service being used - don't add RDS here
  serviceTypes: {
    mysql: (
      remoteInstanceStatus.mysql.ps_5_7.enabled ? {
        serviceType: SERVICE_TYPE.MYSQL,
        service: 'mysql',
      } : undefined
    ),
    mongodb: (
      remoteInstanceStatus.mongodb.psmdb_4_2.enabled ? {
        serviceType: SERVICE_TYPE.MONGODB,
        service: 'mongodb',
      } : undefined
    ),
    postgresql: (
      remoteInstanceStatus.postgresql.pdpgsql_13_3.enabled ? {
        serviceType: SERVICE_TYPE.POSTGRESQL,
        service: 'postgresql',
      } : undefined
    ),
    proxysql: (
      remoteInstanceStatus.proxysql.proxysql_2_1_1.enabled ? {
        serviceType: SERVICE_TYPE.PROXYSQL,
        service: 'proxysql',
      } : undefined
    ),
    postgresGC: (
      remoteInstanceStatus.gc.gc_postgresql.enabled ? {
        serviceType: SERVICE_TYPE.POSTGRESQL,
        service: 'postgresql',
      } : undefined
    ),
    mysql_ssl: (
      remoteInstanceStatus.mysql.ms_8_0_ssl.enabled ? {
        serviceType: SERVICE_TYPE.MYSQL,
        service: 'mysql',
      } : undefined
    ),
    mongodb_ssl: (
      remoteInstanceStatus.mongodb.mongodb_4_4_ssl.enabled ? {
        serviceType: SERVICE_TYPE.MONGODB,
        service: 'mongodb',
      } : undefined
    ),
    postgres_ssl: (
      remoteInstanceStatus.postgresql.postgres_13_3_ssl.enabled ? {
        serviceType: SERVICE_TYPE.POSTGRESQL,
        service: 'postgresql',
      } : undefined
    ),
  },

  // General Remote Instances Service List, this is what UI-tests job uses to run remote instances tests.
  services: {
    mysql: (remoteInstanceStatus.mysql.ps_5_7.enabled ? 'mysql_remote_new' : undefined),
    mongodb: (remoteInstanceStatus.mongodb.psmdb_4_2.enabled ? 'mongodb_remote_new' : undefined),
    postgresql: (remoteInstanceStatus.postgresql.pdpgsql_13_3.enabled ? 'postgresql_remote_new' : undefined),
    proxysql: (remoteInstanceStatus.proxysql.proxysql_2_1_1.enabled ? 'proxysql_remote_new' : undefined),
    postgresGC: (remoteInstanceStatus.gc.gc_postgresql.enabled ? 'postgresql_GC_remote_new' : undefined),
    mysql_ssl: (remoteInstanceStatus.mysql.ms_8_0_ssl.enabled ? 'mysql_ssl_new' : undefined),
    mongodb_ssl: (remoteInstanceStatus.mongodb.mongodb_4_4_ssl.enabled ? 'mongodb_ssl_new' : undefined),
    postgres_ssl: (remoteInstanceStatus.postgresql.postgres_13_3_ssl.enabled ? 'postgres_ssl_new' : undefined),
  },

  // Only add a service here when you want to include it as part of Upgrade tests cycle for AMI and Docker
  upgradeServiceNames: {
    mysql: (remoteInstanceStatus.mysql.ps_5_7.enabled ? 'mysql_upgrade_service' : undefined),
    mongodb: (remoteInstanceStatus.mongodb.psmdb_4_2.enabled ? 'psmdb_upgrade_scervice' : undefined),
    proxysql: (remoteInstanceStatus.proxysql.proxysql_2_1_1.enabled ? 'proxysql_upgrade_service' : undefined),
    postgresql: (remoteInstanceStatus.postgresql.pdpgsql_13_3.enabled ? 'postgres_upgrade_service' : undefined),
    rds: (remoteInstanceStatus.aws.aws_rds_8_4.enabled ? 'mysql_rds_uprgade_service' : undefined),
    rdsaurora: (remoteInstanceStatus.aurora.aurora2.enabled ? 'aurora_rds_upgrade_service' : undefined),
    postgresgc: (remoteInstanceStatus.gc.gc_postgresql.enabled ? 'postgresql_GC_remote_new' : undefined),
  },

  // Metrics that needs to be checked post upgrade for each Service, only used by Docker Upgrade & AMI upgrade
  upgradeServiceMetricNames: {
    mysql_upgrade_service: 'mysql_global_status_max_used_connections',
    psmdb_upgrade_scervice: 'mongodb_connections',
    proxysql_upgrade_service: 'proxysql_stats_memory_auth_memory',
    postgres_upgrade_service: 'pg_stat_database_xact_rollback',
    mysql_rds_uprgade_service: 'mysql_global_status_max_used_connections',
  },

  // Used by Upgrade Job to test QAN filters
  qanFilters: ['mysql', 'mongodb', 'postgresql', 'rds', 'aurora_rds'],

  getInstanceStatus(instance) {
    return remoteInstanceStatus[Object.keys(remoteInstanceStatus).filter((dbtype) => dbtype === instance)];
  },
};

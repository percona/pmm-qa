import { RemoteUpgradeInstance } from '@api/remoteInstance.api';

// Shared across the upgrade test files (customPassword + externalService).
export const services: RemoteUpgradeInstance[] = [
  {
    connection: {
      address: 'ps_pmm_8_4_1',
      cluster: 'mysql_clstr',
      password: 'GRgrO9301RuF',
      port: '3306',
      username: 'root',
    },
    metric: 'mysql_global_status_max_used_connections',
    name: 'ps_pmm_',
    serviceType: 'mysql',
    upgradeService: 'mysql',
  },
  {
    connection: {
      address: 'pgsql_pgss_pmm_17',
      cluster: 'pgsql_clstr',
      password: 'pmm',
      port: '5432',
      username: 'pmm',
    },
    metric: 'pg_stat_database_xact_rollback',
    name: 'pgsql_pgss_pmm',
    serviceType: 'postgresql',
    upgradeService: 'postgresql',
  },
  {
    connection: {
      address: 'rs101',
      cluster: 'mongo_clstr',
      password: 'pbmpass',
      port: '27017',
      username: 'pbm',
    },
    metric: 'mongodb_connections',
    name: 'rs101',
    serviceType: 'mongodb',
    upgradeService: 'mongodb',
  },
];

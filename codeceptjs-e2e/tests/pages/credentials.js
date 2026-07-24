const { I } = inject();

/**
 * Single Collection of credentials to use in tests.
 * Main purpose to keep it in single place for easy update and maintenance.
 */
module.exports = {
  mongoDb: {
    user: 'pmm_mongodb',
    password: '5M](Q%q/U+YQ<^m',
    port: '27027',
    adminUser: 'mongoadmin',
    adminPassword: 'GRgrO9301RuF',
  },
  mongoReplicaPrimaryForBackups: {
    host: '127.0.0.1',
    port: '27027',
    username: 'pmm',
    password: 'pmmpass',
  },
  perconaServer: {
    root: {
      username: 'root',
      password: 'GRgrO9301RuF',
    },
    msandbox: {
      username: 'msandbox',
      password: 'msandbox',
    },
  },
  postgreSql: {
    port: '5433',
    pmmServerUser: 'pmm-managed',
    pmmServerPassword: 'pmm-managed',
  },
  pdpgsql: {
    port: '5432',
    username: 'pmm',
    password: 'pmm',
  },
  pdpgsql_ssl: {
    port: '5432',
    username: 'pmm',
    password: 'pmm',
  },

  async detectPort(serviceName) {
    return await I.verifyCommand(`pmm-admin list | grep ${serviceName} | awk -F " " '{print $3}' | awk -F ":" '{print $2}'`);
  },
};

const {
  NODE_TYPE, DISCOVER_RDS, REMOTE_INSTANCE_TYPES,
} = require('../../helper/constants');

const {
  remoteInstancesHelper,
  inventoryAPI,
} = inject();

const { I } = inject();

module.exports = {
  /**
   * adds remote instance using API /v1/management/...
   *
   * @param   type          {@link remoteInstancesHelper.instanceTypes}
   * @param   serviceName   name of the service to add
   * @param   creds         optional objects with instance accessing details
   * @returns               {Promise<*|void>}
   * @throws                Assertion {Error} if instance was not added
   */
  async apiAddInstance(type, serviceName, creds = {}) {
    switch (type) {
      case REMOTE_INSTANCE_TYPES.MONGODB:
        return this.addMongodb(serviceName, creds);
      case REMOTE_INSTANCE_TYPES.MYSQL:
        return this.addMysql(serviceName, creds);
      case REMOTE_INSTANCE_TYPES.PROXYSQL:
        return this.addProxysql(serviceName);
      case REMOTE_INSTANCE_TYPES.PGSQL:
        return this.addPostgresql(serviceName, creds);
      case REMOTE_INSTANCE_TYPES.RDS:
        return this.addRDS(serviceName, creds);
      case REMOTE_INSTANCE_TYPES.RDS_PGSQL:
        return this.addRDSPgsql(serviceName, creds);
      case REMOTE_INSTANCE_TYPES.RDS_AURORA:
        return this.addRDSAurora(serviceName, creds);
      case REMOTE_INSTANCE_TYPES.PGSQL_GC:
        return await this.addPostgreSQLGC(serviceName);
      default:
        throw new Error('Unknown instance type');
    }
  },

  async addMysql(serviceName, connection = {}) {
    const {
      host, port, username, password,
    } = connection;
    const body = {
      mysql: {
        add_node: {
          node_name: serviceName,
          node_type: NODE_TYPE.REMOTE,
        },
        port: port || remoteInstancesHelper.remote_instance.mysql.ps_8_4.port,
        qan_mysql_perfschema: true,
        address: host || remoteInstancesHelper.remote_instance.mysql.ps_8_4.host,
        service_name: serviceName,
        username: username || remoteInstancesHelper.remote_instance.mysql.ps_8_4.username,
        password: password || remoteInstancesHelper.remote_instance.mysql.ps_8_4.password,
        cluster: remoteInstancesHelper.remote_instance.mysql.ps_8_4.clusterName,
        engine: DISCOVER_RDS.MYSQL,
        pmm_agent_id: 'pmm-server',
      },
    };

    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendPostRequest('v1/management/services', body, headers);

    I.assertEqual(resp.status, 200, `Instance ${serviceName} was not added for monitoring. ${resp.data.message}`);

    return resp.data;
  },

  async addMysqlSSL(connection) {
    const body = {
      mysql: {
        add_node: {
          node_name: connection.serviceName,
          node_type: NODE_TYPE.REMOTE,
        },
        port: connection.port,
        address: connection.address,
        service_name: connection.serviceName,
        username: connection.username,
        password: connection.password,
        tls: true,
        tls_ca: connection.tlsCAFile,
        tls_key: connection.tlsKeyFile,
        tls_cert: connection.tlsCertFile,
        tls_skip_verify: true,
        cluster: connection.cluster,
        pmm_agent_id: 'pmm-server',
        qan_mysql_perfschema: true,
      },
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendPostRequest('v1/management/services', body, headers);

    I.assertEqual(resp.status, 200, `Instance ${connection.serviceName} was not added for monitoring.  \n ${JSON.stringify(resp.data, null, 2)}`);
  },

  async addPostgresql(serviceName, creds = {}) {
    const {
      host, port, username, password,
    } = creds;
    const body = {
      postgresql: {
        add_node: {
          node_name: serviceName,
          node_type: NODE_TYPE.REMOTE,
        },
        port: port || remoteInstancesHelper.remote_instance.postgresql.pdpgsql_17.server_port,
        address: host || remoteInstancesHelper.remote_instance.postgresql.pdpgsql_17.host,
        service_name: serviceName,
        username: username || remoteInstancesHelper.remote_instance.postgresql.pdpgsql_17.username,
        password: password || remoteInstancesHelper.remote_instance.postgresql.pdpgsql_17.password,
        cluster: remoteInstancesHelper.remote_instance.postgresql.pdpgsql_17.clusterName,
        pmm_agent_id: 'pmm-server',
        qan_postgresql_pgstatmonitor_agent: true,
        tls_skip_verify: true,
      },
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendPostRequest('v1/management/services', body, headers);

    I.assertEqual(resp.status, 200, `Instance ${serviceName} was not added for monitoring.  \n ${JSON.stringify(resp.data, null, 2)}`);
  },

  async addPostgreSqlSSL(connection) {
    const body = {
      postgresql: {
        add_node: {
          node_name: connection.serviceName,
          node_type: NODE_TYPE.REMOTE,
        },
        port: connection.port,
        address: connection.address,
        service_name: connection.serviceName,
        username: connection.username,
        password: connection.password,
        tls: true,
        tls_ca: connection.tlsCAFile,
        tls_key: connection.tlsKeyFile,
        tls_cert: connection.tlsCertFile,
        tls_skip_verify: true,
        cluster: connection.cluster,
        pmm_agent_id: 'pmm-server',
        qan_postgresql_pgstatements_agent: true,
      },
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendPostRequest('v1/management/services', body, headers);

    I.assertEqual(resp.status, 200, `Instance ${connection.serviceName} was not added for monitoring.  \n ${JSON.stringify(resp.data, null, 2)}`);
  },

  async addPostgreSQLGC(serviceName) {
    const body = {
      postgresql: {
        add_node: {
          node_name: serviceName,
          node_type: NODE_TYPE.REMOTE,
        },
        port: 5432,
        address: remoteInstancesHelper.remote_instance.gc.gc_postgresql.address,
        service_name: serviceName,
        username: remoteInstancesHelper.remote_instance.gc.gc_postgresql.userName,
        password: remoteInstancesHelper.remote_instance.gc.gc_postgresql.password,
        cluster: 'postgresql_clust',
        pmm_agent_id: 'pmm-server',
        qan_postgresql_pgstatements_agent: true,
        tls_skip_verify: true,
      },
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendPostRequest('v1/management/services', body, headers);

    I.assertEqual(resp.status, 200, `Instance ${serviceName} was not added for monitoring.  \n ${JSON.stringify(resp.data, null, 2)}`);
  },

  async addProxysql(serviceName) {
    const body = {
      proxysql: {
        add_node: {
          node_name: serviceName,
          node_type: NODE_TYPE.REMOTE,
        },
        port: remoteInstancesHelper.remote_instance.proxysql.pxc_proxysql_8.port,
        address: remoteInstancesHelper.remote_instance.proxysql.pxc_proxysql_8.host,
        service_name: serviceName,
        username: remoteInstancesHelper.remote_instance.proxysql.pxc_proxysql_8.username,
        password: remoteInstancesHelper.remote_instance.proxysql.pxc_proxysql_8.password,
        cluster: remoteInstancesHelper.remote_instance.proxysql.pxc_proxysql_8.clusterName,
        pmm_agent_id: 'pmm-server',
        tls_skip_verify: true,
      },
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendPostRequest('v1/management/services', body, headers);

    I.assertEqual(resp.status, 200, `Instance ${serviceName} was not added for monitoring. \n ${JSON.stringify(resp.data, null, 2)}`);
  },

  async addMongodb(serviceName, creds = {}) {
    const {
      host, port, username, password,
    } = creds;
    const body = {
      mongodb: {
        add_node: {
          node_name: serviceName,
          node_type: NODE_TYPE.REMOTE,
        },
        port: port || remoteInstancesHelper.remote_instance.mongodb.psmdb_7.port,
        address: host || remoteInstancesHelper.remote_instance.mongodb.psmdb_7.host,
        service_name: serviceName,
        username: username || remoteInstancesHelper.remote_instance.mongodb.psmdb_7.username,
        password: password || remoteInstancesHelper.remote_instance.mongodb.psmdb_7.password,
        cluster: remoteInstancesHelper.remote_instance.mongodb.psmdb_7.clusterName,
        pmm_agent_id: 'pmm-server',
        qan_mongodb_profiler: true,
        tls_skip_verify: true,
      },
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendPostRequest('v1/management/services', body, headers);

    I.assertEqual(resp.status, 200, `Instance ${serviceName} was not added for monitoring, \n ${JSON.stringify(resp.data, null, 2)}`);
  },

  async addMongoDBSSL(connection) {
    const body = {
      mongodb: {
        add_node: {
          node_name: connection.serviceName,
          node_type: NODE_TYPE.REMOTE,
        },
        port: connection.port,
        address: connection.address,
        service_name: connection.serviceName,
        tls: true,
        tls_certificate_file_password: connection.tls_certificate_file_password,
        tls_certificate_key: connection.tls_certificate_key,
        tls_ca: connection.tls_ca,
        tls_skip_verify: true,
        cluster: connection.cluster,
        pmm_agent_id: 'pmm-server',
        qan_mongodb_profiler: true,
        authentication_mechanism: 'MONGODB-X509',
      },
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendPostRequest('v1/management/services', body, headers);

    I.assertEqual(resp.status, 200, `Instance ${connection.serviceName} was not added for monitoring. \n ${JSON.stringify(resp.data, null, 2)}`);
  },

  async addRDS(serviceName, connection = {}) {
    const {
      port, username, password, address, cluster, aws_access_key, aws_secret_key,
    } = connection;
    const body = {
      rds: {
        add_node: {
          node_name: serviceName,
          node_type: NODE_TYPE.REMOTE,
        },
        address: address || remoteInstancesHelper.remote_instance.aws.aws_rds_8_4.address,
        aws_access_key: aws_access_key || remoteInstancesHelper.remote_instance.aws.aws_access_key,
        aws_secret_key: aws_secret_key || remoteInstancesHelper.remote_instance.aws.aws_secret_key,
        service_name: serviceName,
        username: username || remoteInstancesHelper.remote_instance.aws.aws_rds_8_4.username,
        password: password || remoteInstancesHelper.remote_instance.aws.aws_rds_8_4.password,
        az: 'us-east-2a',
        cluster: cluster || remoteInstancesHelper.remote_instance.aws.aws_rds_8_4.clusterName,
        engine: DISCOVER_RDS.MYSQL,
        instance_id: serviceName,
        isRDS: true,
        pmm_agent_id: 'pmm-server',
        port: port || remoteInstancesHelper.remote_instance.aws.aws_rds_8_4.port,
        qan_mysql_perfschema: true,
        rds_exporter: true,
        region: 'us-east-2',
        replication_set: 'rds_mysql_repl',
        tls_skip_verify: true,
        disable_basic_metrics: false,
        disable_enhanced_metrics: false,
      },
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendPostRequest('v1/management/services', body, headers);

    I.assertEqual(resp.status, 200, `Instance ${serviceName} was not added for monitoring. \n ${JSON.stringify(resp.data, null, 2)}`);

    return resp.data;
  },

  async addRDSPgsql(serviceName, connection = {}) {
    const {
      port, username, password, address, cluster, aws_access_key, aws_secret_key, az, engine,
    } = connection;
    const body = {
      rds: {
        address: address || remoteInstancesHelper.remote_instance.aws.aws_rds_8_4.address,
        aws_access_key: aws_access_key || remoteInstancesHelper.remote_instance.aws.aws_access_key,
        aws_secret_key: aws_secret_key || remoteInstancesHelper.remote_instance.aws.aws_secret_key,
        service_name: serviceName,
        username: username || remoteInstancesHelper.remote_instance.aws.aws_rds_8_4.username,
        password: password || remoteInstancesHelper.remote_instance.aws.aws_rds_8_4.password,
        az: az || 'us-east-2a',
        cluster: cluster || remoteInstancesHelper.remote_instance.aws.aws_rds_8_4.clusterName,
        engine: engine || DISCOVER_RDS.MYSQL,
        instance_id: serviceName,
        isRDS: true,
        pmm_agent_id: 'pmm-server',
        port: port || remoteInstancesHelper.remote_instance.aws.aws_rds_8_4.port,
        qan_postgresql_pgstatements: true,
        rds_exporter: true,
        region: 'us-east-2',
        replication_set: 'rds_mysql_repl',
        disable_basic_metrics: false,
        disable_enhanced_metrics: false,
        disable_comments_parsing: true,
      },
    };

    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendPostRequest('v1/management/services', body, headers);

    I.assertEqual(resp.status, 200, `Instance ${serviceName} was not added for monitoring. \n ${JSON.stringify(resp.data, null, 2)}`);

    return resp.data;
  },

  async addRDSAurora(serviceName, connection = {}) {
    const {
      port, username, password, address, cluster, aws_access_key, aws_secret_key,
    } = connection;
    const body = {
      rds: {
        add_node: {
          node_name: serviceName,
          node_type: NODE_TYPE.REMOTE,
        },
        aws_access_key: aws_access_key || remoteInstancesHelper.remote_instance.aws.aurora.aws_access_key,
        aws_secret_key: aws_secret_key || remoteInstancesHelper.remote_instance.aws.aurora.aws_secret_key,
        address: address || remoteInstancesHelper.remote_instance.aws.aurora.mysqlaurora3.address,
        service_name: serviceName,
        port: port || remoteInstancesHelper.remote_instance.aws.aurora.mysqlaurora3.port,
        username: username || remoteInstancesHelper.remote_instance.aws.aurora.mysqlaurora3.username,
        password: password || remoteInstancesHelper.remote_instance.aws.aurora.mysqlaurora3.password,
        instance_id: remoteInstancesHelper.remote_instance.aws.aurora.mysqlaurora3.instance_id,
        cluster: cluster || remoteInstancesHelper.remote_instance.aws.aurora.mysqlaurora3.cluster_name,
        region: 'us-east-2',
        isRDS: true,
        az: 'us-east-2a',
        pmm_agent_id: 'pmm-server',
        qan_mysql_perfschema: true,
        rds_exporter: true,
        engine: DISCOVER_RDS.MYSQL,
        replication_set: 'rds_mysql_repl',
        tls_skip_verify: true,
        disable_basic_metrics: false,
        disable_enhanced_metrics: false,
      },
    };

    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendPostRequest('v1/management/services', body, headers);

    I.assertEqual(resp.status, 200, `Instance ${serviceName} was not added for monitoring. \n ${JSON.stringify(resp.data, null, 2)}`);

    return resp.data;
  },

  async addRDSPostgresql(serviceName, connection = {}) {
    const {
      port, username, password, address, cluster, aws_access_key, aws_secret_key,
    } = connection;
    const body = {
      add_node: {
        node_name: serviceName,
        node_type: 'REMOTE_NODE',
      },
      address: address || remoteInstancesHelper.remote_instance.aws.aws_postgresql_12.address,
      aws_access_key: aws_access_key || remoteInstancesHelper.remote_instance.aws.aws_access_key,
      aws_secret_key: aws_secret_key || remoteInstancesHelper.remote_instance.aws.aws_secret_key,
      service_name: serviceName,
      username: username || remoteInstancesHelper.remote_instance.aws.aws_postgresql_12.userName,
      password: password || remoteInstancesHelper.remote_instance.aws.aws_postgresql_12.password,
      az: 'us-east-2b',
      database: remoteInstancesHelper.remote_instance.aws.aws_postgresql_12.database,
      cluster: cluster || remoteInstancesHelper.remote_instance.aws.aws_postgresql_12.clusterName,
      engine: 'DISCOVER_RDS_POSTGRESQL',
      instance_id: 'pmm-qa-pgsql-12',
      isRDS: true,
      pmm_agent_id: 'pmm-server',
      port: port || remoteInstancesHelper.remote_instance.aws.aws_postgresql_12.port,
      rds_exporter: true,
      region: 'us-east-2',
      metrics_mode: 1,
      tls_skip_verify: true,
      disable_comments_parsing: true,
      qan_postgresql_pgstatements: true,
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendPostRequest('v1/management/RDS/Add', body, headers);

    I.assertEqual(resp.status, 200, `Instance ${serviceName} was not added for monitoring. \n ${JSON.stringify(resp.data, null, 2)}`);

    return resp.data;
  },

  async addExternalService(serviceName) {
    const body = {
      external: {
        add_node: {
          node_name: serviceName,
          node_type: NODE_TYPE.REMOTE,
        },
        address: remoteInstancesHelper.remote_instance.external.redis.host,
        service_name: serviceName,
        schema: remoteInstancesHelper.remote_instance.external.redis.schema,
        cluster: remoteInstancesHelper.remote_instance.external.redis.clusterName,
        listen_port: remoteInstancesHelper.remote_instance.external.redis.port,
        metrics_path: remoteInstancesHelper.remote_instance.external.redis.metricsPath,
        group: remoteInstancesHelper.remote_instance.external.redis.group,
      },
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendPostRequest('v1/management/services', body, headers);

    I.assertEqual(
      resp.status,
      200,
      `External Service ${serviceName} was not added for monitoring got following response ${JSON.stringify(resp.data)}`,
    );
  },

  async addInstanceForSTT(connection, instanceName = 'stt-mysql-5.7.30') {
    await inventoryAPI.deleteNodeByServiceName(remoteInstancesHelper.serviceTypes.mysql.serviceType, instanceName);
    let instance;

    if (process.env.OVF_TEST === 'yes') {
      instance = await this.apiAddInstance(remoteInstancesHelper.instanceTypes.rds, instanceName);
    } else {
      instance = await this.apiAddInstance(remoteInstancesHelper.instanceTypes.mysql, instanceName, connection);
    }

    const nodeId = instance.service.node_id;
    const serviceId = instance.service.service_id;

    return [nodeId, serviceId];
  },
};

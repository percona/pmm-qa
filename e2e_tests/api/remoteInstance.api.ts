import { APIRequestContext, expect } from '@playwright/test';
import apiEndpoints from '../helpers/apiEndpoints';
import GrafanaHelper from '../helpers/grafana.helper';

type Headers = Record<string, string>;

export interface AddRemoteInstance {
  mongodb?: RemoteInstanceBody;
  external?: RemoteInstanceBody;
  mysql?: RemoteInstanceBody;
  postgresql?: RemoteInstanceBody;
  rds?: RemoteInstanceBody;
}

export interface RemoteUpgradeInstance {
  connection: {
    address: string;
    cluster: string;
    password: string;
    port: string;
    username: string;
  };
  metric: string;
  name: string;
  serviceType: 'mysql' | 'postgresql' | 'mongodb';
  upgradeService: string;
}

interface RemoteInstanceBody {
  metricsParameters?: string;
  schema?: 'https' | 'http';
  pmm_agent_id?: string;
  port?: string;
  cluster?: string;
  group?: string;
  listen_port?: string;
  metrics_path?: string;
  address: string;
  username?: string;
  password?: string;
  skip_connection_check?: boolean;
  service_name: string;
  add_node: {
    node_name: string;
    node_type: 'NODE_TYPE_REMOTE_NODE';
  };
  metrics_mode?: number;
  tls?: boolean;
  tls_certificate_file_password?: string;
  tls_ca?: string;
  tls_certificate_key?: string;
  tls_skip_verify?: boolean;
  authentication_mechanism?: string;
  engine?: 'DISCOVER_RDS_ENGINE_MYSQL';
  aws_access_key?: string;
  aws_secret_key?: string;
  az?: string;
  disable_basic_metrics?: boolean;
  disable_enhanced_metrics?: boolean;
  instance_id?: string;
  isRDS?: boolean;
  rds_exporter?: boolean;
  region?: string;
  replication_set?: string;
  qan_mysql_perfschema?: boolean;
  qan_postgresql_pgstatmonitor_agent?: boolean;
  qan_mongodb_profiler?: boolean;
}

const remoteServiceConnections = {
  mongodb: {
    address: 'rs101',
    cluster: 'mongo_clstr',
    password: 'pbmpass',
    port: '27017',
    qan_mongodb_profiler: true,
    tls_skip_verify: true,
    username: 'pbm',
  },
  mysql: {
    address: 'ps_pmm_8_4_1',
    cluster: 'mysql_clstr',
    engine: 'DISCOVER_RDS_ENGINE_MYSQL',
    password: 'GRgrO9301RuF',
    port: '3306',
    qan_mysql_perfschema: true,
    username: 'root',
  },
  postgresql: {
    address: 'pdpgsql_pmm_17_1',
    cluster: 'pgsql_clstr',
    password: 'pmm',
    port: '5432',
    qan_postgresql_pgstatmonitor_agent: true,
    tls_skip_verify: true,
    username: 'pmm',
  },
} as const;

export default class RemoteInstanceApi {
  constructor(private request: APIRequestContext) {}

  addRemoteInstance = async (remoteInstance: AddRemoteInstance, headers?: Headers) => {
    const authHeaders = headers ? headers : GrafanaHelper.getAuthHeader();
    const response = await this.request.post(apiEndpoints.management.services, {
      data: remoteInstance,
      headers: authHeaders,
    });

    expect(response.status()).toEqual(200);
  };

  addRemoteService = async (
    serviceType: keyof typeof remoteServiceConnections,
    serviceName: string,
    options: Pick<RemoteInstanceBody, 'skip_connection_check'> = {},
  ) =>
    this.addRemoteInstance({
      [serviceType]: {
        add_node: { node_name: serviceName, node_type: 'NODE_TYPE_REMOTE_NODE' },
        pmm_agent_id: 'pmm-server',
        service_name: serviceName,
        ...remoteServiceConnections[serviceType],
        ...options,
      },
    });

  buildRemoteInstanceDataBody = (instance: RemoteUpgradeInstance): AddRemoteInstance => {
    const body = {
      add_node: { node_name: instance.name, node_type: 'NODE_TYPE_REMOTE_NODE' as const },
      pmm_agent_id: 'pmm-server',
      service_name: instance.name,
      ...instance.connection,
    };

    switch (instance.serviceType) {
      case 'mysql':
        return { mysql: { ...body, engine: 'DISCOVER_RDS_ENGINE_MYSQL', qan_mysql_perfschema: true } };
      case 'postgresql':
        return { postgresql: { ...body, qan_postgresql_pgstatmonitor_agent: true, tls_skip_verify: true } };
      case 'mongodb':
        return { mongodb: { ...body, qan_mongodb_profiler: true, tls_skip_verify: true } };
      default:
        throw new Error(`Unknown remote instance type: ${instance.serviceType}`);
    }
  };
}

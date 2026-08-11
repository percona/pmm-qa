import { APIRequestContext, expect } from '@playwright/test';
import apiEndpoints from '../helpers/apiEndpoints';
import GrafanaHelper from '../helpers/grafana.helper';

type Headers = Record<string, string>;

export interface AddRemoteInstance {
  mongodb?: RemoteInstanceBody;
  external?: RemoteInstanceBody;
  mysql?: RemoteInstanceBody;
  postgresql?: RemoteInstanceBody;
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
  tls_certificate_file_password?: string;
  tls_ca?: string;
  tls_certificate_key?: string;
  tls_skip_verify?: boolean;
  engine?: 'DISCOVER_RDS_ENGINE_MYSQL';
  qan_mysql_perfschema?: boolean;
  qan_postgresql_pgstatmonitor_agent?: boolean;
  qan_mongodb_profiler?: boolean;
}

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

  buildRemoteInstanceDataBody = (instance: RemoteUpgradeInstance): AddRemoteInstance => {
    const body = {
      add_node: { node_name: instance.serviceName, node_type: 'NODE_TYPE_REMOTE_NODE' as const },
      pmm_agent_id: 'pmm-server',
      service_name: instance.serviceName,
      ...instance.connection,
    };

    switch (instance.type) {
      case 'mysql':
        return { mysql: { ...body, engine: 'DISCOVER_RDS_ENGINE_MYSQL', qan_mysql_perfschema: true } };
      case 'postgresql':
        return { postgresql: { ...body, qan_postgresql_pgstatmonitor_agent: true, tls_skip_verify: true } };
      case 'mongodb':
        return { mongodb: { ...body, qan_mongodb_profiler: true, tls_skip_verify: true } };
      default:
        throw new Error(`Unknown remote instance type: ${instance.type}`);
    }
  };
}

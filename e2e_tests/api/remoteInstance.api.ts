import { APIRequestContext, expect } from '@playwright/test';
import apiEndpoints from '../helpers/apiEndpoints';
import GrafanaHelper from '../helpers/grafana.helper';

type Headers = Record<string, string>;

export interface AddRemoteInstance {
  mongodb?: {
    metricsParameters?: string;
    schema: 'https' | 'http';
    pmm_agent_id: string;
    port: string;
    address: string;
    username: string;
    password: string;
    skip_connection_check: boolean;
    service_name: string;
    add_node: {
      node_name: string;
      node_type: 'NODE_TYPE_REMOTE_NODE';
    };
    metrics_mode: number;
  };
}
export default class RemoteInstanceApi {
  constructor(private request: APIRequestContext) {}

  addRemoteInstance = async (remoteInstance: AddRemoteInstance, headers: Headers) => {
    const authHeaders = headers ? headers : GrafanaHelper.getAuthHeader();
    const response = await this.request.post(apiEndpoints.management.services, {
      data: remoteInstance,
      headers: authHeaders,
    });

    expect(response.status()).toEqual(200);
  };
}

import { APIRequestContext, expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';

export interface AddInstance {
  rds?: AddInstanceRDS;
}

interface AddInstanceRDS {
  address?: string;
  aws_access_key?: string;
  aws_secret_key?: string;
  az?: 'us-east-2b';
  disable_comments_parsing?: boolean;
  engine?: 'DISCOVER_RDS_ENGINE_MYSQL';
  instance_id?: string;
  isRDS?: boolean;
  metrics_mode?: number;
  node_name?: string;
  password?: string;
  node_id: string;
  pmm_agent_id?: 'pmm-server' | string;
  port?: number;
  qan_mysql_perfschema?: boolean;
  rds_exporter?: boolean;
  region?: 'us-east-2';
  service_name?: string;
  tablestatOptions?: 'enabled' | 'disabled';
  tablestats_group_table_limit?: number;
  username?: string;
}

export interface AddAzure {
  port: string;
  username?: string;
  address?: string;
  isAzure: boolean;
  region: string;
  azure_client_id?: string;
  azure_client_secret?: string;
  azure_tenant_id?: string;
  azure_subscription_id?: string;
  azure_resource_group: string;
  instance_id: string;
  az: string;
  azure_database_exporter: boolean;
  qan_mysql_perfschema: boolean;
  disable_comments_parsing: boolean;
  tablestatOptions: 'disabled' | 'enabled';
  tablestats_group_table_limit: number;
  pmm_agent_id: string;
  password?: string;
  service_name?: string;
  type: 'DISCOVER_AZURE_DATABASE_TYPE_MYSQL';
  node_name?: string;
  qan: boolean;
  metrics_mode: number;
}

export default class ManagementApi {
  constructor(private request: APIRequestContext) {}

  addAzure = async (addInstance: AddAzure) => {
    const res = await this.request.post(apiEndpoints.management.azure, {
      data: addInstance,
      headers: GrafanaHelper.getAuthHeader(),
      ignoreHTTPSErrors: true,
      timeout: Timeouts.THIRTY_SECONDS,
    });

    expect(res.status(), `API call to add instance failed with error: ${res.statusText()}`).toBe(200);

    return await res.json();
  };

  addService = async (addInstance: AddInstance) => {
    const res = await this.request.post(apiEndpoints.management.services, {
      data: addInstance,
      headers: GrafanaHelper.getAuthHeader(),
      ignoreHTTPSErrors: true,
      timeout: Timeouts.THIRTY_SECONDS,
    });

    expect(res.status(), `API call to add instance failed with error: ${res.statusText()}`).toBe(200);

    return await res.json();
  };

  discoverRDS = async (
    accessKey = process.env.PMM_QA_AWS_ACCESS_KEY_ID,
    secretKey = process.env.PMM_QA_AWS_ACCESS_KEY,
  ) => {
    const res = await this.request.post(apiEndpoints.management.discoverRDS, {
      data: { aws_access_key: accessKey, aws_secret_key: secretKey },
      headers: GrafanaHelper.getAuthHeader(),
      ignoreHTTPSErrors: true,
    });

    expect(res.status(), `Api call to discover RDS was not successful.`).toBe(200);

    return await res.json();
  };

  getNodeDetails = async (nodeName?: string) => {
    if (!nodeName) {
      throw new Error('Provide nodeName to filter details!');
    }

    const res = await this.request.get(apiEndpoints.management.nodes, {
      headers: GrafanaHelper.getAuthHeader(),
      ignoreHTTPSErrors: true,
    });

    return (await res.json()).nodes.find((node: { node_name: string }) => node.node_name === nodeName);
  };
}

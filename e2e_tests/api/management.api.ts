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
  pmm_agent_id?: 'pmm-server';
  port?: number;
  qan_mysql_perfschema?: boolean;
  rds_exporter?: boolean;
  region?: 'us-east-2';
  service_name?: string;
  tablestatOptions?: 'enabled' | 'disabled';
  tablestats_group_table_limit?: number;
  username?: string;
}

export default class ManagementApi {
  constructor(private request: APIRequestContext) {}

  addService = async (addInstance: AddInstance) => {
    console.log(addInstance);

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

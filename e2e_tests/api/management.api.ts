import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';
import { AddRdsParameters, AddRdsResponse } from '@interfaces/inventory';

// The Percona QA RDS instances listen on a non-default port, all in one region.
const rdsPort = 42_001;
const rdsRegion = 'us-east-2';

export default class ManagementApi {
  constructor(private request: APIRequestContext) {}

  addRds = async (parameters: AddRdsParameters): Promise<AddRdsResponse> => {
    const response = await this.request.post(apiEndpoints.management.services, {
      data: {
        rds: {
          address: parameters.address,
          aws_access_key: parameters.awsAccessKey,
          aws_secret_key: parameters.awsSecretKey,
          engine: 'DISCOVER_RDS_ENGINE_MYSQL',
          instance_id: parameters.instanceId,
          node_name: parameters.serviceName,
          password: parameters.password,
          port: rdsPort,
          qan_mysql_perfschema: true,
          region: rdsRegion,
          service_name: parameters.serviceName,
          tls_skip_verify: true,
          username: parameters.username,
        },
      },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(
      response.status(),
      `Adding RDS service "${parameters.serviceName}" failed: ${await response.text()}`,
    ).toEqual(200);

    return (await response.json()) as AddRdsResponse;
  };

  removeService = async (serviceId: string): Promise<void> => {
    const response = await this.request.delete(`${apiEndpoints.management.services}/${serviceId}`, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), `Removing service "${serviceId}" failed: ${await response.text()}`).toEqual(
      200,
    );
  };
}

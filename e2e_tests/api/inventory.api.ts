import { APIRequestContext, expect, Page } from '@playwright/test';
import GrafanaHelper from '../helpers/grafana.helper';
import { AgentStatus, GetService, GetServices, ServiceType } from '../intefaces/inventory';

export default class InventoryApi {
  constructor(
    private readonly page: Page,
    private request: APIRequestContext,
  ) {}

  getServiceDetailsByPartialName = async (
    partialServiceName: string,
  ): Promise<GetService> => {
    const services = await this.getServices();

    const service = services.services.find((service: GetService) =>
      service.service_name.includes(partialServiceName),
    );

    expect(service, `Service with name ${partialServiceName} is not present`).toBeDefined();

    return service!;
  };

  getServicesByType = async (serviceType: ServiceType) => {
    const serviceList = await this.getServices();

    if (serviceType === ServiceType.postgresql) {
      serviceList.services = serviceList.services.filter(
        (service: GetService) => service.service_name !== 'pmm-server-postgresql',
      );
    }

    const service = serviceList.services.filter(
      (service: GetService) => service.service_type === serviceType,
    );

    expect(service.length, `Service type ${serviceType} is not present`).toBeGreaterThan(0);

    return service;
  };

  getServices = async (): Promise<GetServices> => {
    const authToken = GrafanaHelper.getToken();
    const services = await this.request.get('/v1/management/services', {
      headers: {
        Authorization: `Basic ${authToken}`,
      },
    });

    expect(
      services.status(),
      `Get services API call returned status code: ${services.status()} with error message: ${services.statusText()}`,
    ).toEqual(200);

    return <GetServices>await services.json();
  };

  verifyServiceAgentsStatus = async (service: GetService, expectedStatus: AgentStatus) => {
    const agents = service.agents.filter((agent) => agent.agent_type !== 'pmm-agent');

    for (const agent of agents) {
      expect.soft(agent.status, `Wrong status for agent: ${agent.agent_type}`).toEqual(expectedStatus);
    }
  };
}

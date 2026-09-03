import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import { AgentStatus, GetNode, GetService, GetServices, ServiceType } from '@interfaces/inventory';
import apiEndpoints from '@helpers/apiEndpoints';

export default class InventoryApi {
  constructor(private request: APIRequestContext) {}

  getNodeName = async (nodeId: string): Promise<string> => {
    const response = await this.request.get(`${apiEndpoints.management.nodes}/${nodeId}`, {
      headers: GrafanaHelper.getAuthHeader(),
    });
    const nodes = Object.values((await response.json()) as Record<string, GetNode>).flat();
    const node = nodes.find((node: GetNode) => node.node_id === nodeId);

    if (!node) throw new Error(`Node with id ${nodeId} is not present`);

    return node.node_name;
  };

  getServiceDetailsByPartialName = async (partialServiceName: string): Promise<GetService> => {
    const services = await this.getServices();
    const service = services.services.find((service: GetService) =>
      service.service_name.includes(partialServiceName),
    );

    if (!service) throw new Error(`Service with name ${partialServiceName} is not present`);

    return service;
  };

  getServiceDetailsByRegex = async (regexString: string): Promise<GetService> => {
    const services = await this.getServices();
    const regex = new RegExp(regexString);
    const service = services.services.find((service: GetService) => regex.test(service.service_name));

    if (!service) throw new Error(`Service matching regex: ${regex} is not present`);

    return service;
  };

  getServiceDetailsByRegexAndParameters = async (
    regexString: string,
    parameters: object,
  ): Promise<GetService> => {
    const services = await this.getServices();
    const regex = new RegExp(regexString);
    let filteredServices = services.services.filter((service: GetService) =>
      regex.test(service.service_name),
    );

    Object.entries(parameters).forEach(([key, value]) => {
      filteredServices = filteredServices.filter(
        (service: GetService) => service[key as keyof GetService] === value,
      );
    });

    expect(filteredServices.length, `Service matching regex: ${regex} is not present`).toBeGreaterThan(0);

    return filteredServices[0];
  };

  getServiceDetailsByTypeAndPartialName = async (
    serviceType: ServiceType,
    partialServiceName: string,
  ): Promise<GetService> => {
    const services = (await this.getServicesByType(serviceType)).filter((service: GetService) =>
      service.service_name.includes(partialServiceName),
    );
    const service = services.at(0);

    if (!service) {
      throw new Error(`Service ${partialServiceName} of type ${serviceType} is not present`);
    }

    return service;
  };

  getServices = async (): Promise<GetServices> => {
    const authToken = GrafanaHelper.getToken();
    const services = await this.request.get(apiEndpoints.management.services, {
      headers: {
        Authorization: `Basic ${authToken}`,
      },
    });

    expect(
      services.status(),
      `Get services API call returned status code: ${services.status()} with error message: ${services.statusText()}`,
    ).toEqual(200);

    return (await services.json()) as GetServices;
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

  verifyServiceAgentsStatus = async (service: GetService, expectedStatus: AgentStatus) => {
    const agents = service.agents.filter((agent) => agent.agent_type !== 'pmm-agent');

    for (const agent of agents) {
      expect.soft(agent.status, `Wrong status for agent: ${agent.agent_type}`).toEqual(expectedStatus);
    }
  };
}

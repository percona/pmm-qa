import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import { AgentStatus, GetAgents, GetNode, GetService, GetServices, ServiceType } from '@interfaces/inventory';
import apiEndpoints from '@helpers/apiEndpoints';

export default class InventoryApi {
  constructor(private request: APIRequestContext) {}

  addGenericNode = async (nodeName: string, address = '127.0.0.1'): Promise<string> => {
    const response = await this.request.post(apiEndpoints.inventory.nodes, {
      data: { generic: { address, node_name: nodeName } },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { generic: { node_id: string } }).generic.node_id;
  };

  deleteNode = async (nodeId: string, force: boolean): Promise<void> => {
    const response = await this.request.delete(`${apiEndpoints.management.nodes}/${nodeId}?force=${force}`, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(
      response.status(),
      `Delete node API call returned status code: ${response.status()} with error message: ${response.statusText()}`,
    ).toEqual(200);
  };

  getAgents = async (): Promise<GetAgents> => {
    const response = await this.request.get(apiEndpoints.inventory.agents, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(
      response.status(),
      `Get agents API call returned status code: ${response.status()} with error message: ${response.statusText()}`,
    ).toEqual(200);

    return (await response.json()) as GetAgents;
  };

  getAllNodes = async (): Promise<GetNode[]> => {
    const response = await this.request.get(apiEndpoints.management.nodes, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(
      response.status(),
      `Get nodes API call returned status code: ${response.status()} with error message: ${response.statusText()}`,
    ).toEqual(200);

    return ((await response.json()) as { nodes?: GetNode[] }).nodes ?? [];
  };

  getAllServiceDetailsByRegex = async (regexString: string): Promise<GetService[]> => {
    const services = await this.getServices();
    const regex = new RegExp(regexString);
    const service = services.services.filter((service: GetService) => regex.test(service.service_name));

    if (!service || service.length === 0) throw new Error(`Service matching regex: ${regex} is not present`);

    return service;
  };

  getAllServicesDetailsByPartialName = async (partialServiceName: string): Promise<GetService[]> => {
    const services = await this.getServices();
    const filteredServices = services.services.filter((service: GetService) =>
      service.service_name.includes(partialServiceName),
    );

    if (!filteredServices || filteredServices.length === 0) {
      throw new Error(`Service with name ${partialServiceName} is not present`);
    }

    return filteredServices;
  };

  getNodeWithMysqlService = async (nodeName: string) => {
    const nodes = (await this.getAllNodes()).filter((node) => node.node_name === nodeName);

    expect(nodes, `Node ${nodeName} must be registered exactly once`).toHaveLength(1);

    const services = (await this.getServices()).services.filter(
      (service) => service.node_id === nodes[0].node_id && service.service_type === ServiceType.mysql,
    );

    expect(services, `Node ${nodeName} must have exactly one MySQL service`).toHaveLength(1);

    return {
      nodeId: nodes[0].node_id,
      serviceId: services[0].service_id,
      serviceName: services[0].service_name,
    };
  };

  getServiceAgent = async (serviceType: ServiceType, partialServiceName: string, agentType: string) => {
    const { agents } = await this.getServiceDetailsByTypeAndPartialName(serviceType, partialServiceName);
    const agent = agents.find((serviceAgent) => serviceAgent.agent_type === agentType);

    if (!agent) throw new Error(`Agent ${agentType} of service ${partialServiceName} is not present`);

    return agent;
  };

  getServiceAgents = async (serviceId: string) =>
    Object.values(await this.getAgents())
      .flat()
      .filter((agent) => agent.service_id === serviceId);

  getServiceDetailsByPartialName = async (partialServiceName: string): Promise<GetService> => {
    const services = await this.getServices();
    const service = services.services.find((service: GetService) =>
      service.service_name.includes(partialServiceName),
    );

    if (!service) throw new Error(`Service with name ${partialServiceName} is not present`);

    return service;
  };

  getServiceDetailsByRegex = async (regexString: string): Promise<GetService> =>
    (await this.getAllServiceDetailsByRegex(regexString))[0];

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

  removeNodesByName = async (names: string[]): Promise<void> => {
    for (const { node_id } of (await this.getAllNodes()).filter(({ node_name }) =>
      names.includes(node_name),
    )) {
      await this.deleteNode(node_id, true);
    }
  };

  verifyAgentsAreRunning = async (serviceName: string) =>
    this.getServiceDetailsByPartialName(serviceName)
      .then((service) =>
        service.agents
          .filter((agent) => agent.agent_type !== 'pmm-agent')
          .every((agent) => agent.status === AgentStatus.running),
      )
      .catch(() => false);

  verifyServiceAgentsStatus = async (service: GetService, expectedStatus: AgentStatus) => {
    const agents = service.agents.filter((agent) => agent.agent_type !== 'pmm-agent');

    for (const agent of agents) {
      expect.soft(agent.status, `Wrong status for agent: ${agent.agent_type}`).toEqual(expectedStatus);
    }
  };
}

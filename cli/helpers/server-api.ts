import { expect, test } from '@playwright/test';
import * as cli from '@helpers/cli-helper';

const pmmServerContainer = 'pmm-server';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

export type ServiceStatus = 'STATUS_UP' | 'STATUS_DOWN';

export interface ManagementAgent {
  agent_id: string;
  [field: string]: unknown;
}

interface ManagementService {
  service_name: string;
  status: ServiceStatus;
}

const apiGet = async <T>(path: string): Promise<T> => {
  const output = cli.execute(`docker exec ${pmmServerContainer} curl -fsS -u admin:${adminPassword} 'http://127.0.0.1:8080${path}'`);
  await output.assertSuccess();

  return JSON.parse(output.stdout) as T;
};

export const getAgent = async (serviceId: string, agentId: string): Promise<ManagementAgent> => {
  return test.step(`get agent "${agentId}" from PMM Server`, async () => {
    const { agents } = await apiGet<{ agents: ManagementAgent[] }>(`/v1/management/agents?service_id=${serviceId}`);
    const agent = agents.find((item) => item.agent_id === agentId);

    expect(agent, `Agent ${agentId} is not present on service ${serviceId}`).toBeDefined();

    return agent as ManagementAgent;
  });
};

export const waitForServiceStatus = async (serviceName: string, status: ServiceStatus, timeout: number) => {
  await test.step(`wait for "${serviceName}" service to be ${status}`, async () => {
    await expect(async () => {
      const { services } = await apiGet<{ services: ManagementService[] }>('/v1/management/services');

      expect(services.find((service) => service.service_name === serviceName)?.status).toEqual(status);
    }).toPass({ intervals: [2_000], timeout });
  });
};

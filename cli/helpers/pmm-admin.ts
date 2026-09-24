import { expect, test } from '@playwright/test';
import * as cli from '@helpers/cli-helper';
import { clientCredentialsFlags } from '@helpers/constants';

export const removePGService = async (containerName: string, serviceName: string) => {
  await test.step(`remove postgresql "${serviceName}" service`, async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin remove postgresql ${serviceName}`);
    await output.assertSuccess();
    await output.outContains('Service removed.');
  });
};

export const removeMySQLService = async (containerName: string, serviceName: string) => {
  await test.step(`remove mysql "${serviceName}" service`, async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin remove mysql ${serviceName}`);
    await output.assertSuccess();
    await output.outContains('Service removed.');
  });
};

export const removeMongoService = async (containerName: string, serviceName: string) => {
  await test.step(`remove mongodb "${serviceName}" service`, async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin remove mongodb ${serviceName}`);
    await output.assertSuccess();
    await output.outContains('Service removed.');
  });
};

export const getPmmAdminVersion = async (containerName: string): Promise<string> => {
  return test.step('get pmm admin full version', async () => {
    const prefix = containerName ? `docker exec ${containerName} ` : '';
    const output: { Version: string } = JSON.parse((await cli.exec(`${prefix}pmm-admin --version --json`)).stdout);

    return output.Version.split('-')[0];
  });
};

export const getPmmAdminMinorVersion = async (containerName: string) => {
  return test.step('get pmm admin version', async () => {
    const output = JSON.parse((await cli.exec(`docker exec ${containerName} pmm-admin --version --json`)).stdout);

    return Number(output.Version.split('-')[0].split('.')[1]);
  });
};

export const addMongoServiceAndGetExporterId = async (containerName: string, serviceName: string, address: string) => {
  return test.step(`add mongodb "${serviceName}" service and get its mongodb_exporter id`, async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} ${serviceName} ${address}`);
    await output.assertSuccess();
    const serviceId = output.stdout.match(/Service ID\s*:\s*(\S+)/)?.[1];
    expect(serviceId, `Service ID not found in: ${output.stdout}`).toBeTruthy();

    const list = JSON.parse((await cli.exec(`docker exec ${containerName} pmm-admin list --json`)).stdout);
    const exporter = list.agent.find((a: { agent_type: string, service_id: string }) => a.agent_type === 'AGENT_TYPE_MONGODB_EXPORTER' && a.service_id === serviceId);
    expect(exporter, `mongodb_exporter for service ${serviceId} not found`).toBeTruthy();

    return exporter.agent_id as string;
  });
};

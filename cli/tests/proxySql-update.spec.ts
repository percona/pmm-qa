import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';

const PXC_USER = 'admin';
const PXC_PASSWORD = 'admin';
const dbHostPort = '127.0.0.1:6032';

test.describe('ProxySQL pmm-admin update', { tag: '@proxysql' }, () => {
  // containerName is discovered in beforeAll, so it is read when each test starts.
  let containerName: string;
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  const serviceName = 'proxysql_update_cli';
  let serviceAdded = false;

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps | grep pxc_proxysql_pmm | awk \'{print $NF}\'');
    await result.outContains('pxc_proxysql_pmm', 'PROXYSQL docker container should exist. please run pmm-framework with --database pxc');
    containerName = result.stdout.trim();
  });

  test.afterEach(async ({}) => {
    if (serviceAdded) {
      const output = await cli.exec(`docker exec ${containerName} pmm-admin remove proxysql ${serviceName}`);
      await output.assertSuccess();
      serviceAdded = false;
    }
  });

  test('PMM-T2651 - Verify pmm-admin update proxysql changes the environment in place', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add proxysql --username=${PXC_USER} --password=${PXC_PASSWORD} --port=6032 ${serviceName} ${dbHostPort}`);
    await output.assertSuccess();
    serviceAdded = true;
    const serviceId = await pmmAdmin.getServiceId(containerName, serviceName);
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);

    const result = await pmmAdmin.updateServiceOk(containerName, 'proxysql', `${serviceName} --environment=qa`);
    await result.outContains('ProxySQL Service updated.');
    expect(pmmAdmin.getChangedSettings(result)).toEqual(['--environment=qa (was empty)']);

    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);
    expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    expect((await pmmApi.getServerService(serviceId)).environment).toEqual('qa');
  });
});

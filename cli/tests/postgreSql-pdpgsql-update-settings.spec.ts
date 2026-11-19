import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';

const PGSQL_USER = 'postgres';
const PGSQL_PASSWORD = 'pass+this';
const ipPort = '127.0.0.1:5432';

test.describe('Percona Distribution for PostgreSQL pmm-admin update settings', { tag: '@pdpgsql' }, () => {
  // containerName is discovered in beforeAll, so it is read when each test starts.
  let containerName: string;
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  const serviceName = 'pgsql_update_settings_cli';
  let serviceAdded = false;

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps --format \'{{.Names}}\' | grep \'^pdpgsql_pmm_\'');
    await result.outContains('pdpgsql_pmm', 'PDPGSQL docker container should exist. please run pmm-framework with --database pdpgsql');
    containerName = result.stdout.trim();
  });

  test.afterEach(async ({}) => {
    if (serviceAdded) {
      await pmmAdmin.removePGService(containerName, serviceName);
      serviceAdded = false;
    }
  });

  test('PMM-T2750 - Verify pmm-admin update postgresql changes the auto discovery limit, the database and comments parsing', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add postgresql --query-source=pgstatmonitor --username=${PGSQL_USER} --password=${PGSQL_PASSWORD} ${serviceName} ${ipPort}`);
    await output.assertSuccess();
    serviceAdded = true;
    const serviceId = await pmmAdmin.getServiceId(containerName, serviceName);
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);

    const result = await pmmAdmin.updateServiceJson(containerName, 'postgresql', `${serviceName} --auto-discovery-limit=50 --database=template1 --comments-parsing=on`);
    expect(result.changes.map((change) => change.flag).sort()).toEqual(['--auto-discovery-limit', '--comments-parsing', '--database']);
    expect(pmmAdmin.getSettingValue(result, '--auto-discovery-limit')).toEqual('50');
    expect(pmmAdmin.getSettingValue(result, '--database')).toEqual('template1');
    expect(pmmAdmin.getSettingValue(result, '--comments-parsing')).toEqual('on');

    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);
    expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    await pmmAdmin.expectAgentsRunning(containerName, agentIds, true);
  });
});

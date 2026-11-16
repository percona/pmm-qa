import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';

const PGSQL_USER = 'postgres';
const PGSQL_PASSWORD = 'pass+this';
const ipPort = '127.0.0.1:5432';
const statementsAgent = 'AGENT_TYPE_QAN_POSTGRESQL_PGSTATEMENTS_AGENT';
const monitorAgent = 'AGENT_TYPE_QAN_POSTGRESQL_PGSTATMONITOR_AGENT';

test.describe('PostgreSQL without pg_stat_monitor pmm-admin update', { tag: '@pgsql-pgss' }, () => {
  // containerName is discovered in beforeAll, so it is read when each test starts.
  let containerName: string;
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  const serviceName = 'pgsql_pgss_update_cli';
  let serviceAdded = false;

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps --format \'{{.Names}}\' | grep \'^pgsql_pgss_pmm\'');
    await result.outContains('pgsql_pgss_pmm', 'PostgreSQL docker container should exist. please run pmm-framework with --database pgsql');
    containerName = result.stdout.trim();
  });

  test.afterEach(async ({}) => {
    if (serviceAdded) {
      await pmmAdmin.removePGService(containerName, serviceName);
      serviceAdded = false;
    }
  });

  test('PMM-T2650 - Verify pmm-admin update postgresql falls back to pg_stat_statements with a warning when pg_stat_monitor is missing', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add postgresql --query-source=pgstatements --username=${PGSQL_USER} --password=${PGSQL_PASSWORD} ${serviceName} ${ipPort}`);
    await output.assertSuccess();
    serviceAdded = true;
    const serviceId = await pmmAdmin.getServiceId(containerName, serviceName);
    const statementsId = (await pmmAdmin.findServiceAgent(containerName, serviceId, statementsAgent))?.agent_id;
    expect(statementsId, 'postgresql_pgstatements_agent not found').toBeTruthy();

    const result = await pmmAdmin.updateServiceOk(containerName, 'postgresql', `${serviceName} --query-source=pgstatmonitor`);
    await result.outContains('Warning: Could not to detect the pg_stat_monitor extension on your system. Falling back to the pg_stat_statements.');
    expect(pmmAdmin.getCurrentSettings(result)).toContain('--query-source=pgstatements');

    expect((await pmmAdmin.findServiceAgent(containerName, serviceId, monitorAgent)), 'postgresql_pgstatmonitor_agent is added').toBeUndefined();
    expect((await pmmAdmin.findServiceAgent(containerName, serviceId, statementsAgent))?.agent_id, 'postgresql_pgstatements_agent changed').toEqual(statementsId);
    await pmmAdmin.expectAgentsRunning(containerName, [statementsId!], true);
  });
});

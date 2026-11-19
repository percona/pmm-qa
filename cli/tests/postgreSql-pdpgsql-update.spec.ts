import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';

const PGSQL_USER = 'postgres';
const PGSQL_PASSWORD = 'pass+this';
const ipPort = '127.0.0.1:5432';
const pmmServerPostgresql = 'pmm-server-postgresql';

test.describe('Percona Distribution for PostgreSQL pmm-admin update', { tag: '@pdpgsql' }, () => {
  // containerName is discovered in beforeAll, so it is read when each test starts.
  let containerName: string;
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  const serviceName = 'pgsql_update_cli';
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

  test('PMM-T2647 - Verify pmm-admin update postgresql changes --max-exporter-connections in place', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add postgresql --query-source=pgstatmonitor --username=${PGSQL_USER} --password=${PGSQL_PASSWORD} ${serviceName} ${ipPort}`);
    await output.assertSuccess();
    serviceAdded = true;
    const serviceId = await pmmAdmin.getServiceId(containerName, serviceName);
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);
    const exporter = await pmmAdmin.findServiceAgent(containerName, serviceId, 'AGENT_TYPE_POSTGRES_EXPORTER');
    expect(exporter, 'postgres_exporter not found').toBeTruthy();

    const result = await pmmAdmin.updateServiceOk(containerName, 'postgresql', `${serviceName} --max-exporter-connections=3`);
    expect(pmmAdmin.getChangedSettings(result)).toEqual(['--max-exporter-connections=3 (was 0)']);

    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);
    expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    expect((await pmmApi.getServerAgent(exporter!.agent_id)).max_exporter_connections).toEqual(3);
    await expect(async () => {
      expect(await pmmCli.getExporterArgs(containerName, exporter!.agent_id), 'The limit is not passed to the exporter').toContain('--max-connections=3');
    }).toPass({ intervals: [3_000], timeout: 60_000 });
    await pmmAdmin.expectAgentsRunning(containerName, [exporter!.agent_id], true);
  });

  test('PMM-T2648 - Verify pmm-admin update rejects a query source change of the PostgreSQL of PMM Server', async ({}) => {
    const serviceId = await pmmApi.getServerServiceId(pmmServerPostgresql);
    const agentsBefore = await pmmApi.getServerServiceAgents(serviceId);
    const serviceBefore = await pmmApi.getServerService(serviceId);

    const output = await pmmAdmin.updateService(containerName, 'postgresql', `${pmmServerPostgresql} --query-source=pgstatmonitor`);
    await cli.expectFailure(output, 'The query source of PMM\'s internal PostgreSQL server cannot be changed; QAN for it is turned on and off in Settings.');

    expect(await pmmApi.getServerServiceAgents(serviceId), 'Agents of the PMM Server PostgreSQL changed').toEqual(agentsBefore);
    expect(await pmmApi.getServerService(serviceId), 'PMM Server PostgreSQL changed').toEqual(serviceBefore);
  });

  test('PMM-T2649 - Verify pmm-admin update rejects push metrics mode for a Service monitored by PMM Server', async ({}) => {
    const serviceId = await pmmApi.getServerServiceId(pmmServerPostgresql);
    const agentsBefore = await pmmApi.getServerServiceAgents(serviceId);

    const output = await pmmAdmin.updateService(containerName, 'postgresql', `${pmmServerPostgresql} --metrics-mode=push`);
    await cli.expectFailure(output, 'push metrics mode is not allowed for exporters running on pmm-server');

    expect(await pmmApi.getServerServiceAgents(serviceId), 'Agents of the PMM Server PostgreSQL changed').toEqual(agentsBefore);
    const exporter = agentsBefore.find((agent) => agent.startsWith('postgres_exporter:'))!.split(':')[1];
    expect((await pmmApi.getServerAgent(exporter)).push_metrics_enabled, 'PostgreSQL exporter of PMM Server switched to push').toBe(false);
  });
});

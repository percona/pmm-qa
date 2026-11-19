import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';

const slowlogAgent = 'AGENT_TYPE_QAN_MYSQL_SLOWLOG_AGENT';
const perfschemaAgent = 'AGENT_TYPE_QAN_MYSQL_PERFSCHEMA_AGENT';
const exporterAgent = 'AGENT_TYPE_MYSQLD_EXPORTER';

test.describe('Percona Server pmm-admin update', { tag: '@percona-server' }, () => {
  // containerName is discovered in beforeAll, so it is read when each test starts.
  let containerName: string;
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  const serviceName = 'mysql_update_cli';
  const database = 'pmm_qa_update';
  let serviceAdded = false;

  const addService = async (querySource: string) => pmmAdmin.addMySQLService(containerName, serviceName, querySource, () => {
    serviceAdded = true;
  });

  const mysql = async (args: string) => pmmAdmin.runMySQL(containerName, args);
  const update = async (args: string) => pmmAdmin.updateServiceOk(containerName, 'mysql', `${serviceName} ${args}`);
  const agentId = async (serviceId: string, agentType: string) => pmmAdmin.findServiceAgentId(containerName, serviceId, agentType);

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps --format \'{{.Names}}\' | grep \'^ps_pmm\'');
    await result.outContains('ps_pmm', 'Percona MySQL docker container should exist. please run pmm-framework with --database ps');
    containerName = result.stdout.trim();
  });

  test.afterEach(async ({}) => {
    await pmmCli.runEach([
      async () => {
        if (serviceAdded) await pmmAdmin.removeMySQLService(containerName, serviceName);
        serviceAdded = false;
      },
      async () => {
        await (await mysql(`-e "DROP DATABASE IF EXISTS ${database}"`)).assertSuccess();
      },
    ]);
  });

  test('PMM-T2645 - Verify pmm-admin update mysql switches the query source from slowlog to perfschema', async ({}) => {
    test.setTimeout(6 * 60_000);
    const serviceId = await addService('slowlog');
    const exporterId = await agentId(serviceId, exporterAgent);
    const slowlogId = await agentId(serviceId, slowlogAgent);
    expect(exporterId, 'mysqld_exporter not found').toBeTruthy();
    expect(slowlogId, 'mysql_slowlog_agent not found').toBeTruthy();
    expect(await agentId(serviceId, perfschemaAgent), 'mysql_perfschema_agent should not exist yet').toBeUndefined();

    const output = await update('--query-source=perfschema');
    expect(pmmAdmin.getChangedSettings(output)).toEqual(['--query-source=perfschema (was slowlog)']);

    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);
    expect(await agentId(serviceId, exporterAgent), 'mysqld_exporter ID changed').toEqual(exporterId);
    expect(await agentId(serviceId, slowlogAgent), 'mysql_slowlog_agent is not removed').toBeUndefined();
    const perfschemaId = await agentId(serviceId, perfschemaAgent);
    expect(perfschemaId, 'mysql_perfschema_agent is not added').toBeTruthy();
    await pmmAdmin.expectAgentsRunning(containerName, [perfschemaId!], true);

    await (await mysql(`-e "CREATE DATABASE IF NOT EXISTS ${database}; CREATE TABLE IF NOT EXISTS ${database}.items (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(50))"`)).assertSuccess();
    const from = new Date(Date.now() - 60_000);

    // QAN labels a statement with the schema it ran in, so the statements run with that database selected.
    await expect(async () => {
      await (await mysql(`-D ${database} -e "INSERT INTO items (name) VALUES ('pmm_qa'); SELECT COUNT(*) FROM items"`)).assertSuccess();
      const queries = await pmmApi.getQanQueries(serviceName, database, from, 'schema');
      expect(queries.length, `No queries in QAN for ${serviceName}/${database}`).toBeGreaterThan(0);
    }).toPass({ intervals: [15_000], timeout: 4 * 60_000 });
  });

  test('PMM-T2646 - Verify pmm-admin update mysql removes and restores the QAN agent with --query-source', async ({}) => {
    const serviceId = await addService('perfschema');
    const exporterId = await agentId(serviceId, exporterAgent);
    const perfschemaId = await agentId(serviceId, perfschemaAgent);
    expect(perfschemaId, 'mysql_perfschema_agent not found').toBeTruthy();

    const removed = await update('--query-source=none');
    expect(pmmAdmin.getChangedSettings(removed)).toEqual(['--query-source=none (was perfschema)']);
    expect(await agentId(serviceId, perfschemaAgent), 'mysql_perfschema_agent is not removed').toBeUndefined();
    expect(await agentId(serviceId, slowlogAgent), 'mysql_slowlog_agent should not exist').toBeUndefined();
    expect(await agentId(serviceId, exporterAgent), 'mysqld_exporter ID changed').toEqual(exporterId);

    const restored = await update('--query-source=perfschema');
    expect(pmmAdmin.getChangedSettings(restored)).toEqual(['--query-source=perfschema (was none)']);
    const restoredId = await agentId(serviceId, perfschemaAgent);
    expect(restoredId, 'mysql_perfschema_agent is not added again').toBeTruthy();
    expect(restoredId, 'The removed QAN agent came back instead of a new one').not.toEqual(perfschemaId);
    await pmmAdmin.expectAgentsRunning(containerName, [restoredId!], true);
    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);
  });
});

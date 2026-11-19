import { test, expect, skipWithoutUpdateCommand } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';

const PGSQL_USER = 'postgres';
const PGSQL_PASSWORD = 'pass+this';
const ipPort = '127.0.0.1:5432';

test.describe('Percona Distribution for PostgreSQL pmm-admin update settings', { tag: '@pdpgsql' }, () => {
  // containerName is discovered in beforeAll, so it is read when each test starts.
  let containerName: string;
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  const serviceName = 'pgsql_update_settings_cli';
  const database = 'pmm_qa_update_database';
  let serviceAdded = false;
  let databaseCreated = false;

  const addService = async (querySource: string) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add postgresql --query-source=${querySource} --username=${PGSQL_USER} --password=${PGSQL_PASSWORD} ${serviceName} ${ipPort}`);
    await output.assertSuccess();
    serviceAdded = true;

    return pmmAdmin.getServiceId(containerName, serviceName);
  };

  const update = async (args: string) => pmmAdmin.updateServiceOk(containerName, 'postgresql', `${serviceName} ${args}`);
  const updateJson = async (args: string) => pmmAdmin.updateServiceJson(containerName, 'postgresql', `${serviceName} ${args}`);
  const agentId = async (serviceId: string, agentType: string) => pmmAdmin.findServiceAgentId(containerName, serviceId, agentType);

  const psql = async (db: string, statement: string) => cli.exec(
    `docker exec --user postgres ${containerName} psql -v ON_ERROR_STOP=1 -qAt -d ${db} -c ${cli.shellQuote(statement)}`,
  );

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps --format \'{{.Names}}\' | grep \'^pdpgsql_pmm_\'');
    await result.outContains('pdpgsql_pmm', 'PDPGSQL docker container should exist. please run pmm-framework with --database pdpgsql');
    containerName = result.stdout.trim();
  });

  test.afterEach(async ({}) => {
    await pmmCli.runEach([
      async () => {
        if (serviceAdded) await pmmAdmin.removePGService(containerName, serviceName);
        serviceAdded = false;
      },
      async () => {
        if (databaseCreated) await (await psql('postgres', `DROP DATABASE IF EXISTS ${database} WITH (FORCE)`)).assertSuccess();
        databaseCreated = false;
      },
    ]);
  });

  test('PMM-T2750 - Verify pmm-admin update postgresql changes the auto discovery limit, the database and comments parsing', async ({}) => {
    // pg_stat_monitor is created only in the postgres database of the setup, and its QAN agent waits where it is missing.
    await (await psql('postgres', `CREATE DATABASE ${database}`)).assertSuccess();
    databaseCreated = true;
    await (await psql(database, 'CREATE EXTENSION IF NOT EXISTS pg_stat_monitor')).assertSuccess();

    const serviceId = await addService('pgstatmonitor');
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);

    const result = await pmmAdmin.updateServiceJson(containerName, 'postgresql', `${serviceName} --auto-discovery-limit=50 --database=${database} --comments-parsing=on`);
    expect(result.changes.map((change) => change.flag).sort()).toEqual(['--auto-discovery-limit', '--comments-parsing', '--database']);
    expect(pmmAdmin.getSettingValue(result, '--auto-discovery-limit')).toEqual('50');
    expect(pmmAdmin.getSettingValue(result, '--database')).toEqual(database);
    expect(pmmAdmin.getSettingValue(result, '--comments-parsing')).toEqual('on');

    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);
    expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    await pmmAdmin.expectAgentsRunning(containerName, agentIds, true);
  });

  test.describe('flags without a case key yet', () => {
    const monitorAgent = 'AGENT_TYPE_QAN_POSTGRESQL_PGSTATMONITOR_AGENT';
    const exporterAgent = 'AGENT_TYPE_POSTGRES_EXPORTER';
    const statementsAgent = 'AGENT_TYPE_QAN_POSTGRESQL_PGSTATEMENTS_AGENT';

    test.beforeAll(async ({}) => {
      await skipWithoutUpdateCommand(containerName);
    });

    test('PMM-TXXXX-pg-qan - Verify pmm-admin update postgresql changes the max query length and the query examples of the QAN agent', async ({}) => {
      const serviceId = await addService('pgstatmonitor');
      const monitorId = (await agentId(serviceId, monitorAgent))!;
      expect(monitorId, 'postgresql_pgstatmonitor_agent not found').toBeTruthy();

      const result = await updateJson('--max-query-length=1024 --disable-queryexamples');
      expect(result.changes.map((change) => change.flag).sort()).toEqual(['--disable-queryexamples', '--max-query-length']);
      expect(pmmAdmin.getSettingValue(result, '--max-query-length')).toEqual('1024');
      expect(pmmAdmin.getSettingValue(result, '--disable-queryexamples')).toEqual('true');

      expect(await agentId(serviceId, monitorAgent), 'postgresql_pgstatmonitor_agent is replaced by a change of its settings').toEqual(monitorId);
      await pmmAdmin.expectAgentsRunning(containerName, [monitorId], true);
    });

    test('PMM-TXXXX-pg-query-source-none - Verify pmm-admin update postgresql removes and restores the QAN agent with --query-source', async ({}) => {
      const serviceId = await addService('pgstatmonitor');
      const exporterId = await agentId(serviceId, exporterAgent);
      const monitorId = await agentId(serviceId, monitorAgent);
      expect(monitorId, 'postgresql_pgstatmonitor_agent not found').toBeTruthy();

      const removed = await update('--query-source=none');
      expect(pmmAdmin.getChangedSettings(removed)).toEqual(['--query-source=none (was pgstatmonitor)']);
      expect(await agentId(serviceId, monitorAgent), 'postgresql_pgstatmonitor_agent is not removed').toBeUndefined();
      expect(await agentId(serviceId, exporterAgent), 'postgres_exporter ID changed').toEqual(exporterId);

      const restored = await update('--query-source=pgstatmonitor');
      expect(pmmAdmin.getChangedSettings(restored)).toEqual(['--query-source=pgstatmonitor (was none)']);
      const restoredId = await agentId(serviceId, monitorAgent);
      expect(restoredId, 'postgresql_pgstatmonitor_agent is not added again').toBeTruthy();
      expect(restoredId, 'The removed QAN agent came back instead of a new one').not.toEqual(monitorId);
      await pmmAdmin.expectAgentsRunning(containerName, [restoredId!], true);
    });

    test('PMM-TXXXX-pg-collectors - Verify pmm-admin update postgresql disables and enables a collector', async ({}) => {
      const serviceId = await addService('pgstatmonitor');
      const exporterId = (await agentId(serviceId, exporterAgent))!;
      expect(await pmmCli.getExporterArgs(containerName, exporterId), 'The collector is disabled by default').not.toContain('--no-collector.locks');

      const disabled = await update('--disable-collectors=locks');
      expect(pmmAdmin.getChangedSettings(disabled)).toEqual(['--disable-collectors=locks (was empty)']);
      await expect(async () => {
        expect(await pmmCli.getExporterArgs(containerName, exporterId), 'The collector is still enabled').toContain('--no-collector.locks');
      }).toPass({ intervals: [3_000], timeout: 60_000 });

      const enabled = await update('--disable-collectors=');
      expect(pmmAdmin.getChangedSettings(enabled)).toEqual(['--disable-collectors= (was locks)']);
      await expect(async () => {
        expect(await pmmCli.getExporterArgs(containerName, exporterId), 'The collector is not enabled again').not.toContain('--no-collector.locks');
      }).toPass({ intervals: [3_000], timeout: 60_000 });
    });

    test('PMM-TXXXX-pg-tls-files - Verify pmm-admin update postgresql stores the TLS flags and files', async ({}) => {
      const serviceId = await addService('pgstatmonitor');
      const exporterId = (await agentId(serviceId, exporterAgent))!;
      const certificate = await pmmCli.createSelfSignedCertificate(containerName, 'pgsql_update_tls');

      // This setup has no TLS server, so the connection check is skipped: the test covers what the update sends and hides, not the handshake.
      try {
        const output = await update(`--tls --tls-skip-verify --tls-ca-file=${certificate.cert} --tls-cert-file=${certificate.cert} --tls-key-file=${certificate.key} --skip-connection-check`);
        expect(pmmAdmin.getChangedSettings(output).sort()).toEqual([
          '--tls (was --no-tls)',
          '--tls-ca-file (new value)',
          '--tls-cert-file (new value)',
          '--tls-key-file (new value)',
          '--tls-skip-verify (was --no-tls-skip-verify)',
        ]);
        expect(pmmAdmin.getCurrentSettings(output)).toContain('--tls-key-file=***');
        expect((await pmmApi.getServerAgent(exporterId)).tls, 'TLS is not turned on on PMM Server').toBe(true);
      } finally {
        await (await cli.exec(`docker exec ${containerName} rm -rf ${certificate.dir}`)).assertSuccess();
      }
    });

    test('PMM-TXXXX-pg-query-source-swap - Verify pmm-admin update postgresql swaps the pg_stat_monitor agent for the pg_stat_statements agent and back', async ({}) => {
      const serviceId = await addService('pgstatmonitor');
      const exporterId = await agentId(serviceId, exporterAgent);
      const monitorId = await agentId(serviceId, monitorAgent);
      expect(monitorId, 'postgresql_pgstatmonitor_agent not found').toBeTruthy();

      // pmm-framework does not preload pg_stat_statements, so only the agents are checked, not the data they send.
      const swapped = await update('--query-source=pgstatements');
      expect(pmmAdmin.getChangedSettings(swapped)).toEqual(['--query-source=pgstatements (was pgstatmonitor)']);
      expect(await agentId(serviceId, monitorAgent), 'postgresql_pgstatmonitor_agent is not removed').toBeUndefined();
      expect(await agentId(serviceId, statementsAgent), 'postgresql_pgstatements_agent is not added').toBeTruthy();
      expect(await agentId(serviceId, exporterAgent), 'postgres_exporter ID changed').toEqual(exporterId);

      const back = await update('--query-source=pgstatmonitor');
      expect(pmmAdmin.getChangedSettings(back)).toEqual(['--query-source=pgstatmonitor (was pgstatements)']);
      expect(await agentId(serviceId, statementsAgent), 'postgresql_pgstatements_agent is not removed').toBeUndefined();
      const restoredId = await agentId(serviceId, monitorAgent);
      expect(restoredId, 'postgresql_pgstatmonitor_agent is not added again').toBeTruthy();
      expect(restoredId, 'The removed QAN agent came back instead of a new one').not.toEqual(monitorId);
      await pmmAdmin.expectAgentsRunning(containerName, [restoredId!], true);
    });

    test('PMM-TXXXX-pg-auto-discovery - Verify pmm-admin update postgresql turns database auto-discovery of the exporter off and on', async ({}) => {
      const serviceId = await addService('none');
      const exporterId = (await agentId(serviceId, exporterAgent))!;

      const off = await updateJson('--auto-discovery-limit=-1');
      expect(pmmAdmin.getSettingValue(off, '--auto-discovery-limit')).toEqual('-1');
      await expect(async () => {
        expect(await pmmCli.getExporterArgs(containerName, exporterId), 'Auto-discovery is still on').not.toContain('--auto-discover-databases');
      }).toPass({ intervals: [3_000], timeout: 60_000 });

      const on = await updateJson('--auto-discovery-limit=100');
      expect(pmmAdmin.getSettingValue(on, '--auto-discovery-limit')).toEqual('100');
      await expect(async () => {
        expect(await pmmCli.getExporterArgs(containerName, exporterId), 'Auto-discovery is not on again').toContain('--auto-discover-databases');
      }).toPass({ intervals: [3_000], timeout: 60_000 });
    });

    test('PMM-TXXXX-pg-metrics-mode - Verify pmm-admin update postgresql keeps the metrics reaching PMM Server in pull and push mode', async ({}) => {
      await addService('none');

      for (const mode of ['pull', 'push']) {
        const since = new Date();
        await update(`--metrics-mode=${mode}`);
        await pmmApi.expectSampleSince(`pg_up{service_name="${serviceName}"}`, since);
      }
    });
  });
});

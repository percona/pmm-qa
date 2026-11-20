import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';

const slowlogAgent = 'AGENT_TYPE_QAN_MYSQL_SLOWLOG_AGENT';
const exporterAgent = 'AGENT_TYPE_MYSQLD_EXPORTER';

test.describe('Percona Server pmm-admin update settings', { tag: '@percona-server' }, () => {
  // containerName is discovered in beforeAll, so it is read when each test starts.
  let containerName: string;
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  const serviceName = 'mysql_update_settings_cli';
  let serviceAdded = false;

  const addService = async () => pmmAdmin.addMySQLService(containerName, serviceName, 'slowlog', () => {
    serviceAdded = true;
  });

  const update = async (args: string) => pmmAdmin.updateServiceOk(containerName, 'mysql', `${serviceName} ${args}`);
  const updateJson = async (args: string) => pmmAdmin.updateServiceJson(containerName, 'mysql', `${serviceName} ${args}`);
  const mysqlValue = async (query: string) => (await pmmAdmin.runMySQL(containerName, `-N -e "${query}"`)).stdout.trim();
  const agentId = async (serviceId: string, agentType: string) => pmmAdmin.findServiceAgentId(containerName, serviceId, agentType);

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps --format \'{{.Names}}\' | grep \'^ps_pmm\'');
    await result.outContains('ps_pmm', 'Percona MySQL docker container should exist. please run pmm-framework with --database ps');
    containerName = result.stdout.trim();
  });

  test.afterEach(async ({}) => {
    if (serviceAdded) {
      await pmmAdmin.removeMySQLService(containerName, serviceName);
      serviceAdded = false;
    }
  });

  test('PMM-T2748 - Verify pmm-admin update mysql changes the tablestats limit and the extra DSN parameters', async ({}) => {
    const serviceId = await addService();
    const exporterId = (await agentId(serviceId, exporterAgent))!;
    expect(exporterId, 'mysqld_exporter not found').toBeTruthy();
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);

    const disabled = await updateJson('--disable-tablestats');
    expect(pmmAdmin.getSettingValue(disabled, '--disable-tablestats')).toEqual('true');
    expect(disabled.changes.map((change) => change.flag)).toContain('--disable-tablestats');
    expect((await pmmApi.getServerAgent(exporterId)).tablestats_group_table_limit, 'Tablestats are not disabled on PMM Server').toEqual(-1);
    await expect(async () => {
      expect(await pmmCli.getExporterArgs(containerName, exporterId), 'The tablestats collectors still run').not.toContain('--collect.info_schema.tablestats');
    }).toPass({ intervals: [3_000], timeout: 60_000 });

    const limited = await updateJson('--no-disable-tablestats --disable-tablestats-limit=500');
    expect(pmmAdmin.getSettingValue(limited, '--disable-tablestats')).toEqual('false');
    expect(pmmAdmin.getSettingValue(limited, '--disable-tablestats-limit')).toEqual('500');
    expect((await pmmApi.getServerAgent(exporterId)).tablestats_group_table_limit, 'Tablestats limit is not changed on PMM Server').toEqual(500);

    const dsn = await pmmAdmin.updateServiceOk(containerName, 'mysql', `${serviceName} --extra-dsn-params=allowCleartextPasswords=true`);
    expect(pmmAdmin.getChangedSettings(dsn)).toEqual(['--extra-dsn-params=allowCleartextPasswords=true (was empty)']);
    const cleared = await pmmAdmin.updateServiceOk(containerName, 'mysql', `${serviceName} --extra-dsn-params=`);
    expect(pmmAdmin.getChangedSettings(cleared)).toEqual(['--extra-dsn-params= (was allowCleartextPasswords=true)']);

    expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    await pmmAdmin.expectAgentsRunning(containerName, agentIds, true);
  });

  test('PMM-T2749 - Verify pmm-admin update mysql changes the QAN settings of the slowlog Agent', async ({}) => {
    const serviceId = await addService();
    const slowlogId = (await agentId(serviceId, slowlogAgent))!;
    expect(slowlogId, 'mysql_slowlog_agent not found').toBeTruthy();

    const result = await updateJson('--max-query-length=512 --disable-queryexamples --comments-parsing=on --size-slow-logs=2MiB');
    expect(result.changes.map((change) => change.flag).sort()).toEqual(['--comments-parsing', '--disable-queryexamples', '--max-query-length', '--size-slow-logs']);
    expect(pmmAdmin.getSettingValue(result, '--max-query-length')).toEqual('512');
    expect(pmmAdmin.getSettingValue(result, '--disable-queryexamples')).toEqual('true');
    expect(pmmAdmin.getSettingValue(result, '--comments-parsing')).toEqual('on');
    expect(pmmAdmin.getSettingValue(result, '--size-slow-logs')).toEqual('2MiB');

    expect(await agentId(serviceId, slowlogAgent), 'mysql_slowlog_agent is replaced by a change of its settings').toEqual(slowlogId);
    await pmmAdmin.expectAgentsRunning(containerName, [slowlogId], true);
  });

  test.describe('more update flags', () => {
    const filesDir = '/tmp/mysql_update_tls';
    const tlsChanges = [
      '--tls (was --no-tls)',
      '--tls-ca (new value)',
      '--tls-cert (new value)',
      '--tls-key=*** (was empty)',
      '--tls-skip-verify (was --no-tls-skip-verify)',
    ];

    test.afterEach(async ({}) => {
      await (await cli.exec(`docker exec ${containerName} rm -rf ${filesDir}`)).assertSuccess();
    });

    test('PMM-T2795 - Verify pmm-admin update mysql applies TLS and the client certificate files', async ({}) => {
      const serviceId = await addService();
      const exporterId = (await agentId(serviceId, exporterAgent))!;
      const datadir = await mysqlValue('SELECT @@datadir');

      // The server presents the certificates it generated at its first start, so the connection check completes the TLS handshake with them.
      // Its PEM files end in a NUL byte, which UpdateService stores as is and PostgreSQL refuses (PMM-15949), so the update gets copies without it.
      await (await cli.exec(`docker exec ${containerName} sh -c 'rm -rf ${filesDir} && mkdir ${filesDir} && for f in ca.pem client-cert.pem client-key.pem; do tr -d "\\000" < ${datadir}$f > ${filesDir}/$f; done'`)).assertSuccess();

      const output = await update(`--tls --tls-skip-verify --tls-ca=${filesDir}/ca.pem --tls-cert=${filesDir}/client-cert.pem --tls-key=${filesDir}/client-key.pem`);
      expect(pmmAdmin.getChangedSettings(output).sort()).toEqual(tlsChanges);

      const agent = await pmmApi.getServerAgent(exporterId);
      expect(agent.tls, 'TLS is not turned on on PMM Server').toBe(true);
      expect(agent.tls_skip_verify, 'Certificate verification is not skipped on PMM Server').toBe(true);
      await pmmAdmin.expectAgentsRunning(containerName, [exporterId], true);
    });

    test('PMM-T2814 - Verify pmm-admin update mysql accepts the PEM files of the server as they are', async ({}) => {
      test.skip(true, 'Skipping this test, bug https://perconadev.atlassian.net/browse/PMM-15949');

      const serviceId = await addService();
      const exporterId = (await agentId(serviceId, exporterAgent))!;
      const datadir = await mysqlValue('SELECT @@datadir');

      const output = await update(`--tls --tls-skip-verify --tls-ca=${datadir}ca.pem --tls-cert=${datadir}client-cert.pem --tls-key=${datadir}client-key.pem`);
      expect(pmmAdmin.getChangedSettings(output).sort()).toEqual(tlsChanges);
      expect((await pmmApi.getServerAgent(exporterId)).tls, 'TLS is not turned on on PMM Server').toBe(true);
      await pmmAdmin.expectAgentsRunning(containerName, [exporterId], true);
    });

    test('PMM-T2796 - Verify pmm-admin update mysql disables and enables a collector', async ({}) => {
      const collector = '--collect.perf_schema.eventsstatements';
      const serviceId = await addService();
      const exporterId = (await agentId(serviceId, exporterAgent))!;
      expect(await pmmCli.getExporterArgs(containerName, exporterId), 'The collector is not enabled by default').toContain(collector);

      const disabled = await update('--disable-collectors=perf_schema.eventsstatements');
      expect(pmmAdmin.getChangedSettings(disabled)).toEqual(['--disable-collectors=perf_schema.eventsstatements (was empty)']);
      await expect(async () => {
        expect(await pmmCli.getExporterArgs(containerName, exporterId), 'The collector is still enabled').not.toContain(collector);
      }).toPass({ intervals: [3_000], timeout: 60_000 });

      const enabled = await update('--disable-collectors=');
      expect(pmmAdmin.getChangedSettings(enabled)).toEqual(['--disable-collectors= (was perf_schema.eventsstatements)']);
      await expect(async () => {
        expect(await pmmCli.getExporterArgs(containerName, exporterId), 'The collector is not enabled again').toContain(collector);
      }).toPass({ intervals: [3_000], timeout: 60_000 });
    });

    test('PMM-T2797 - Verify pmm-admin update mysql switches between a socket and an address', async ({}) => {
      const serviceId = await addService();
      const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);
      const socket = await mysqlValue('SELECT @@socket');

      const bySocket = await updateJson(`--socket=${socket}`);
      expect(pmmAdmin.getSettingValue(bySocket, '--socket')).toEqual(socket);
      expect(pmmAdmin.getSettingValue(bySocket, '--host'), 'The address stays next to the socket').toEqual('');
      expect(pmmAdmin.getSettingValue(bySocket, '--port'), 'The port stays next to the socket').toEqual('');
      expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
      await pmmAdmin.expectAgentsRunning(containerName, agentIds, true);

      const byAddress = await updateJson('--host=127.0.0.1 --port=3306');
      expect(pmmAdmin.getSettingValue(byAddress, '--socket'), 'The socket stays next to the address').toEqual('');
      expect(pmmAdmin.getSettingValue(byAddress, '--host')).toEqual('127.0.0.1');
      expect(pmmAdmin.getSettingValue(byAddress, '--port')).toEqual('3306');
      expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
      await pmmAdmin.expectAgentsRunning(containerName, agentIds, true);
    });

    test('PMM-T2798 - Verify pmm-admin update mysql turns comments parsing off and disables slow log rotation', async ({}) => {
      const serviceId = await addService();
      const slowlogId = (await agentId(serviceId, slowlogAgent))!;
      const stored = async () => {
        const agent = await pmmApi.getServerAgent(slowlogId);

        return { commentsParsingDisabled: agent.disable_comments_parsing, maxQueryLogSize: Number(agent.max_slowlog_file_size) };
      };

      const on = await updateJson('--comments-parsing=on --size-slow-logs=2MiB');
      expect(pmmAdmin.getSettingValue(on, '--comments-parsing')).toEqual('on');
      expect(pmmAdmin.getSettingValue(on, '--size-slow-logs')).toEqual('2MiB');
      expect(await stored(), 'The settings are not stored on PMM Server').toEqual({ commentsParsingDisabled: false, maxQueryLogSize: 2 * 1_024 * 1_024 });

      const off = await updateJson('--comments-parsing=off --size-slow-logs=-1B');
      expect(off.changes.map((change) => change.flag).sort()).toEqual(['--comments-parsing', '--size-slow-logs']);
      expect(pmmAdmin.getSettingValue(off, '--comments-parsing')).toEqual('off');
      expect(pmmAdmin.getSettingValue(off, '--size-slow-logs')).toEqual('-1');
      expect(await stored(), 'The server stores a disabled rotation as 0').toEqual({ commentsParsingDisabled: true, maxQueryLogSize: 0 });
      expect(await agentId(serviceId, slowlogAgent), 'mysql_slowlog_agent is replaced by a change of its settings').toEqual(slowlogId);
      await pmmAdmin.expectAgentsRunning(containerName, [slowlogId], true);
    });

    test('PMM-T2799 - Verify pmm-admin update mysql keeps the metrics reaching PMM Server in pull and push mode', async ({}) => {
      await addService();

      for (const mode of ['pull', 'push']) {
        const since = new Date();
        await update(`--metrics-mode=${mode}`);
        await pmmApi.expectSampleSince(`mysql_up{service_name="${serviceName}"}`, since);
      }
    });
  });
});

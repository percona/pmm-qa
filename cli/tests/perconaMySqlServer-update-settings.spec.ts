import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';

const MYSQL_USER = 'root';
const MYSQL_PASSWORD = 'GRgrO9301RuF';
const ipPort = '127.0.0.1:3306';
const slowlogAgent = 'AGENT_TYPE_QAN_MYSQL_SLOWLOG_AGENT';
const exporterAgent = 'AGENT_TYPE_MYSQLD_EXPORTER';

test.describe('Percona Server pmm-admin update settings', { tag: '@percona-server' }, () => {
  // containerName is discovered in beforeAll, so it is read when each test starts.
  let containerName: string;
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  const serviceName = 'mysql_update_settings_cli';
  let serviceAdded = false;

  const addService = async () => {
    await (await cli.exec(`docker exec ${containerName} pmm-admin remove mysql ${serviceName} || true`)).assertSuccess();
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mysql --query-source=slowlog --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} ${serviceName} ${ipPort}`);
    await output.assertSuccess();
    serviceAdded = true;

    return pmmAdmin.getServiceId(containerName, serviceName);
  };

  const updateJson = async (args: string) => pmmAdmin.updateServiceJson(containerName, 'mysql', `${serviceName} ${args}`);
  const agentId = async (serviceId: string, agentType: string) => (await pmmAdmin.findServiceAgent(containerName, serviceId, agentType))?.agent_id;

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

    const limited = await updateJson('--no-disable-tablestats --disable-tablestats-limit=500');
    expect(pmmAdmin.getSettingValue(limited, '--disable-tablestats')).toEqual('false');
    expect(pmmAdmin.getSettingValue(limited, '--disable-tablestats-limit')).toEqual('500');
    expect((await pmmApi.getServerAgent(exporterId)).tablestats_group_table_limit, 'Tablestats limit is not changed on PMM Server').toEqual(500);

    const dsn = await pmmAdmin.updateServiceOk(containerName, 'mysql', `${serviceName} --extra-dsn-params=timeout=5s`);
    expect(pmmAdmin.getChangedSettings(dsn)).toEqual(['--extra-dsn-params=timeout=5s (was empty)']);
    const cleared = await pmmAdmin.updateServiceOk(containerName, 'mysql', `${serviceName} --extra-dsn-params=`);
    expect(pmmAdmin.getChangedSettings(cleared)).toEqual(['--extra-dsn-params= (was timeout=5s)']);

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
});

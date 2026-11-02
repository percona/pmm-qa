import { expect, test } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import { getAgent, waitForServiceStatus } from '@helpers/server-api';

const mysqlPassword = 'GRgrO9301RuF';
const newUsername = 'new_pmmm_username';
const newPassword = 'new_pmm_user_password';
const agentPassword = 'newAgentPassword';
const pmmAgentConfig = '/usr/local/percona/pmm/config/pmm-agent.yaml';
const pmmAgentLog = '/tmp/pmm-agent.log';
let containerName: string;
let serviceName: string;
let serviceId: string;
let mysqldExporterId: string;
let mysqldSlowlogAgentId: string;

const changeExporter = async (flags: string) => cli.exec(`docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} ${flags}`);

const changeSlowlogAgent = async (flags: string) => cli.exec(`docker exec ${containerName} pmm-admin inventory change agent qan-mysql-slowlog-agent ${mysqldSlowlogAgentId} ${flags}`);

const changeBothAgents = async (flags: string) => [await changeExporter(flags), await changeSlowlogAgent(flags)];

const runSql = async (sql: string) => (await cli.exec(`docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "${sql}"`)).assertSuccess();

const waitForAgentStatus = async (agentType: string, status: string) => expect(async () => {
  const output = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${agentType} | grep ${serviceId}`);
  await output.assertSuccess();
  await output.outContains(status);
}).toPass({ intervals: [2_000], timeout: 30_000 });

const exporterPort = async () => (await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${mysqldExporterId} | awk -F' ' '{print $6}'`)).stdout.trim();

test.describe('pmm-admin inventory change agent for MySQL slowlog', { tag: '@ps-slowlog-change-agent' }, () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps --format \'{{.Names}}\' | grep ps_pmm_ | head -1');
    await result.outContains('ps_pmm', 'Percona Server docker container should exist. please run pmm-framework with --database ps,QUERY_SOURCE=slowlog');
    containerName = result.stdout.trim();
    const service = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep ps_pmm | head -1`)).stdout.trim().split(/\s+/);
    serviceName = service[1];
    serviceId = service[3];
    mysqldExporterId = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep mysqld_exporter | awk -F' ' '{print $4}'`)).stdout.trim();
    mysqldSlowlogAgentId = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep mysql_slowlog_agent | awk -F' ' '{print $3}'`)).stdout.trim();
    expect(mysqldExporterId, `mysqld_exporter of ${serviceName} not found`).toBeTruthy();
    expect(mysqldSlowlogAgentId, `mysql_slowlog_agent of ${serviceName} not found, is QUERY_SOURCE=slowlog set?`).toBeTruthy();
  });

  test('PMM-T9991 - Verify Change agent username and password', async ({}) => {
    await runSql(`CREATE USER '${newUsername}'@'%' IDENTIFIED BY '${newPassword}-wrong'; GRANT ALL PRIVILEGES ON *.* TO '${newUsername}'@'%'; FLUSH PRIVILEGES;`);

    for (const output of await changeBothAgents(`--password=${newPassword} --username=${newUsername}`)) {
      await output.outContains('Access denied for user');
    }

    await runSql(`ALTER USER '${newUsername}'@'%' IDENTIFIED BY '${newPassword}'; FLUSH PRIVILEGES;`);

    for (const output of await changeBothAgents(`--password=${newPassword} --username=${newUsername}`)) {
      await output.assertSuccess();
    }

    await waitForServiceStatus(serviceName, 'STATUS_UP', 120_000);
  });

  test('PMM-T99922 - Verify Change agent custom labels', async ({}) => {
    for (const output of await changeBothAgents('--custom-labels=env=qa_testing_mysqld_exporter')) {
      await output.assertSuccess();
    }

    for (const agentId of [mysqldExporterId, mysqldSlowlogAgentId]) {
      expect((await getAgent(serviceId, agentId)).custom_labels).toMatchObject({ env: 'qa_testing_mysqld_exporter' });
    }
  });

  test('PMM-T9993 - Verify Change agent log level', async ({}) => {
    for (const output of await changeBothAgents('--log-level=debug')) {
      await output.assertSuccess();
    }

    for (const agentId of [mysqldExporterId, mysqldSlowlogAgentId]) {
      expect((await getAgent(serviceId, agentId)).log_level).toEqual('LOG_LEVEL_DEBUG');
    }
  });

  test('PMM-T9993 - Verify Change agent debug, trace and json', async ({}) => {
    for (const output of await changeBothAgents('--debug --trace --json')) {
      await output.assertSuccess();
    }
  });

  test('PMM-T9995 - Verify Change agent enable true/false', async ({}) => {
    const enableCases = [
      {
        flag: '--enable=false', response: '- disabled agent', status: 'Done (disabled)',
      },
      {
        flag: '--enable=true', response: '- enabled agent', status: 'Running',
      },
      {
        flag: '--enable=false', response: '- disabled agent', status: 'Done (disabled)',
      },
      {
        flag: '--enable', response: '- enabled agent', status: 'Running',
      },
    ];

    for (const enableCase of enableCases) {
      for (const output of await changeBothAgents(enableCase.flag)) {
        await output.assertSuccess();
        await output.outContains(enableCase.response);
      }

      for (const agentType of ['mysqld_exporter', 'mysql_slowlog_agent']) {
        await waitForAgentStatus(agentType, enableCase.status);
      }
    }
  });

  test('PMM-T9996 - Verify Change agent agent password', async ({}) => {
    await (await changeExporter(`--agent-password=${agentPassword}`)).assertSuccess();

    await expect(async () => {
      expect(await cli.getMetrics(serviceName, 'pmm', agentPassword, containerName)).toContain('mysql_up');
    }).toPass({ intervals: [2_000], timeout: 30_000 });
  });

  test('PMM-T9993 - Verify Change agent expose exporter', async ({}) => {
    const output = await changeExporter('--expose-exporter');
    await output.assertSuccess();
    await output.outContains('- enabled expose exporter');
    const port = await exporterPort();

    await expect(async () => {
      const metrics = await cli.exec(`docker exec pmm-server curl -fsS -u pmm:${agentPassword} http://${containerName}:${port}/metrics`);
      await metrics.assertSuccess();
      await metrics.outContains('mysql_up');
    }).toPass({ intervals: [2_000], timeout: 30_000 });
  });

  test('PMM-T9993 - Verify Change agent push metrics', async ({}) => {
    const output = await changeExporter('--push-metrics');
    await output.assertSuccess();
    await output.outContains('- enabled push metrics');
    const port = await exporterPort();

    await expect(async () => {
      const metrics = await cli.exec(`docker exec pmm-server curl -fsS -u pmm:${agentPassword} http://${containerName}:${port}/metrics`);
      await metrics.assertSuccess();
      await metrics.outContains('mysql_up');
    }).toPass({ intervals: [2_000], timeout: 30_000 });
    await (await cli.exec(`docker exec ${containerName} cat ${pmmAgentLog} | grep vmagent | tail -20 | grep error`)).outEquals('');
    await (await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${mysqldExporterId}`)).outContains('Running');
  });

  test('PMM-T9993 - Verify Change agent disable collectors', async ({}) => {
    const collectorsToDisable = ['info_schema.query_response_time', 'info_schema.processlist'];
    const output = await changeExporter(`--disable-collectors=${collectorsToDisable.join(',')}`);
    await output.assertSuccess();
    await output.outContains(`- updated disabled collectors: [${collectorsToDisable.join(' ')}]`);

    expect(
      (await getAgent(serviceId, mysqldExporterId)).disabled_collectors,
      'Disabled collectors were not persisted on the mysqld_exporter agent',
    ).toEqual(collectorsToDisable);
  });

  test('PMM-T1016 - Verify Change agent comments parsing', async ({}) => {
    const commentsParsingCases = [
      {
        disabled: false, response: '- enabled comments parsing', value: 'on',
      },
      {
        disabled: true, response: '- disabled comments parsing', value: 'off',
      },
    ];

    for (const commentsParsingCase of commentsParsingCases) {
      const output = await changeSlowlogAgent(`--comments-parsing=${commentsParsingCase.value}`);
      await output.assertSuccess();
      await output.outContains(commentsParsingCase.response);

      expect(
        (await getAgent(serviceId, mysqldSlowlogAgentId)).comments_parsing_disabled ?? false,
        `Comments parsing '${commentsParsingCase.value}' was not persisted on the qan_mysql_slowlog_agent`,
      ).toEqual(commentsParsingCase.disabled);
    }
  });

  test('PMM-T9998 - Verify Change agent skip connection check', async ({}) => {
    for (const output of await changeBothAgents('--password=invalid_skip_check_password --skip-connection-check')) {
      await output.assertSuccess();
      await output.outContains('agent configuration updated.');
    }

    for (const output of await changeBothAgents(`--username=${newUsername} --password=${newPassword}`)) {
      await output.assertSuccess();
    }

    await waitForServiceStatus(serviceName, 'STATUS_UP', 120_000);
  });

  test('PMM-T9997 - Verify Change agent tablestats group table limit', async ({}) => {
    const tablestatsGroupTableLimit = 2_000;
    const output = await changeExporter(`--tablestats-group-table-limit=${tablestatsGroupTableLimit}`);
    await output.assertSuccess();
    await output.outContains(`- changed tablestats group table limit to ${tablestatsGroupTableLimit}`);

    expect(
      (await getAgent(serviceId, mysqldExporterId)).table_count_tablestats_group_limit,
      'Tablestats group table limit was not persisted on the mysqld_exporter agent',
    ).toEqual(tablestatsGroupTableLimit);
  });

  test('PMM-T1014 - Verify Change agent disable query examples', async ({}) => {
    const output = await changeSlowlogAgent('--disable-query-examples');
    await output.assertSuccess();
    await output.outContains('- disabled query examples');

    expect(
      (await getAgent(serviceId, mysqldSlowlogAgentId)).query_examples_disabled,
      'Query examples were not disabled on the qan_mysql_slowlog_agent',
    ).toEqual(true);
  });

  test('PMM-T1015 - Verify Change agent max query length', async ({}) => {
    const maxQueryLength = 2_048;
    const output = await changeSlowlogAgent(`--max-query-length=${maxQueryLength}`);
    await output.assertSuccess();
    await output.outContains(`- changed max query length to ${maxQueryLength}`);

    expect(
      (await getAgent(serviceId, mysqldSlowlogAgentId)).max_query_length,
      'Max query length was not persisted on the qan_mysql_slowlog_agent',
    ).toEqual(maxQueryLength);
  });

  test('PMM-T1018 - Verify Change agent max slowlog file size', async ({}) => {
    const maxSlowlogFileSize = '104857600';
    const output = await changeSlowlogAgent(`--max-slowlog-file-size=${maxSlowlogFileSize}`);
    await output.assertSuccess();
    await output.outContains(`- changed max slowlog file size to ${maxSlowlogFileSize}`);

    expect(
      (await getAgent(serviceId, mysqldSlowlogAgentId)).max_query_log_size,
      'Max slowlog file size was not persisted on the qan_mysql_slowlog_agent',
    ).toEqual(maxSlowlogFileSize);
  });

  test('PMM-T1010 - Verify Change agent tls', async ({}) => {
    // mysqld generates its own CA and client certificates in the datadir on first start.
    await runSql('SET GLOBAL require_secure_transport=ON;');
    await waitForServiceStatus(serviceName, 'STATUS_DOWN', 300_000);

    const tlsFlags = '--tls --tls-skip-verify --tls-ca-file=/var/lib/mysql/ca.pem --tls-cert-file=/var/lib/mysql/client-cert.pem --tls-key-file=/var/lib/mysql/client-key.pem';

    for (const output of await changeBothAgents(tlsFlags)) {
      await output.assertSuccess();
    }

    await waitForServiceStatus(serviceName, 'STATUS_UP', 300_000);
  });

  test('PMM-T9993 - Verify Change agent pmm agent listen port', async ({}) => {
    await (await cli.exec(`docker exec ${containerName} sed -i 's/listen-port: 7777/listen-port: 7778/' ${pmmAgentConfig}`)).assertSuccess();
    // Restarting the container stops pmm-agent, which pmm-framework runs without a supervisor.
    await (await cli.exec(`docker restart ${containerName}`)).assertSuccess();
    await (await cli.exec(`docker exec -d ${containerName} sh -c "exec pmm-agent --config-file=${pmmAgentConfig} >>${pmmAgentLog} 2>&1"`)).assertSuccess();

    await expect(async () => {
      for (const output of await changeBothAgents('--pmm-agent-listen-port=7778')) {
        await output.assertSuccess();
      }
    }).toPass({ intervals: [5_000], timeout: 120_000 });
  });

  test('PMM-T99103 - Verify Change agent server url and server insecure tls', async ({}) => {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
    const serverUrl = `https://admin:${adminPassword}@pmm-server:8443/`;

    for (const output of await changeBothAgents(`--server-url=${serverUrl}`)) {
      await output.outContains('tls: failed to verify certificate:');
    }

    for (const output of await changeBothAgents(`--server-url=${serverUrl} --server-insecure-tls`)) {
      await output.assertSuccess();
      await output.outContains('agent configuration updated.');
    }
  });
});

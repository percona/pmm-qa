import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import { removeMySQLService } from '@root/helpers/pmm-admin';

const MYSQL_ROOT_PASSWORD = 'GRgrO9301RuF';
const serviceName = 'ps_perfschema_change_agent';
const newUsername = 'pmm_change_agent';
const newPassword = 'pmm_change_agent_password';
const tlsUsername = 'pmm_change_agent_tls';
const agentPassword = 'newAgentPassword';
let containerName: string;
let serviceId: string;
let mysqldExporterId: string;
let perfschemaAgentId: string;

interface ListedAgent {
  agent_id: string;
  agent_type: string;
  service_id: string;
  status: string;
  disabled: boolean;
  push_metrics_enabled: string;
  port?: number;
}
type AgentAlias = 'mysqld-exporter' | 'qan-mysql-perfschema-agent';
const jsonKeys: Record<AgentAlias, string> = {
  'mysqld-exporter': 'mysqld_exporter',
  'qan-mysql-perfschema-agent': 'qan_mysql_perfschema_agent',
};
const agents = (): { alias: AgentAlias, id: string }[] => [
  { alias: 'mysqld-exporter', id: mysqldExporterId },
  { alias: 'qan-mysql-perfschema-agent', id: perfschemaAgentId },
];

const mysql = async (sql: string) => cli.exec(`docker exec ${containerName} mysql -uroot -p${MYSQL_ROOT_PASSWORD} -e "${sql}"`);

const changeAgent = async (alias: AgentAlias, id: string, flags: string) => cli.exec(`docker exec ${containerName} pmm-admin inventory change agent ${alias} ${id} ${flags}`);

const changeAgentJson = async (alias: AgentAlias, id: string, flags: string) => {
  const output = await changeAgent(alias, id, `${flags} --json`);
  await output.assertSuccess();
  return (JSON.parse(output.stdout) as Record<string, Record<string, unknown>>)[jsonKeys[alias]];
};

const listAgents = async () => {
  const output = await cli.exec(`docker exec ${containerName} pmm-admin list --json`);
  await output.assertSuccess();
  return (JSON.parse(output.stdout) as { agent: ListedAgent[] }).agent;
};

const listAgent = async (agentId: string) => {
  const agent = (await listAgents()).find((a) => a.agent_id === agentId);
  expect(agent, `agent ${agentId} is not in pmm-admin list`).toBeTruthy();
  return agent as ListedAgent;
};

const expectMysqlUp = async (exporterPassword: string) => {
  await expect(async () => {
    const metrics = await cli.getMetrics(serviceName, 'pmm', exporterPassword, containerName);
    expect(metrics, 'mysqld_exporter cannot reach MySQL').toContain('mysql_up 1');
  }).toPass({ intervals: [5_000], timeout: 120_000 });
};

const pmmAgentPid = async () => (await cli.exec(`docker exec ${containerName} sh -c 'for p in /proc/[0-9]*; do [ "$(cat $p/comm 2>/dev/null)" = pmm-agent ] && echo \${p#/proc/}; done'`)).stdout.trim();

// The framework starts pmm-agent with `docker exec --detach`, so it is restarted the same way rather than with the container.
const restartPmmAgent = async (command: string) => {
  const pid = await pmmAgentPid();
  await (await cli.exec(`docker exec ${containerName} kill ${pid}`)).assertSuccess();
  await expect(async () => expect(await pmmAgentPid()).toEqual('')).toPass({ intervals: [1_000], timeout: 30_000 });
  await (await cli.exec(`docker exec --detach ${containerName} sh -c "exec ${command} >>/tmp/pmm-agent.log 2>&1"`)).assertSuccess();
};

test.describe('PMM Client "pmm-admin inventory change agent" tests for Percona Server perfschema agents', { tag: '@percona-server' }, () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps --format \'{{.Names}}\' | grep \'^ps_pmm\'');
    await result.outContains('ps_pmm', 'Percona MySQL docker container should exist. please run pmm-framework with --database ps');
    containerName = result.stdout.trim();

    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mysql --query-source=perfschema --username=root --password=${MYSQL_ROOT_PASSWORD} ${serviceName} 127.0.0.1:3306`);
    await output.assertSuccess();
    serviceId = output.stdout.match(/Service ID\s*:\s*(\S+)/)?.[1] ?? '';
    expect(serviceId, `Service ID not found in: ${output.stdout}`).toBeTruthy();

    const listed = await listAgents();
    const agentId = (agentType: string) => listed.find((a) => a.agent_type === agentType && a.service_id === serviceId)?.agent_id ?? '';
    mysqldExporterId = agentId('AGENT_TYPE_MYSQLD_EXPORTER');
    perfschemaAgentId = agentId('AGENT_TYPE_QAN_MYSQL_PERFSCHEMA_AGENT');
    expect(mysqldExporterId, `mysqld_exporter for service ${serviceId} not found`).toBeTruthy();
    expect(perfschemaAgentId, `qan_mysql_perfschema_agent for service ${serviceId} not found`).toBeTruthy();
  });

  test.afterAll(async ({}) => {
    await removeMySQLService(containerName, serviceName);
    await mysql(`DROP USER IF EXISTS '${newUsername}'@'%', '${tlsUsername}'@'%';`);
  });

  test('PMM-T1001 - Verify Change agent username and password', async ({}) => {
    await (await mysql(`CREATE USER '${newUsername}'@'%' IDENTIFIED BY '${newPassword}-wrong'; GRANT ALL PRIVILEGES ON *.* TO '${newUsername}'@'%';`)).assertSuccess();

    for (const { alias, id } of agents()) {
      const output = await changeAgent(alias, id, `--username=${newUsername} --password=${newPassword}`);
      await output.exitCodeEquals(1);
      await output.outContains('Access denied for user');
    }

    await (await mysql(`ALTER USER '${newUsername}'@'%' IDENTIFIED BY '${newPassword}';`)).assertSuccess();

    for (const { alias, id } of agents()) {
      const output = await changeAgent(alias, id, `--username=${newUsername} --password=${newPassword}`);
      await output.assertSuccess();
      await output.outContainsMany([`Username : ${newUsername}`, '- updated username', '- updated password']);
    }

    await expectMysqlUp(mysqldExporterId);
  });

  test('PMM-T1002 - Verify Change agent custom labels', async ({}) => {
    for (const { alias, id } of agents()) {
      const agent = await changeAgentJson(alias, id, '--custom-labels=env=qa_testing_mysqld_exporter');
      expect(agent.custom_labels, `${alias} custom labels`).toEqual({ env: 'qa_testing_mysqld_exporter' });
    }
  });

  test('PMM-T1003 - Verify Change agent log level', async ({}) => {
    for (const { alias, id } of agents()) {
      const agent = await changeAgentJson(alias, id, '--log-level=debug');
      expect(agent.log_level, `${alias} log level`).toEqual('LOG_LEVEL_DEBUG');
    }
  });

  test('PMM-T1004 - Verify Change agent debug, trace and json', async ({}) => {
    for (const { alias, id } of agents()) {
      const output = await changeAgent(alias, id, '--debug --trace --json');
      await output.assertSuccess();
      await output.outContains(`"agent_id":"${id}"`);
    }
  });

  test('PMM-T1005 - Verify Change agent enable true/false', async ({}) => {
    const disable = {
      response: '- disabled agent',
      disabled: true,
      status: 'DONE',
    };
    const enable = {
      response: '- enabled agent',
      disabled: false,
      status: 'RUNNING',
    };
    const enableCases = [
      { flag: '--enable=false', ...disable },
      { flag: '--enable=true', ...enable },
      { flag: '--enable=false', ...disable },
      { flag: '--enable', ...enable },
    ];

    for (const { flag, response, disabled, status } of enableCases) {
      for (const { alias, id } of agents()) {
        const output = await changeAgent(alias, id, flag);
        await output.assertSuccess();
        await output.outContains(response);
      }

      for (const { alias, id } of agents()) {
        await expect(async () => {
          const agent = await listAgent(id);
          expect(agent.disabled, `${alias} disabled after ${flag}`).toEqual(disabled);
          expect(agent.status, `${alias} status after ${flag}`).toEqual(status);
        }).toPass({ intervals: [2_000], timeout: 60_000 });
      }
    }
  });

  test('PMM-T1006 - Verify Change agent agent password', async ({}) => {
    const output = await changeAgent('mysqld-exporter', mysqldExporterId, `--agent-password=${agentPassword}`);
    await output.assertSuccess();
    await output.outContains('- updated agent password');

    await expectMysqlUp(agentPassword);
  });

  test('PMM-T1007 - Verify Change agent expose exporter', async ({}) => {
    const output = await changeAgent('mysqld-exporter', mysqldExporterId, '--expose-exporter');
    await output.assertSuccess();
    await output.outContainsMany(['Expose exporter : true', '- enabled expose exporter']);

    await expect(async () => {
      const { port } = await listAgent(mysqldExporterId);
      const metrics = await cli.exec(`docker exec pmm-server curl -s -u pmm:${agentPassword} http://${containerName}:${port}/metrics`);
      await metrics.assertSuccess();
      await metrics.outContains('mysql_up 1');
    }).toPass({ intervals: [5_000], timeout: 90_000 });
  });

  test('PMM-T1008 - Verify Change agent push metrics', async ({}) => {
    const output = await changeAgent('mysqld-exporter', mysqldExporterId, '--push-metrics');
    await output.assertSuccess();
    await output.outContainsMany(['Push metrics enabled : true', '- enabled push metrics']);

    await expect(async () => {
      const agent = await listAgent(mysqldExporterId);
      expect(agent.push_metrics_enabled, 'mysqld_exporter metrics mode').toEqual('push');
      expect(agent.status, 'mysqld_exporter status').toEqual('RUNNING');
    }).toPass({ intervals: [2_000], timeout: 60_000 });
    await expectMysqlUp(agentPassword);
  });

  test('PMM-T1009 - Verify Change agent disable collectors', async ({}) => {
    const collectorsToDisable = ['perf_schema.eventsstatements', 'perf_schema.tablelocks'];
    const output = await changeAgent('mysqld-exporter', mysqldExporterId, `--disable-collectors=${collectorsToDisable.join(',')} --json`);
    await output.assertSuccess();
    const result = JSON.parse(output.stdout);

    expect(result.changes).toContain(`updated disabled collectors: [${collectorsToDisable.join(' ')}]`);
    expect(result.mysqld_exporter.disabled_collectors, 'mysqld_exporter disabled collectors').toEqual(collectorsToDisable);
  });

  test('PMM-T1012 - Verify Change agent tablestats group table limit', async ({}) => {
    const tablestatsGroupTableLimit = 2_000;
    const agent = await changeAgentJson('mysqld-exporter', mysqldExporterId, `--tablestats-group-table-limit=${tablestatsGroupTableLimit}`);

    expect(agent.tablestats_group_table_limit, 'mysqld_exporter tablestats group table limit').toEqual(tablestatsGroupTableLimit);
  });

  test('PMM-T1014 - Verify Change agent disable query examples', async ({}) => {
    const agent = await changeAgentJson('qan-mysql-perfschema-agent', perfschemaAgentId, '--disable-query-examples');

    expect(agent.query_examples_disabled, 'qan_mysql_perfschema_agent query examples disabled').toEqual(true);
  });

  test('PMM-T1015 - Verify Change agent max query length', async ({}) => {
    const maxQueryLength = 2_048;
    const agent = await changeAgentJson('qan-mysql-perfschema-agent', perfschemaAgentId, `--max-query-length=${maxQueryLength}`);

    expect(agent.max_query_length, 'qan_mysql_perfschema_agent max query length').toEqual(maxQueryLength);
  });

  test('PMM-T1016 - Verify Change agent comments parsing', async ({}) => {
    const commentsParsingCases = [
      {
        value: 'on',
        response: 'enabled comments parsing',
        disabled: false,
      },
      {
        value: 'off',
        response: 'disabled comments parsing',
        disabled: true,
      },
    ];

    for (const { value, response, disabled } of commentsParsingCases) {
      const output = await changeAgent('qan-mysql-perfschema-agent', perfschemaAgentId, `--comments-parsing=${value} --json`);
      await output.assertSuccess();
      const result = JSON.parse(output.stdout);

      expect(result.changes).toContain(response);
      expect(result.qan_mysql_perfschema_agent.disable_comments_parsing ?? false, `comments parsing ${value}`).toEqual(disabled);
    }
  });

  test('PMM-T1013 - Verify Change agent skip connection check', async ({}) => {
    for (const { alias, id } of agents()) {
      const output = await changeAgent(alias, id, '--password=invalid_skip_check_password --skip-connection-check');
      await output.assertSuccess();
      await output.outContains('agent configuration updated.');
    }

    await expect(async () => {
      const metrics = await cli.getMetrics(serviceName, 'pmm', agentPassword, containerName);
      expect(metrics, 'mysqld_exporter should not reach MySQL with an invalid password').toContain('mysql_up 0');
    }).toPass({ intervals: [5_000], timeout: 90_000 });

    for (const { alias, id } of agents()) {
      await (await changeAgent(alias, id, `--username=${newUsername} --password=${newPassword}`)).assertSuccess();
    }

    await expectMysqlUp(agentPassword);
  });

  test('PMM-T1010 - Verify Change agent tls', async ({}) => {
    const tlsAvailable = await cli.exec(`docker exec ${containerName} mysql -uroot -p${MYSQL_ROOT_PASSWORD} -h127.0.0.1 --protocol=tcp --ssl-mode=REQUIRED -e "SELECT 1"`);
    // pmm-framework's PS 5.7 entrypoint leaves mysqld's own certificates unreadable, so mysqld starts without TLS.
    test.skip(tlsAvailable.code !== 0, 'mysqld in this container does not accept TLS connections');

    await (await mysql(`CREATE USER '${tlsUsername}'@'%' IDENTIFIED BY '${newPassword}' REQUIRE X509; GRANT ALL PRIVILEGES ON *.* TO '${tlsUsername}'@'%';`)).assertSuccess();

    for (const { alias, id } of agents()) {
      const output = await changeAgent(alias, id, `--username=${tlsUsername} --password=${newPassword}`);
      await output.exitCodeEquals(1);
      await output.outContains('Access denied for user');
    }

    const tlsFlags = '--tls --tls-skip-verify --tls-ca-file=/var/lib/mysql/ca.pem --tls-cert-file=/var/lib/mysql/client-cert.pem --tls-key-file=/var/lib/mysql/client-key.pem';

    for (const { alias, id } of agents()) {
      const output = await changeAgent(alias, id, `--username=${tlsUsername} --password=${newPassword} ${tlsFlags}`);
      await output.assertSuccess();
      await output.outContainsMany(['TLS enabled : true', 'Skip TLS verification : true', '- enabled TLS', '- updated TLS certificate']);
    }

    await expectMysqlUp(agentPassword);
  });

  test('PMM-T1011 - Verify Change agent pmm agent listen port', async ({}) => {
    const pid = await pmmAgentPid();
    const pmmAgentCommand = (await cli.exec(`docker exec ${containerName} sh -c 'tr "\\0" " " </proc/${pid}/cmdline'`)).stdout.trim();
    expect(pmmAgentCommand, 'pmm-agent command line').toContain('pmm-agent');

    await restartPmmAgent(`${pmmAgentCommand} --listen-port=7778`);

    try {
      await expect(async () => {
        await (await cli.exec(`docker exec ${containerName} pmm-admin status --pmm-agent-listen-port=7778`)).outContains('Connected : true');
      }).toPass({ intervals: [2_000], timeout: 60_000 });

      for (const { alias, id } of agents()) {
        const output = await changeAgent(alias, id, '--log-level=info');
        expect(output.code, `${alias} change should fail while pmm-agent does not listen on 7777`).not.toEqual(0);
      }

      for (const { alias, id } of agents()) {
        const output = await changeAgent(alias, id, '--log-level=info --pmm-agent-listen-port=7778');
        await output.assertSuccess();
        await output.outContains('- changed log level to info');
      }
    } finally {
      await restartPmmAgent(pmmAgentCommand);
      await expect(async () => {
        await (await cli.exec(`docker exec ${containerName} pmm-admin status`)).outContains('Connected : true');
      }).toPass({ intervals: [2_000], timeout: 60_000 });
    }
  });

  test('PMM-T99103 - Verify Change agent server url and server insecure tls', async ({}) => {
    const serverUrl = `https://admin:${process.env.ADMIN_PASSWORD || 'admin'}@pmm-server:8443/`;

    for (const { alias, id } of agents()) {
      const output = await changeAgent(alias, id, `--server-url=${serverUrl}`);
      await output.exitCodeEquals(1);
      await output.outContains('tls: failed to verify certificate:');
    }

    for (const { alias, id } of agents()) {
      const output = await changeAgent(alias, id, `--server-url=${serverUrl} --server-insecure-tls`);
      await output.assertSuccess();
      await output.outContains('agent configuration updated.');
    }
  });
});

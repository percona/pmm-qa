import { expect, test } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';

const mysqlPassword = 'GRgrO9301RuF';
const newUsername = 'new_pmmm_username';
const newPassword = 'new_pmm_user_password';
const agentPassword = 'newAgentPassword';
const pmmAgentConfig = '/usr/local/percona/pmm/config/pmm-agent.yaml';
const pmmAgentLog = '/tmp/pmm-agent.log';
let containerName: string;

test.beforeAll(async ({}) => {
  const result = await cli.exec('docker ps --format \'{{.Names}}\' | grep mysql_pmm_ | head -1');
  await result.outContains('mysql_pmm', 'MySQL docker container should exist. please run pmm-framework with --database mysql');
  containerName = result.stdout.trim();
});

test.describe('pmm-admin inventory change agent effects on mysqld_exporter and QAN perfschema agent', { tag: '@mysql-perfschema-change-agent' }, () => {
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  const serviceName = 'mysql_perfschema_change_agent_effects';
  const database = 'pmm_qa_perfschema_change_agent';

  let exporterId: string;
  let perfschemaId: string;

  test.beforeAll(async ({}) => {
    await (await cli.exec(`docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "CREATE DATABASE IF NOT EXISTS ${database}; CREATE TABLE IF NOT EXISTS ${database}.items (id INT AUTO_INCREMENT PRIMARY KEY, pmm_qa_first_long_column INT, pmm_qa_second_long_column INT, pmm_qa_third_long_column INT, pmm_qa_fourth_long_column INT);"`)).assertSuccess();
    await (await cli.exec(`docker exec ${containerName} pmm-admin remove mysql ${serviceName} || true`)).assertSuccess();
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mysql --query-source=perfschema --username=root --password=${mysqlPassword} --metrics-mode=push --agent-password=${agentPassword} ${serviceName} 127.0.0.1:3306`);
    await output.assertSuccess();
    const serviceId = output.stdout.match(/Service ID\s*:\s*(\S+)/)?.[1];
    expect(serviceId, `Service ID not found in: ${output.stdout}`).toBeTruthy();

    const agents = (await pmmAdmin.listAgents(containerName)).filter((agent) => agent.service_id === serviceId);
    exporterId = agents.find((agent) => agent.agent_type === 'AGENT_TYPE_MYSQLD_EXPORTER')?.agent_id ?? '';
    perfschemaId = agents.find((agent) => agent.agent_type === 'AGENT_TYPE_QAN_MYSQL_PERFSCHEMA_AGENT')?.agent_id ?? '';
    expect(exporterId, `mysqld_exporter for service ${serviceName} not found`).toBeTruthy();
    expect(perfschemaId, `mysql_perfschema_agent for service ${serviceName} not found`).toBeTruthy();

    await pmmAdmin.expectAgentsRunning(containerName, [exporterId, perfschemaId], true);
  });

  test.afterAll(async ({}) => {
    await pmmCli.runEach([
      async () => {
        if (exporterId) await pmmAdmin.removeMySQLService(containerName, serviceName);
      },
      async () => (await cli.exec(`docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "DROP DATABASE IF EXISTS ${database};"`)).assertSuccess(),
    ]);
  });

  test('PMM-T2669 - Verify Change agent credentials and max query length keep qan-mysql-perfschema-agent sending queries to QAN', async ({}) => {
    test.setTimeout(10 * 60_000);

    await cli.execUntilPersisted(
      [pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, perfschemaId, `--username=root --password=${mysqlPassword}`)],
      ['- updated username', '- updated password'],
      async () => {
        expect((await pmmApi.getServerAgent(perfschemaId)).username).toEqual('root');
      },
    );

    const runAndFindInQan = async (where: string, maxQueryLength: number, otherQueryIds: string[] = []) => {
      const agentId = perfschemaId;
      const runningReports = await pmmCli.countAgentRunningReports(containerName, agentId, pmmAgentLog);

      await cli.execUntilPersisted(
        [pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, agentId, `--max-query-length=${maxQueryLength}`)],
        [`- changed max query length to ${maxQueryLength}`],
        async () => {
          expect((await pmmApi.getServerAgent(agentId)).max_query_length).toEqual(maxQueryLength);
        },
      );
      // A query the agent reads before pmm-agent restarts it is sent with the old limit.
      await expect(async () => {
        expect(await pmmCli.countAgentRunningReports(containerName, agentId, pmmAgentLog), 'pmm-agent has not restarted the perfschema agent yet').toBeGreaterThan(runningReports);
      }).toPass({ intervals: [2_000], timeout: 60_000 });

      const from = new Date(Date.now() - 60_000);
      let queryId = '';
      let found = { example: '', isTruncated: false };

      await expect(async () => {
        // Examples come from the connection's statement history, which goes when it closes: keep it open for the agent's poll.
        await (await cli.exec(`docker exec ${containerName} mysql -u root -p${mysqlPassword} -D ${database} -e "SELECT * FROM items WHERE ${where}; DO SLEEP(2);"`)).assertSuccess();
        const queries = await pmmApi.getQanQueries(serviceName, database, from, 'schema');
        queryId = queries.find((q) => /items/i.test(q.fingerprint) && !otherQueryIds.includes(q.queryId))?.queryId ?? '';
        expect(queryId, `No SELECT on items in QAN for ${serviceName}/${database}: ${JSON.stringify(queries)}`).toBeTruthy();
        found = await pmmApi.getQanExample(serviceName, queryId, from);
        expect(found.example, `QAN has query ${queryId} but no example for it yet`).toBeTruthy();
      }).toPass({ intervals: [15_000], timeout: 4 * 60_000 });

      return { queryId, ...found };
    };

    const truncated = await runAndFindInQan('pmm_qa_first_long_column = 1 AND pmm_qa_second_long_column = 2', 40);
    expect(truncated.isTruncated, `Example should be truncated: ${truncated.example}`).toBe(true);
    expect(truncated.example.length, `Example longer than 40 characters plus " ...": ${truncated.example}`).toBeLessThanOrEqual(44);

    // -1 lifts the limit; a different query shape gets its own query class and example.
    const full = await runAndFindInQan('pmm_qa_third_long_column = 3 AND pmm_qa_fourth_long_column = 4', -1, [truncated.queryId]);
    expect(full.isTruncated, `Example should not be truncated: ${full.example}`).toBe(false);
    expect(full.example).toContain('pmm_qa_fourth_long_column');
  });

  test('PMM-T2670 - Verify Change agent leaves fields that are not passed unchanged for mysqld-exporter and qan-mysql-perfschema-agent', async ({}) => {
    const ignored = ['log_level', 'status', 'listen_port', 'process_exec_path'];
    const without = (agent: Record<string, unknown>) => Object.fromEntries(Object.entries(agent).filter(([key]) => !ignored.includes(key)));
    const before = { exporter: without(await pmmApi.getServerAgent(exporterId)), perfschema: without(await pmmApi.getServerAgent(perfschemaId)) };

    await cli.execUntilPersisted(
      [
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, exporterId, '--log-level=error'),
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, perfschemaId, '--log-level=error'),
      ],
      ['- changed log level to error'],
      async () => {
        for (const agentId of [exporterId, perfschemaId]) {
          expect((await pmmApi.getServerAgent(agentId)).log_level).toEqual('LOG_LEVEL_ERROR');
        }
      },
    );

    expect(without(await pmmApi.getServerAgent(exporterId)), 'mysqld_exporter fields changed').toEqual(before.exporter);
    expect(without(await pmmApi.getServerAgent(perfschemaId)), 'qan-mysql-perfschema-agent fields changed').toEqual(before.perfschema);
  });

  test('PMM-T2671 - Verify Change agent rejects an unknown agent ID, the wrong agent type and an invalid log level for mysqld-exporter and qan-mysql-perfschema-agent', async ({}) => {
    const unknownId = '00000000-0000-0000-0000-000000000000';

    await cli.expectFailure(await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, unknownId, '--log-level=info')), `Agent with ID ${unknownId} not found.`);
    await cli.expectFailure(await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, unknownId, '--log-level=info')), `Agent with ID ${unknownId} not found.`);
    await cli.expectFailure(
      await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, perfschemaId, '--log-level=info')),
      `Agent with ID ${perfschemaId} has type qan-mysql-perfschema-agent, expected mysqld_exporter.`,
    );
    await cli.expectFailure(
      await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, exporterId, '--log-level=info')),
      `Agent with ID ${exporterId} has type mysqld_exporter, expected qan-mysql-perfschema-agent.`,
    );

    // mysqld_exporter has no fatal log level, unlike the QAN agents.
    for (const level of ['foo', 'fatal']) {
      await cli.expectFailure(
        await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, exporterId, `--log-level=${level}`)),
        `--log-level must be one of "debug","info","warn","error" but got "${level}"`,
      );
    }
  });
});

test.describe('pmm-admin inventory change agent for MySQL perfschema', { tag: '@mysql-perfschema-change-agent' }, () => {
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  let serviceName: string;
  let mysqldExporterId: string;
  let mysqldPerfschemaAgentId: string;

  test.beforeAll(async ({}) => {
    const service = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep mysql_pmm | head -1`)).stdout.trim().split(/\s+/);
    serviceName = service[1];
    const serviceId = service[3];
    mysqldExporterId = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep mysqld_exporter | awk -F' ' '{print $4}'`)).stdout.trim();
    mysqldPerfschemaAgentId = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep mysql_perfschema_agent | awk -F' ' '{print $3}'`)).stdout.trim();
    expect(mysqldExporterId, `mysqld_exporter of ${serviceName} not found`).toBeTruthy();
    expect(mysqldPerfschemaAgentId, `mysql_perfschema_agent of ${serviceName} not found`).toBeTruthy();
  });

  test('PMM-T2657 - Verify Change agent username and password for mysqld-exporter and qan-mysql-perfschema-agent', async ({}) => {
    test.setTimeout(3 * 60_000);
    await (await cli.exec(`docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "DROP USER IF EXISTS '${newUsername}'@'%'; CREATE USER '${newUsername}'@'%' IDENTIFIED BY '${newPassword}-wrong'; GRANT ALL PRIVILEGES ON *.* TO '${newUsername}'@'%'; FLUSH PRIVILEGES;"`)).assertSuccess();

    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--password=${newPassword} --username=${newUsername}`),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, `--password=${newPassword} --username=${newUsername}`),
    ]) {
      await cli.expectFailure(await cli.exec(command), 'Access denied for user');
    }

    await (await cli.exec(`docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "ALTER USER '${newUsername}'@'%' IDENTIFIED BY '${newPassword}'; FLUSH PRIVILEGES;"`)).assertSuccess();

    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--password=${newPassword} --username=${newUsername}`),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, `--password=${newPassword} --username=${newUsername}`),
    ]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
    }

    await pmmApi.waitForServiceStatus(serviceName, 'STATUS_UP', 120_000);
  });

  test('PMM-T2658 - Verify Change agent custom labels for mysqld-exporter and qan-mysql-perfschema-agent', async ({}) => {
    await cli.execUntilPersisted(
      [
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, '--custom-labels=env=qa_testing_mysqld_exporter'),
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, '--custom-labels=env=qa_testing_mysqld_exporter'),
      ],
      ['Custom labels : env=qa_testing_mysqld_exporter', '- updated custom labels'],
      async () => {
        for (const agentId of [mysqldExporterId, mysqldPerfschemaAgentId]) {
          expect((await pmmApi.getServerAgent(agentId)).custom_labels, `Custom labels were not persisted on ${agentId}`).toMatchObject({ env: 'qa_testing_mysqld_exporter' });
        }
      },
    );
  });

  test('PMM-T2659 - Verify Change agent log level for mysqld-exporter and qan-mysql-perfschema-agent', async ({}) => {
    await cli.execUntilPersisted(
      [
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, '--log-level=debug'),
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, '--log-level=debug'),
      ],
      ['- changed log level to debug'],
      async () => {
        for (const agentId of [mysqldExporterId, mysqldPerfschemaAgentId]) {
          expect((await pmmApi.getServerAgent(agentId)).log_level, `Log level was not persisted on ${agentId}`).toEqual('LOG_LEVEL_DEBUG');
        }
      },
    );
  });

  test('PMM-T2660 - Verify Change agent debug, trace and json flags for mysqld-exporter and qan-mysql-perfschema-agent', async ({}) => {
    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, '--debug --trace --json'),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, '--debug --trace --json'),
    ]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
    }
  });

  test('PMM-T2661 - Verify Change agent enable and disable for mysqld-exporter and qan-mysql-perfschema-agent', async ({}) => {
    test.setTimeout(5 * 60_000);
    const enableCases = [
      {
        flag: '--enable=false', response: '- disabled agent', running: false,
      },
      {
        flag: '--enable=true', response: '- enabled agent', running: true,
      },
      {
        flag: '--enable=false', response: '- disabled agent', running: false,
      },
      {
        flag: '--enable', response: '- enabled agent', running: true,
      },
    ];

    for (const enableCase of enableCases) {
      for (const command of [
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, enableCase.flag),
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, enableCase.flag),
      ]) {
        const output = await cli.exec(command);
        await output.assertSuccess();
        await output.outContains(enableCase.response);
      }

      await pmmAdmin.expectAgentsRunning(containerName, [mysqldExporterId, mysqldPerfschemaAgentId], enableCase.running);
    }
  });

  test('PMM-T2662 - Verify Change agent comments parsing for qan-mysql-perfschema-agent', async ({}) => {
    const commentsParsingCases = [
      {
        disabled: false, response: '- enabled comments parsing', value: 'on',
      },
      {
        disabled: true, response: '- disabled comments parsing', value: 'off',
      },
    ];

    for (const commentsParsingCase of commentsParsingCases) {
      const agentId = mysqldPerfschemaAgentId;

      await cli.execUntilPersisted(
        [pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, agentId, `--comments-parsing=${commentsParsingCase.value}`)],
        [commentsParsingCase.response],
        async () => {
          expect(
            (await pmmApi.getServerAgent(agentId)).disable_comments_parsing ?? false,
            `Comments parsing '${commentsParsingCase.value}' was not persisted on the qan_mysql_perfschema_agent`,
          ).toEqual(commentsParsingCase.disabled);
        },
      );
    }
  });

  test('PMM-T2663 - Verify Change agent skip connection check for mysqld-exporter and qan-mysql-perfschema-agent', async ({}) => {
    test.setTimeout(3 * 60_000);
    await (await cli.exec(`docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "CREATE USER IF NOT EXISTS '${newUsername}'@'%' IDENTIFIED BY '${newPassword}'; ALTER USER '${newUsername}'@'%' IDENTIFIED BY '${newPassword}'; GRANT ALL PRIVILEGES ON *.* TO '${newUsername}'@'%'; FLUSH PRIVILEGES;"`)).assertSuccess();

    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, '--password=invalid_skip_check_password --skip-connection-check'),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, '--password=invalid_skip_check_password --skip-connection-check'),
    ]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains('agent configuration updated.');
    }

    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--username=${newUsername} --password=${newPassword}`),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, `--username=${newUsername} --password=${newPassword}`),
    ]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
    }

    await pmmApi.waitForServiceStatus(serviceName, 'STATUS_UP', 120_000);
  });

  test('PMM-T2664 - Verify Change agent disable query examples for qan-mysql-perfschema-agent', async ({}) => {
    await cli.execUntilPersisted(
      [pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, '--disable-query-examples')],
      ['- disabled query examples'],
      async () => {
        expect((await pmmApi.getServerAgent(mysqldPerfschemaAgentId)).query_examples_disabled, 'Query examples were not disabled on the qan_mysql_perfschema_agent')
          .toEqual(true);
      },
    );
  });

  test('PMM-T2665 - Verify Change agent max query length for qan-mysql-perfschema-agent', async ({}) => {
    const maxQueryLength = 2_048;

    await cli.execUntilPersisted(
      [pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, `--max-query-length=${maxQueryLength}`)],
      [`- changed max query length to ${maxQueryLength}`],
      async () => {
        expect((await pmmApi.getServerAgent(mysqldPerfschemaAgentId)).max_query_length, 'Max query length was not persisted on the qan_mysql_perfschema_agent')
          .toEqual(maxQueryLength);
      },
    );
  });

  test('PMM-T2666 - Verify Change agent TLS for mysqld-exporter and qan-mysql-perfschema-agent', async ({}) => {
    test.setTimeout(660_000);
    // mysqld generates its own CA and client certificates in the datadir on first start. Their PEM files
    // carry a NUL byte, which change agent, unlike add, does not strip, so the CA fails to save (22P05).
    await (await cli.exec(`docker exec ${containerName} sh -c "mkdir -p /certs && for f in ca client-cert client-key; do tr -d '\\000' < /var/lib/mysql/\\$f.pem > /certs/\\$f.pem; done"`)).assertSuccess();
    // Credentials go with the TLS flags: a change saved while an agent restarts can be reverted (PMM-15835).
    const tlsFlags = `--username=${newUsername} --password=${newPassword} --tls --tls-skip-verify --tls-ca-file=/certs/ca.pem --tls-cert-file=/certs/client-cert.pem --tls-key-file=/certs/client-key.pem`;

    try {
      await (await cli.exec(`docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "SET GLOBAL require_secure_transport=ON;"`)).assertSuccess();
      await pmmApi.waitForServiceStatus(serviceName, 'STATUS_DOWN', 300_000);

      for (const command of [
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, tlsFlags),
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, tlsFlags),
      ]) {
        const output = await cli.exec(command);
        await output.assertSuccess();
      }

      await pmmApi.waitForServiceStatus(serviceName, 'STATUS_UP', 300_000);
    } finally {
      await (await cli.exec(`docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "SET GLOBAL require_secure_transport=OFF;"`)).assertSuccess();
    }
  });

  test('PMM-T2667 - Verify Change agent pmm-agent listen port for mysqld-exporter and qan-mysql-perfschema-agent', async ({}) => {
    test.setTimeout(240_000);
    await (await cli.exec(`docker exec ${containerName} sed -i 's/listen-port: 7777/listen-port: 7778/' ${pmmAgentConfig}`)).assertSuccess();
    // pmm-framework runs pmm-agent as a systemd unit in the MySQL image.
    await (await cli.exec(`docker exec ${containerName} systemctl restart pmm-agent`)).assertSuccess();

    await expect(async () => {
      for (const command of [
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, '--pmm-agent-listen-port=7778'),
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, '--pmm-agent-listen-port=7778'),
      ]) {
        const output = await cli.exec(command);
        await output.assertSuccess();
      }
    }).toPass({ intervals: [5_000], timeout: 120_000 });
  });

  test('PMM-T2668 - Verify Change agent server URL and server insecure TLS for mysqld-exporter and qan-mysql-perfschema-agent', async ({}) => {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
    const serverUrl = cli.shellQuote(`https://admin:${encodeURIComponent(adminPassword)}@pmm-server:8443/`);

    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--server-url=${serverUrl}`),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, `--server-url=${serverUrl}`),
    ]) {
      await cli.expectFailure(await cli.exec(command), 'tls: failed to verify certificate:');
    }

    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--server-url=${serverUrl} --server-insecure-tls`),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, `--server-url=${serverUrl} --server-insecure-tls`),
    ]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains('agent configuration updated.');
    }
  });
});

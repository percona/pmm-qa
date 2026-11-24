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

    ({ exporterId, perfschemaId } = await pmmAdmin.mysqlAgentIds(containerName, serviceId ?? ''));
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

  test('PMM-T2542 - Verify Change agent disable collectors stops the collectors of mysqld-exporter', async ({}) => {
    test.setTimeout(4 * 60_000);
    await expect(async () => {
      expect(await pmmCli.getExporterArgs(containerName, exporterId)).toContain('--collect.info_schema.innodb_metrics');
      expect(await cli.getMetrics(serviceName, 'pmm', agentPassword, containerName)).toMatch(/^mysql_info_schema_innodb_metrics_/m);
    }).toPass({ intervals: [5_000], timeout: 60_000 });

    await cli.execUntilPersisted(
      [pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, exporterId, '--disable-collectors=info_schema.innodb_metrics')],
      ['- updated disabled collectors: [info_schema.innodb_metrics]'],
      async () => {
        expect((await pmmApi.getServerAgent(exporterId)).disabled_collectors).toEqual(['info_schema.innodb_metrics']);
      },
    );

    await expect(async () => {
      expect(await pmmCli.getExporterArgs(containerName, exporterId)).not.toContain('--collect.info_schema.innodb_metrics');
      expect(await cli.getMetrics(serviceName, 'pmm', agentPassword, containerName), 'InnoDB metrics are still exported')
        .not.toMatch(/^mysql_info_schema_innodb_metrics_/m);
    }).toPass({ intervals: [5_000], timeout: 60_000 });
  });

  test('PMM-T2543 - Verify Change agent empty disable collectors re-enables the collectors of mysqld-exporter', async ({}) => {
    test.skip(true, 'Skipping this test, bug https://perconadev.atlassian.net/browse/PMM-15837');

    const output = await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, exporterId, '--disable-collectors='));
    await output.assertSuccess();
    await output.outContains('- updated disabled collectors: []');

    await expect(async () => {
      expect((await pmmApi.getServerAgent(exporterId)).disabled_collectors, 'Disabled collectors were not cleared').toEqual([]);
    }).toPass({ intervals: [2_000], timeout: 10_000 });
  });

  test('PMM-T2544 - Verify Change agent log level is applied to the mysqld-exporter process', async ({}) => {
    test.setTimeout(9 * 60_000);
    for (const level of ['debug', 'info', 'warn', 'error']) {
      const agentId = exporterId;
      const container = containerName;

      await cli.execUntilPersisted(
        [pmmAdmin.inventoryChangeAgent(container, pmmAdmin.ChangeAgentType.MysqldExporter, agentId, `--log-level=${level}`)],
        [`- changed log level to ${level}`],
        async () => {
          expect((await pmmApi.getServerAgent(agentId)).log_level).toEqual(`LOG_LEVEL_${level.toUpperCase()}`);
        },
      );

      await expect(async () => {
        expect(await pmmCli.getExporterArgs(container, agentId)).toContain(`--log.level=${level}`);
      }).toPass({ intervals: [3_000], timeout: 60_000 });
    }
  });

  test('PMM-T2545 - Verify Change agent tablestats group table limit switches the tablestats collectors of the mysqld-exporter process', async ({}) => {
    test.setTimeout(5 * 60_000);
    // -1 always disables the tablestats group; 0 means no limit.
    for (const { limit, enabled } of [{ limit: -1, enabled: false }, { limit: 0, enabled: true }]) {
      const agentId = exporterId;
      const container = containerName;

      await cli.execUntilPersisted(
        [pmmAdmin.inventoryChangeAgent(container, pmmAdmin.ChangeAgentType.MysqldExporter, agentId, `--tablestats-group-table-limit=${limit}`)],
        [`- changed tablestats group table limit to ${limit}`],
        async () => {
          const agent = await pmmApi.getServerAgent(agentId);
          expect(agent.tablestats_group_table_limit ?? 0).toEqual(limit);
          expect(agent.tablestats_group_disabled ?? false).toBe(!enabled);
        },
      );

      await expect(async () => {
        const args = await pmmCli.getExporterArgs(container, agentId);
        expect(args.includes('--collect.info_schema.tables'), `--collect.info_schema.tables in ${args.join(' ')}`).toBe(enabled);
      }).toPass({ intervals: [3_000], timeout: 60_000 });
    }
  });

  test('PMM-T2546 - Verify Change agent custom labels are added, overwritten and removed on mysqld-exporter metrics', async ({}) => {
    test.setTimeout(8 * 60_000);
    const labelled = async (labels: string) => pmmApi.queryVictoriaMetrics(`mysql_up{service_name="${serviceName}",${labels}}`);

    await cli.execUntilPersisted(
      [pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, exporterId, '--custom-labels=env=qa_first,team=pmm_qa')],
      ['Custom labels : env=qa_first, team=pmm_qa'],
      async () => {
        expect((await pmmApi.getServerAgent(exporterId)).custom_labels).toEqual({ env: 'qa_first', team: 'pmm_qa' });
      },
    );
    await expect(async () => {
      expect(await labelled('env="qa_first",team="pmm_qa"'), 'No mysql_up series carries the custom labels').not.toHaveLength(0);
    }).toPass({ intervals: [5_000], timeout: 120_000 });

    await cli.execUntilPersisted(
      [pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, exporterId, '--custom-labels=env=qa_second')],
      ['Custom labels : env=qa_second'],
      async () => {
        expect((await pmmApi.getServerAgent(exporterId)).custom_labels).toEqual({ env: 'qa_second' });
      },
    );
    await expect(async () => {
      expect(await labelled('env="qa_second",team=""'), 'No mysql_up series carries only the overwritten label').not.toHaveLength(0);
    }).toPass({ intervals: [5_000], timeout: 120_000 });

    await cli.execUntilPersisted(
      [pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, exporterId, '--custom-labels=')],
      ['Custom labels : (none)', '- custom labels are removed'],
      async () => {
        expect((await pmmApi.getServerAgent(exporterId)).custom_labels ?? {}).toEqual({});
      },
    );
  });

  test('PMM-T2547 - Verify Change agent expose exporter and push metrics are switched on and off for mysqld-exporter', async ({}) => {
    test.setTimeout(12 * 60_000);
    await cli.execUntilPersisted([pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, exporterId, '--expose-exporter')], ['- enabled expose exporter'], async () => {
      expect((await pmmApi.getServerAgent(exporterId)).expose_exporter).toBe(true);
    });
    await expect(async () => {
      await (await pmmCli.scrapeExporterFromPmmServer(containerName, exporterId, agentPassword)).assertSuccess();
    }).toPass({ intervals: [5_000], timeout: 60_000 });

    await cli.execUntilPersisted([pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, exporterId, '--expose-exporter=false')], ['- disabled expose exporter'], async () => {
      expect((await pmmApi.getServerAgent(exporterId)).expose_exporter).toBe(false);
    });
    await expect(async () => {
      expect((await pmmCli.getExporterArgs(containerName, exporterId)).find((arg) => arg.startsWith('--web.listen-address='))).toMatch(/^--web\.listen-address=127\.0\.0\.1:/);
      expect((await pmmCli.scrapeExporterFromPmmServer(containerName, exporterId, agentPassword)).code, 'The exporter is still reachable from PMM Server').not.toEqual(0);
    }).toPass({ intervals: [5_000], timeout: 60_000 });

    for (const push of [false, true]) {
      const agentId = exporterId;
      const container = containerName;

      await cli.execUntilPersisted(
        [pmmAdmin.inventoryChangeAgent(container, pmmAdmin.ChangeAgentType.MysqldExporter, agentId, `--push-metrics=${push}`)],
        [`- ${push ? 'enabled' : 'disabled'} push metrics`],
        async () => {
          expect((await pmmApi.getServerAgent(agentId)).push_metrics_enabled).toBe(push);
        },
      );

      await expect(async () => {
        const line = (await cli.exec(`docker exec ${container} pmm-admin list`)).getStdOutLines().find((l) => l.includes(agentId));
        expect(line).toContain(push ? 'push' : 'pull');
      }).toPass({ intervals: [3_000], timeout: 30_000 });
      await expect(async () => {
        expect(await cli.getMetrics(serviceName, 'pmm', agentPassword, container)).toMatch(/^mysql_up(\{[^}]*\})? 1$/m);
      }).toPass({ intervals: [5_000], timeout: 120_000 });
    }
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

  test('PMM-T2551 - Verify Change agent output does not print passwords for mysqld-exporter', async ({}) => {
    for (const json of ['', ' --json']) {
      const output = await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, exporterId, `--password=${mysqlPassword} --agent-password=${agentPassword}${json}`));
      await output.assertSuccess();
      const printed = `${output.stdout}${output.stderr.text}`;

      expect(printed).not.toContain(mysqlPassword);
      expect(printed).not.toContain(agentPassword);
    }
  });

  test('PMM-T2552 - Verify Change agent debug and trace output does not print passwords for mysqld-exporter', async ({}) => {
    test.skip(true, 'Skipping this test, bug https://perconadev.atlassian.net/browse/PMM-15836');

    for (const mode of ['--debug', '--trace']) {
      const output = await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, exporterId, `--password=${mysqlPassword} --agent-password=${agentPassword} ${mode}`));
      await output.assertSuccess();
      const printed = `${output.stdout}${output.stderr.text}`;

      expect(printed, `${mode} output contains the MySQL password`).not.toContain(mysqlPassword);
      expect(printed, `${mode} output contains the agent password`).not.toContain(agentPassword);
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
    // Not the text columns: a disabled agent's "Done (disabled)" status shifts them.
    ({ exporterId: mysqldExporterId, perfschemaId: mysqldPerfschemaAgentId } = await pmmAdmin.mysqlAgentIds(containerName, serviceId));
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

    const agentIds = [mysqldExporterId, mysqldPerfschemaAgentId];

    try {
      for (const enableCase of enableCases) {
        await cli.execUntilPersisted(
          [
            pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, enableCase.flag),
            pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId, enableCase.flag),
          ],
          [enableCase.response],
          async () => {
            for (const agentId of agentIds) {
              expect((await pmmApi.getServerAgent(agentId)).disabled, `Disabled was not persisted on ${agentId}`).toBe(!enableCase.running);
            }
          },
        );

        await pmmAdmin.expectAgentsRunning(containerName, agentIds, enableCase.running);
      }
    } finally {
      // The later tests change these agents and expect them running.
      const enableUntilPersisted = (agentType: pmmAdmin.ChangeAgentType, agentId: string) => () => cli.execUntilPersisted(
        [pmmAdmin.inventoryChangeAgent(containerName, agentType, agentId, '--enable')],
        [],
        async () => {
          expect((await pmmApi.getServerAgent(agentId)).disabled, `${agentId} is still disabled`).toBeFalsy();
        },
      );

      await pmmCli.runEach([
        enableUntilPersisted(pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId),
        enableUntilPersisted(pmmAdmin.ChangeAgentType.QanMysqlPerfschemaAgent, mysqldPerfschemaAgentId),
      ]);
    }
  });

  test('PMM-T2529 - Verify Change agent agent password for mysqld-exporter', async ({}) => {
    await (await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--agent-password=${agentPassword}`))).assertSuccess();

    await expect(async () => {
      expect(await cli.getMetrics(serviceName, 'pmm', agentPassword, containerName)).toContain('mysql_up');
    }).toPass({ intervals: [2_000], timeout: 30_000 });
  });

  test('PMM-T2530 - Verify Change agent expose exporter for mysqld-exporter', async ({}) => {
    const output = await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, '--expose-exporter'));
    await output.assertSuccess();
    await output.outContains('- enabled expose exporter');

    await expect(async () => {
      const metrics = await pmmCli.scrapeExporterFromPmmServer(containerName, mysqldExporterId, agentPassword);
      await metrics.assertSuccess();
      await metrics.outContains('mysql_up');
    }).toPass({ intervals: [2_000], timeout: 30_000 });
  });

  test('PMM-T2531 - Verify Change agent push metrics for mysqld-exporter', async ({}) => {
    const output = await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, '--push-metrics'));
    await output.assertSuccess();
    await output.outContains('- enabled push metrics');

    await expect(async () => {
      const metrics = await pmmCli.scrapeExporterFromPmmServer(containerName, mysqldExporterId, agentPassword);
      await metrics.assertSuccess();
      await metrics.outContains('mysql_up');
    }).toPass({ intervals: [2_000], timeout: 30_000 });
    await (await cli.exec(`docker exec ${containerName} sh -c 'grep type=vm_agent ${pmmAgentLog} | tail -20 | grep -F "\\terror\\t" || true'`)).outEquals('');
    await pmmAdmin.expectAgentsRunning(containerName, [mysqldExporterId], true);
  });

  test('PMM-T2532 - Verify Change agent disable collectors for mysqld-exporter', async ({}) => {
    const collectorsToDisable = ['info_schema.query_response_time', 'info_schema.processlist'];

    await cli.execUntilPersisted(
      [pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--disable-collectors=${collectorsToDisable.join(',')}`)],
      [`- updated disabled collectors: [${collectorsToDisable.join(' ')}]`],
      async () => {
        expect((await pmmApi.getServerAgent(mysqldExporterId)).disabled_collectors, 'Disabled collectors were not persisted on the mysqld_exporter agent')
          .toEqual(collectorsToDisable);
      },
    );
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

  test('PMM-T2535 - Verify Change agent tablestats group table limit for mysqld-exporter', async ({}) => {
    const tablestatsGroupTableLimit = 2_000;

    await cli.execUntilPersisted(
      [pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--tablestats-group-table-limit=${tablestatsGroupTableLimit}`)],
      [`- changed tablestats group table limit to ${tablestatsGroupTableLimit}`],
      async () => {
        expect((await pmmApi.getServerAgent(mysqldExporterId)).tablestats_group_table_limit, 'Tablestats group table limit was not persisted on the mysqld_exporter agent')
          .toEqual(tablestatsGroupTableLimit);
      },
    );
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

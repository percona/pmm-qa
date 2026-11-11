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
let serviceName: string;
let mysqldExporterId: string;
let mysqldSlowlogAgentId: string;

test.describe('pmm-admin inventory change agent for MySQL slowlog', { tag: '@ps-slowlog-change-agent' }, () => {
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps --format \'{{.Names}}\' | grep ps_pmm_ | head -1');
    await result.outContains('ps_pmm', 'Percona Server docker container should exist. please run pmm-framework with --database ps,QUERY_SOURCE=slowlog');
    containerName = result.stdout.trim();
    const service = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep ps_pmm | head -1`)).stdout.trim().split(/\s+/);
    serviceName = service[1];
    const serviceId = service[3];
    mysqldExporterId = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep mysqld_exporter | awk -F' ' '{print $4}'`)).stdout.trim();
    mysqldSlowlogAgentId = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep mysql_slowlog_agent | awk -F' ' '{print $3}'`)).stdout.trim();
    expect(mysqldExporterId, `mysqld_exporter of ${serviceName} not found`).toBeTruthy();
    expect(mysqldSlowlogAgentId, `mysql_slowlog_agent of ${serviceName} not found, is QUERY_SOURCE=slowlog set?`).toBeTruthy();
  });

  test('PMM-T2524 - Verify Change agent username and password for mysqld-exporter and qan-mysql-slowlog-agent', async ({}) => {
    await (await cli.exec(`docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "DROP USER IF EXISTS '${newUsername}'@'%'; CREATE USER '${newUsername}'@'%' IDENTIFIED BY '${newPassword}-wrong'; GRANT ALL PRIVILEGES ON *.* TO '${newUsername}'@'%'; FLUSH PRIVILEGES;"`)).assertSuccess();

    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--password=${newPassword} --username=${newUsername}`),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, `--password=${newPassword} --username=${newUsername}`),
    ]) {
      await cli.expectFailure(await cli.exec(command), 'Access denied for user');
    }

    await (await cli.exec(`docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "ALTER USER '${newUsername}'@'%' IDENTIFIED BY '${newPassword}'; FLUSH PRIVILEGES;"`)).assertSuccess();

    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--password=${newPassword} --username=${newUsername}`),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, `--password=${newPassword} --username=${newUsername}`),
    ]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
    }

    await pmmApi.waitForServiceStatus(serviceName, 'STATUS_UP', 120_000);
  });

  test('PMM-T2525 - Verify Change agent custom labels for mysqld-exporter and qan-mysql-slowlog-agent', async ({}) => {
    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, '--custom-labels=env=qa_testing_mysqld_exporter'),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, '--custom-labels=env=qa_testing_mysqld_exporter'),
    ]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
    }

    for (const agentId of [mysqldExporterId, mysqldSlowlogAgentId]) {
      expect((await pmmApi.getServerAgent(agentId)).custom_labels).toMatchObject({ env: 'qa_testing_mysqld_exporter' });
    }
  });

  test('PMM-T2526 - Verify Change agent log level for mysqld-exporter and qan-mysql-slowlog-agent', async ({}) => {
    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, '--log-level=debug'),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, '--log-level=debug'),
    ]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
    }

    for (const agentId of [mysqldExporterId, mysqldSlowlogAgentId]) {
      expect((await pmmApi.getServerAgent(agentId)).log_level).toEqual('LOG_LEVEL_DEBUG');
    }
  });

  test('PMM-T2527 - Verify Change agent debug, trace and json flags for mysqld-exporter and qan-mysql-slowlog-agent', async ({}) => {
    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, '--debug --trace --json'),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, '--debug --trace --json'),
    ]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
    }
  });

  test('PMM-T2528 - Verify Change agent enable and disable for mysqld-exporter and qan-mysql-slowlog-agent', async ({}) => {
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
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, enableCase.flag),
      ]) {
        const output = await cli.exec(command);
        await output.assertSuccess();
        await output.outContains(enableCase.response);
      }

      await pmmAdmin.expectAgentsRunning(containerName, [mysqldExporterId, mysqldSlowlogAgentId], enableCase.running);
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
    await (await cli.exec(`docker exec ${containerName} cat ${pmmAgentLog} | grep vmagent | tail -20 | grep error`)).outEquals('');
    await pmmAdmin.expectAgentsRunning(containerName, [mysqldExporterId], true);
  });

  test('PMM-T2532 - Verify Change agent disable collectors for mysqld-exporter', async ({}) => {
    const collectorsToDisable = ['info_schema.query_response_time', 'info_schema.processlist'];
    const output = await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--disable-collectors=${collectorsToDisable.join(',')}`));
    await output.assertSuccess();
    await output.outContains(`- updated disabled collectors: [${collectorsToDisable.join(' ')}]`);

    expect(
      (await pmmApi.getServerAgent(mysqldExporterId)).disabled_collectors,
      'Disabled collectors were not persisted on the mysqld_exporter agent',
    ).toEqual(collectorsToDisable);
  });

  test('PMM-T2533 - Verify Change agent comments parsing for qan-mysql-slowlog-agent', async ({}) => {
    const commentsParsingCases = [
      {
        disabled: false, response: '- enabled comments parsing', value: 'on',
      },
      {
        disabled: true, response: '- disabled comments parsing', value: 'off',
      },
    ];

    for (const commentsParsingCase of commentsParsingCases) {
      const output = await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, `--comments-parsing=${commentsParsingCase.value}`));
      await output.assertSuccess();
      await output.outContains(commentsParsingCase.response);

      expect(
        (await pmmApi.getServerAgent(mysqldSlowlogAgentId)).disable_comments_parsing ?? false,
        `Comments parsing '${commentsParsingCase.value}' was not persisted on the qan_mysql_slowlog_agent`,
      ).toEqual(commentsParsingCase.disabled);
    }
  });

  test('PMM-T2534 - Verify Change agent skip connection check for mysqld-exporter and qan-mysql-slowlog-agent', async ({}) => {
    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, '--password=invalid_skip_check_password --skip-connection-check'),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, '--password=invalid_skip_check_password --skip-connection-check'),
    ]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains('agent configuration updated.');
    }

    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--username=${newUsername} --password=${newPassword}`),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, `--username=${newUsername} --password=${newPassword}`),
    ]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
    }

    await pmmApi.waitForServiceStatus(serviceName, 'STATUS_UP', 120_000);
  });

  test('PMM-T2535 - Verify Change agent tablestats group table limit for mysqld-exporter', async ({}) => {
    const tablestatsGroupTableLimit = 2_000;
    const output = await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--tablestats-group-table-limit=${tablestatsGroupTableLimit}`));
    await output.assertSuccess();
    await output.outContains(`- changed tablestats group table limit to ${tablestatsGroupTableLimit}`);

    expect(
      (await pmmApi.getServerAgent(mysqldExporterId)).tablestats_group_table_limit,
      'Tablestats group table limit was not persisted on the mysqld_exporter agent',
    ).toEqual(tablestatsGroupTableLimit);
  });

  test('PMM-T2536 - Verify Change agent disable query examples for qan-mysql-slowlog-agent', async ({}) => {
    const output = await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, '--disable-query-examples'));
    await output.assertSuccess();
    await output.outContains('- disabled query examples');

    expect(
      (await pmmApi.getServerAgent(mysqldSlowlogAgentId)).query_examples_disabled,
      'Query examples were not disabled on the qan_mysql_slowlog_agent',
    ).toEqual(true);
  });

  test('PMM-T2537 - Verify Change agent max query length for qan-mysql-slowlog-agent', async ({}) => {
    const maxQueryLength = 2_048;
    const output = await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, `--max-query-length=${maxQueryLength}`));
    await output.assertSuccess();
    await output.outContains(`- changed max query length to ${maxQueryLength}`);

    expect(
      (await pmmApi.getServerAgent(mysqldSlowlogAgentId)).max_query_length,
      'Max query length was not persisted on the qan_mysql_slowlog_agent',
    ).toEqual(maxQueryLength);
  });

  test('PMM-T2538 - Verify Change agent max slowlog file size for qan-mysql-slowlog-agent', async ({}) => {
    const maxSlowlogFileSize = '104857600';
    const output = await cli.exec(pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, `--max-slowlog-file-size=${maxSlowlogFileSize}`));
    await output.assertSuccess();
    await output.outContains(`- changed max slowlog file size to ${maxSlowlogFileSize}`);

    expect(
      (await pmmApi.getServerAgent(mysqldSlowlogAgentId)).max_slowlog_file_size,
      'Max slowlog file size was not persisted on the qan_mysql_slowlog_agent',
    ).toEqual(maxSlowlogFileSize);
  });

  test('PMM-T2539 - Verify Change agent TLS for mysqld-exporter and qan-mysql-slowlog-agent', async ({}) => {
    test.setTimeout(660_000);
    // mysqld generates its own CA and client certificates in the datadir on first start. Their PEM files
    // carry a NUL byte, which change agent, unlike add, does not strip, so the CA fails to save (22P05).
    await (await cli.exec(`docker exec ${containerName} sh -c "mkdir -p /certs && for f in ca client-cert client-key; do tr -d '\\000' < /var/lib/mysql/\\$f.pem > /certs/\\$f.pem; done"`)).assertSuccess();
    await (await cli.exec(`docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "SET GLOBAL require_secure_transport=ON;"`)).assertSuccess();
    await pmmApi.waitForServiceStatus(serviceName, 'STATUS_DOWN', 300_000);

    const tlsFlags = '--tls --tls-skip-verify --tls-ca-file=/certs/ca.pem --tls-cert-file=/certs/client-cert.pem --tls-key-file=/certs/client-key.pem';

    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, tlsFlags),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, tlsFlags),
    ]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
    }

    await pmmApi.waitForServiceStatus(serviceName, 'STATUS_UP', 300_000);
  });

  test('PMM-T2540 - Verify Change agent pmm-agent listen port for mysqld-exporter and qan-mysql-slowlog-agent', async ({}) => {
    test.setTimeout(240_000);
    await (await cli.exec(`docker exec ${containerName} sed -i 's/listen-port: 7777/listen-port: 7778/' ${pmmAgentConfig}`)).assertSuccess();
    // Restarting the container stops pmm-agent, which pmm-framework runs without a supervisor.
    await (await cli.exec(`docker restart ${containerName}`)).assertSuccess();
    await (await cli.exec(`docker exec -d ${containerName} sh -c "exec pmm-agent --config-file=${pmmAgentConfig} >>${pmmAgentLog} 2>&1"`)).assertSuccess();

    await expect(async () => {
      for (const command of [
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, '--pmm-agent-listen-port=7778'),
        pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, '--pmm-agent-listen-port=7778'),
      ]) {
        const output = await cli.exec(command);
        await output.assertSuccess();
      }
    }).toPass({ intervals: [5_000], timeout: 120_000 });
  });

  test('PMM-T2541 - Verify Change agent server URL and server insecure TLS for mysqld-exporter and qan-mysql-slowlog-agent', async ({}) => {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
    const serverUrl = `https://admin:${adminPassword}@pmm-server:8443/`;

    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--server-url=${serverUrl}`),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, `--server-url=${serverUrl}`),
    ]) {
      await cli.expectFailure(await cli.exec(command), 'tls: failed to verify certificate:');
    }

    for (const command of [
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.MysqldExporter, mysqldExporterId, `--server-url=${serverUrl} --server-insecure-tls`),
      pmmAdmin.inventoryChangeAgent(containerName, pmmAdmin.ChangeAgentType.QanMysqlSlowlogAgent, mysqldSlowlogAgentId, `--server-url=${serverUrl} --server-insecure-tls`),
    ]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains('agent configuration updated.');
    }
  });
});

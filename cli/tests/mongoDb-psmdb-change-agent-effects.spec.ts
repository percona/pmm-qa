import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import { getPmmAdminVersion, removeMongoService } from '@helpers/pmm-admin';
import { clientCredentialsFlags, gssapi, mongoConnection } from '@helpers/constants';
import { versionBelow } from '@helpers/versionGates';

const containerName = 'rs101';
const replIpPort = 'rs101:27017';
const serviceName = 'mongo_change_agent_effects';
const database = 'pmm_qa_change_agent';
const mongoUri = 'mongodb://root:root@localhost:27017/?authSource=admin&directConnection=true';
const agentPassword = 'mypass';

let adminVersion: string;
let exporterId: string;
let profilerId: string;

const exporterArgs = async () => cli.getExporterArgs(containerName, exporterId);

const scrapeFromPmmServer = async () => {
  return cli.exec(`docker exec pmm-server curl -sS -m 5 -u pmm:${agentPassword} http://${containerName}:${await cli.getAgentPort(containerName, exporterId)}/metrics`);
};

test.describe('PSMDB pmm-admin inventory change agent effects on mongodb_exporter and QAN profiler agent', { tag: '@psmdb' }, () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ pmmClientContainer: containerName });

  test.beforeAll(async ({}) => {
    test.skip(gssapi.enabled === 'true', 'Changes the agents with SCRAM credentials, which the GSSAPI setup does not use');

    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'PSMDB rs101 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=pss');
    adminVersion = await getPmmAdminVersion(containerName);
    test.skip(versionBelow(adminVersion, '3.7.0'), 'pmm-admin inventory change agent requires pmm-client 3.7.0+');

    // The profiler only records operations in a database that already exists.
    await cli.runOnPrimary(containerName, mongoUri, `db.getSiblingDB("${database}").items.insertOne({ created: new Date() })`);

    await (await cli.exec(`docker exec ${containerName} pmm-admin remove mongodb ${serviceName} || true`)).assertSuccess();
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --query-source=profiler --metrics-mode=push --agent-password=${agentPassword} ${serviceName} ${replIpPort}`);
    await output.assertSuccess();
    const serviceId = output.stdout.match(/Service ID\s*:\s*(\S+)/)?.[1];
    expect(serviceId, `Service ID not found in: ${output.stdout}`).toBeTruthy();

    const agents = await cli.listAgents(containerName);
    const agentOfType = (type: string) => agents.find((agent) => agent.agent_type === type && agent.service_id === serviceId)?.agent_id ?? '';
    exporterId = agentOfType('AGENT_TYPE_MONGODB_EXPORTER');
    profilerId = agentOfType('AGENT_TYPE_QAN_MONGODB_PROFILER_AGENT');
    expect(exporterId, `mongodb_exporter for service ${serviceId} not found`).toBeTruthy();
    expect(profilerId, `mongodb_profiler_agent for service ${serviceId} not found`).toBeTruthy();

    await cli.expectAgentsRunning(containerName, [exporterId, profilerId], true);
  });

  test.afterAll(async ({}) => {
    if (exporterId) {
      await removeMongoService(containerName, serviceName);
      await cli.runOnPrimary(containerName, mongoUri, `db.getSiblingDB("${database}").dropDatabase()`);
    }
  });

  test('PMM-T2449 - Verify Change agent disable collectors stops the collectors of mongodb-exporter', async ({}) => {
    await expect(async () => {
      expect(await exporterArgs()).toContain('--collector.replicasetstatus');
      expect(await cli.getMetrics(serviceName, 'pmm', agentPassword, containerName)).toMatch(/^mongodb_members_/m);
    }).toPass({ intervals: [5_000], timeout: 60_000 });

    await cli.changeAgentsUntilPersisted(
      [cli.changeMongoExporter(containerName, exporterId, '--disable-collectors=replicasetstatus')],
      ['- updated disabled collectors: [replicasetstatus]'],
      async () => {
        expect((await cli.getServerAgent(exporterId)).disabled_collectors).toEqual(['replicasetstatus']);
      },
    );

    await expect(async () => {
      expect(await exporterArgs()).not.toContain('--collector.replicasetstatus');
      expect(await cli.getMetrics(serviceName, 'pmm', agentPassword, containerName), 'Replica set metrics are still exported')
        .not.toMatch(/^mongodb_members_/m);
    }).toPass({ intervals: [5_000], timeout: 60_000 });
  });

  test('PMM-T2450 - Verify Change agent empty disable collectors re-enables the collectors of mongodb-exporter', async ({}) => {
    test.skip(true, 'Skipping this test, bug https://perconadev.atlassian.net/browse/PMM-15837');

    const output = await cli.exec(cli.changeMongoExporter(containerName, exporterId, '--disable-collectors='));
    await output.assertSuccess();
    await output.outContains('- updated disabled collectors: []');

    await expect(async () => {
      expect((await cli.getServerAgent(exporterId)).disabled_collectors, 'Disabled collectors were not cleared').toEqual([]);
    }).toPass({ intervals: [2_000], timeout: 10_000 });
  });

  test('PMM-T2451 - Verify Change agent log level is applied to the mongodb-exporter process', async ({}) => {
    for (const level of ['debug', 'info', 'warn', 'error', 'fatal']) {
      const agentId = exporterId;

      await cli.changeAgentsUntilPersisted(
        [cli.changeMongoExporter(containerName, agentId, `--log-level=${level}`)],
        [`- changed log level to ${level}`],
        async () => {
          expect((await cli.getServerAgent(agentId)).log_level).toEqual(`LOG_LEVEL_${level.toUpperCase()}`);
        },
      );

      await expect(async () => {
        expect(await exporterArgs()).toContain(`--log.level=${level}`);
      }).toPass({ intervals: [3_000], timeout: 60_000 });
    }
  });

  test('PMM-T2452 - Verify Change agent diagnostic data histograms are enabled and disabled on the mongodb-exporter process', async ({}) => {
    test.skip(versionBelow(adminVersion, '3.10.0'), 'pmm-agent passes --collector.diagnosticdata-histograms from 3.10.0');

    for (const enabled of [true, false]) {
      const agentId = exporterId;

      await cli.changeAgentsUntilPersisted(
        [cli.changeMongoExporter(containerName, agentId, `--enable-diagnostic-data-histograms=${enabled}`)],
        [`- ${enabled ? 'enabled' : 'disabled'} diagnostic data histograms`],
        async () => {
          expect((await cli.getServerAgent(agentId)).enable_diagnostic_data_histograms).toBe(enabled);
        },
      );

      await expect(async () => {
        const args = await exporterArgs();
        expect(args.includes('--collector.diagnosticdata-histograms'), `--collector.diagnosticdata-histograms in ${args.join(' ')}`).toBe(enabled);
      }).toPass({ intervals: [3_000], timeout: 60_000 });
    }
  });

  test('PMM-T2453 - Verify Change agent stats collections and collections limit are applied to the mongodb-exporter process', async ({}) => {
    const collection = `${database}.items`;
    const collectionsLimit = 50;

    await cli.changeAgentsUntilPersisted(
      [cli.changeMongoExporter(containerName, exporterId, `--stats-collections=${collection} --collections-limit=${collectionsLimit}`)],
      [`- updated stats collections: ${collection}`, `- changed collections limit to ${collectionsLimit}`],
      async () => {
        const agent = await cli.getServerAgent(exporterId);
        expect(agent.stats_collections).toEqual([collection]);
        expect(agent.collections_limit).toEqual(collectionsLimit);
      },
    );

    await expect(async () => {
      const args = await exporterArgs();
      expect(args).toContain(`--mongodb.collstats-colls=${collection}`);
      expect(args).toContain(`--mongodb.indexstats-colls=${collection}`);
      expect(args).toContain(`--collector.collstats-limit=${collectionsLimit}`);
    }).toPass({ intervals: [3_000], timeout: 60_000 });
  });

  test('PMM-T2454 - Verify Change agent custom labels are added, overwritten and removed on mongodb-exporter metrics', async ({}) => {
    const labelled = async (labels: string) => cli.queryVictoriaMetrics(`mongodb_up{service_name="${serviceName}",${labels}}`);

    await cli.changeAgentsUntilPersisted(
      [cli.changeMongoExporter(containerName, exporterId, '--custom-labels=env=qa_first,team=pmm_qa')],
      ['Custom labels : env=qa_first, team=pmm_qa'],
      async () => {
        expect((await cli.getServerAgent(exporterId)).custom_labels).toEqual({ env: 'qa_first', team: 'pmm_qa' });
      },
    );
    await expect(async () => {
      expect(await labelled('env="qa_first",team="pmm_qa"'), 'No mongodb_up series carries the custom labels').not.toHaveLength(0);
    }).toPass({ intervals: [5_000], timeout: 120_000 });

    // A new set replaces the old one rather than merging into it.
    await cli.changeAgentsUntilPersisted(
      [cli.changeMongoExporter(containerName, exporterId, '--custom-labels=env=qa_second')],
      ['Custom labels : env=qa_second'],
      async () => {
        expect((await cli.getServerAgent(exporterId)).custom_labels).toEqual({ env: 'qa_second' });
      },
    );
    await expect(async () => {
      expect(await labelled('env="qa_second",team=""'), 'No mongodb_up series carries only the overwritten label').not.toHaveLength(0);
    }).toPass({ intervals: [5_000], timeout: 120_000 });

    await cli.changeAgentsUntilPersisted(
      [cli.changeMongoExporter(containerName, exporterId, '--custom-labels=')],
      ['Custom labels : (none)', '- custom labels are removed'],
      async () => {
        expect((await cli.getServerAgent(exporterId)).custom_labels ?? {}).toEqual({});
      },
    );
  });

  test('PMM-T2455 - Verify Change agent expose exporter and push metrics are switched on and off for mongodb-exporter', async ({}) => {
    await cli.changeAgentsUntilPersisted([cli.changeMongoExporter(containerName, exporterId, '--expose-exporter')], ['- enabled expose exporter'], async () => {
      expect((await cli.getServerAgent(exporterId)).expose_exporter).toBe(true);
    });
    await expect(async () => {
      await (await scrapeFromPmmServer()).assertSuccess();
    }).toPass({ intervals: [5_000], timeout: 60_000 });

    // In push mode an exporter that is not exposed listens on loopback only.
    await cli.changeAgentsUntilPersisted([cli.changeMongoExporter(containerName, exporterId, '--expose-exporter=false')], ['- disabled expose exporter'], async () => {
      expect((await cli.getServerAgent(exporterId)).expose_exporter).toBe(false);
    });
    await expect(async () => {
      expect((await exporterArgs()).find((arg) => arg.startsWith('--web.listen-address='))).toMatch(/^--web\.listen-address=127\.0\.0\.1:/);
      expect((await scrapeFromPmmServer()).code, 'The exporter is still reachable from PMM Server').not.toEqual(0);
    }).toPass({ intervals: [5_000], timeout: 60_000 });

    for (const push of [false, true]) {
      const agentId = exporterId;

      await cli.changeAgentsUntilPersisted(
        [cli.changeMongoExporter(containerName, agentId, `--push-metrics=${push}`)],
        [`- ${push ? 'enabled' : 'disabled'} push metrics`],
        async () => {
          expect((await cli.getServerAgent(agentId)).push_metrics_enabled).toBe(push);
        },
      );

      await expect(async () => {
        const line = (await cli.exec(`docker exec ${containerName} pmm-admin list`)).getStdOutLines().find((l) => l.includes(agentId));
        expect(line).toContain(push ? 'push' : 'pull');
      }).toPass({ intervals: [3_000], timeout: 30_000 });
      await cli.expectMongoUp(containerName, serviceName, agentPassword);
    }
  });

  test('PMM-T2456 - Verify Change agent credentials and max query length keep qan-mongodb-profiler-agent sending queries to QAN', async ({}) => {
    test.setTimeout(10 * 60_000);

    // Re-applying the same credentials still reconnects the agent with what change agent sent.
    await cli.changeAgentsUntilPersisted(
      [cli.changeMongoProfiler(containerName, profilerId, `--username=${mongoConnection.username} --password=${mongoConnection.password}`)],
      ['- updated username', '- updated password'],
      async () => {
        expect((await cli.getServerAgent(profilerId)).username).toEqual(mongoConnection.username);
      },
    );

    const runAndFindInQan = async (shape: string, maxQueryLength: number, otherQueryIds: string[] = []) => {
      const agentId = profilerId;

      await cli.changeAgentsUntilPersisted(
        [cli.changeMongoProfiler(containerName, agentId, `--max-query-length=${maxQueryLength}`)],
        [`- changed max query length to ${maxQueryLength}`],
        async () => {
          expect((await cli.getServerAgent(agentId)).max_query_length).toEqual(maxQueryLength);
        },
      );
      await cli.expectAgentsRunning(containerName, [agentId], true);

      const from = new Date(Date.now() - 60_000);
      const marker = `pmm_qa_${Date.now()}`;
      const query = `db.getSiblingDB("${database}").items.find({ marker: "${marker}", ${shape} }).toArray()`;
      let queryId = '';

      await expect(async () => {
        await (await cli.exec(cli.mongoEval(containerName, mongoUri, query))).assertSuccess();
        const queries = await cli.getQanQueries(serviceName, database, from);
        queryId = queries.find((q) => /find/.test(q.fingerprint) && !otherQueryIds.includes(q.queryId))?.queryId ?? '';
        expect(queryId, `No find query in QAN for ${serviceName}/${database}: ${JSON.stringify(queries)}`).toBeTruthy();
      }).toPass({ intervals: [15_000], timeout: 4 * 60_000 });

      return { queryId, ...(await cli.getQanExample(queryId, from)) };
    };

    const truncated = await runAndFindInQan('pmmQaFirstLongFieldName: 1, pmmQaSecondLongFieldName: 2', 40);
    expect(truncated.isTruncated, `Example should be truncated: ${truncated.example}`).toBe(true);
    expect(truncated.example.length, `Example longer than 40 characters plus " ...": ${truncated.example}`).toBeLessThanOrEqual(44);

    // -1 lifts the limit; a different query shape gets its own query class and example.
    const full = await runAndFindInQan('pmmQaThirdLongFieldName: 3, pmmQaFourthLongFieldName: 4', -1, [truncated.queryId]);
    expect(full.isTruncated, `Example should not be truncated: ${full.example}`).toBe(false);
    expect(full.example).toContain('pmmQaFourthLongFieldName');
  });

  test('PMM-T2457 - Verify Change agent leaves fields that are not passed unchanged', async ({}) => {
    const ignored = ['log_level', 'status', 'listen_port', 'process_exec_path'];
    const without = (agent: Record<string, unknown>) => Object.fromEntries(Object.entries(agent).filter(([key]) => !ignored.includes(key)));
    const before = { exporter: without(await cli.getServerAgent(exporterId)), profiler: without(await cli.getServerAgent(profilerId)) };

    await cli.changeAgentsUntilPersisted(
      cli.changeMongoAgents(containerName, exporterId, profilerId, '--log-level=error'),
      ['- changed log level to error'],
      async () => {
        for (const agentId of [exporterId, profilerId]) {
          expect((await cli.getServerAgent(agentId)).log_level).toEqual('LOG_LEVEL_ERROR');
        }
      },
    );

    expect(without(await cli.getServerAgent(exporterId)), 'mongodb_exporter fields changed').toEqual(before.exporter);
    expect(without(await cli.getServerAgent(profilerId)), 'qan-mongodb-profiler-agent fields changed').toEqual(before.profiler);
  });

  test('PMM-T2458 - Verify Change agent rejects an unknown agent ID, the wrong agent type and an invalid log level', async ({}) => {
    const unknownId = '00000000-0000-0000-0000-000000000000';

    await cli.expectFailure(await cli.exec(cli.changeMongoExporter(containerName, unknownId, '--log-level=info')), `Agent with ID ${unknownId} not found.`);
    await cli.expectFailure(await cli.exec(cli.changeMongoProfiler(containerName, unknownId, '--log-level=info')), `Agent with ID ${unknownId} not found.`);
    await cli.expectFailure(
      await cli.exec(cli.changeMongoExporter(containerName, profilerId, '--log-level=info')),
      `Agent with ID ${profilerId} has type qan-mongodb-profiler-agent, expected mongodb_exporter.`,
    );
    await cli.expectFailure(
      await cli.exec(cli.changeMongoProfiler(containerName, exporterId, '--log-level=info')),
      `Agent with ID ${exporterId} has type mongodb_exporter, expected qan-mongodb-profiler-agent.`,
    );
    await cli.expectFailure(
      await cli.exec(cli.changeMongoExporter(containerName, exporterId, '--log-level=foo')),
      '--log-level must be one of "debug","info","warn","error","fatal" but got "foo"',
    );
  });

  test('PMM-T2459 - Verify Change agent output does not print passwords', async ({}) => {
    for (const json of ['', ' --json']) {
      const output = await cli.exec(cli.changeMongoExporter(containerName, exporterId, `--password=${mongoConnection.password} --agent-password=${agentPassword}${json}`));
      await output.assertSuccess();
      const printed = `${output.stdout}${output.stderr.text}`;

      expect(printed).not.toContain(mongoConnection.password);
      expect(printed).not.toContain(agentPassword);
    }
  });

  test('PMM-T2460 - Verify Change agent debug and trace output does not print passwords', async ({}) => {
    test.skip(true, 'Skipping this test, bug https://perconadev.atlassian.net/browse/PMM-15836');

    for (const mode of ['--debug', '--trace']) {
      const output = await cli.exec(cli.changeMongoExporter(containerName, exporterId, `--password=${mongoConnection.password} --agent-password=${agentPassword} ${mode}`));
      await output.assertSuccess();
      const printed = `${output.stdout}${output.stderr.text}`;

      expect(printed, `${mode} output contains the MongoDB password`).not.toContain(mongoConnection.password);
      expect(printed, `${mode} output contains the agent password`).not.toContain(agentPassword);
    }
  });
});

import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import { removeMongoService } from '@helpers/pmm-admin';
import { clientCredentialsFlags, gssapi, mongoConnection } from '@helpers/constants';

const containerName = 'rs101';
const replIpPort = 'rs101:27017';
const mongoUri = 'mongodb://root:root@localhost:27017/?authSource=admin&directConnection=true';

test.describe('PSMDB pmm-admin inventory change agent effects on mongodb_exporter and QAN profiler agent', { tag: '@psmdb' }, () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ pmmClientContainer: containerName });

  const serviceName = 'mongo_change_agent_effects';
  const database = 'pmm_qa_change_agent';
  const agentPassword = 'mypass';

  let exporterId: string;
  let profilerId: string;
  let databaseCreated = false;

  const exporterArgs = async () => cli.getExporterArgs(containerName, exporterId);

  test.beforeAll(async ({}) => {
    test.skip(gssapi.enabled === 'true', 'Changes the agents with SCRAM credentials, which the GSSAPI setup does not use');

    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'PSMDB rs101 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=pss');

    // The profiler only records operations in a database that already exists.
    await cli.runOnPrimary(containerName, mongoUri, `db.getSiblingDB("${database}").items.insertOne({ created: new Date() })`);
    databaseCreated = true;

    ({ exporterId, profilerId } = await cli.addMongoServiceAgents(
      containerName,
      `${clientCredentialsFlags} --query-source=profiler --metrics-mode=push --agent-password=${agentPassword}`,
      serviceName,
      replIpPort,
    ));
    expect(exporterId, `mongodb_exporter for service ${serviceName} not found`).toBeTruthy();
    expect(profilerId, `mongodb_profiler_agent for service ${serviceName} not found`).toBeTruthy();

    await cli.expectAgentsRunning(containerName, [exporterId, profilerId], true);
  });

  test.afterAll(async ({}) => {
    await cli.runEach([
      async () => {
        if (exporterId) await removeMongoService(containerName, serviceName);
      },
      async () => {
        if (databaseCreated) await cli.runOnPrimary(containerName, mongoUri, `db.getSiblingDB("${database}").dropDatabase()`);
      },
    ]);
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
      await (await cli.scrapeExporterFromPmmServer(containerName, exporterId, agentPassword)).assertSuccess();
    }).toPass({ intervals: [5_000], timeout: 60_000 });

    await cli.changeAgentsUntilPersisted([cli.changeMongoExporter(containerName, exporterId, '--expose-exporter=false')], ['- disabled expose exporter'], async () => {
      expect((await cli.getServerAgent(exporterId)).expose_exporter).toBe(false);
    });
    await expect(async () => {
      expect((await exporterArgs()).find((arg) => arg.startsWith('--web.listen-address='))).toMatch(/^--web\.listen-address=127\.0\.0\.1:/);
      expect((await cli.scrapeExporterFromPmmServer(containerName, exporterId, agentPassword)).code, 'The exporter is still reachable from PMM Server').not.toEqual(0);
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

    await cli.changeAgentsUntilPersisted(
      [cli.changeMongoProfiler(containerName, profilerId, `--username=${mongoConnection.username} --password=${mongoConnection.password}`)],
      ['- updated username', '- updated password'],
      async () => {
        expect((await cli.getServerAgent(profilerId)).username).toEqual(mongoConnection.username);
      },
    );

    const runAndFindInQan = async (shape: string, maxQueryLength: number, otherQueryIds: string[] = []) => {
      const agentId = profilerId;
      const runningReports = await cli.countAgentRunningReports(containerName, agentId);

      await cli.changeAgentsUntilPersisted(
        [cli.changeMongoProfiler(containerName, agentId, `--max-query-length=${maxQueryLength}`)],
        [`- changed max query length to ${maxQueryLength}`],
        async () => {
          expect((await cli.getServerAgent(agentId)).max_query_length).toEqual(maxQueryLength);
        },
      );
      // A query the profiler reads before pmm-agent restarts it is sent with the old limit.
      await expect(async () => {
        expect(await cli.countAgentRunningReports(containerName, agentId), 'pmm-agent has not restarted the profiler yet').toBeGreaterThan(runningReports);
      }).toPass({ intervals: [2_000], timeout: 60_000 });

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

test.describe('PSMDB pmm-admin inventory change agent for mongodb_exporter and QAN profiler agent', { tag: '@psmdb' }, () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ pmmClientContainer: containerName });

  const serviceName = 'mongo_change_agent_service';
  const newUsername = 'new_pmm_username';
  const newPassword = 'new_pmm_user_password';
  const changedAgentPassword = 'newAgentPassword';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
  const pmmAgentConfig = '/usr/local/percona/pmm/config/pmm-agent.yaml';
  const mongodSysconfigBackup = '/tmp/mongod.sysconfig.orig';
  const tlsProbe = `docker exec ${containerName} mongo --tls --host localhost --port 27017 --tlsCAFile /certs/ca-certs.pem --tlsCertificateKeyFile /certs/client.pem --tlsAllowInvalidCertificates --quiet --eval 'db.hello()'`;
  const plainProbe = `docker exec ${containerName} mongo "${mongoUri}" --quiet --eval 'db.hello()'`;

  let exporterId: string;
  let profilerId: string;
  let agentPassword = 'mypass';
  let mongodTlsEnabled = false;
  let pmmAgentListenPortChanged = false;

  const dropNewUser = `if (db.getSiblingDB("admin").getUser("${newUsername}")) db.getSiblingDB("admin").dropUser("${newUsername}");`;

  test.beforeAll(async ({}) => {
    test.skip(gssapi.enabled === 'true', 'Changes the agents to SCRAM users and TLS, which the GSSAPI setup does not use');

    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'PSMDB rs101 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=pss');

    ({ exporterId, profilerId } = await cli.addMongoServiceAgents(
      containerName,
      `${clientCredentialsFlags} --query-source=profiler --agent-password=${agentPassword}`,
      serviceName,
      replIpPort,
    ));
    expect(exporterId, `mongodb_exporter for service ${serviceName} not found`).toBeTruthy();
    expect(profilerId, `mongodb_profiler_agent for service ${serviceName} not found`).toBeTruthy();
  });

  test.afterAll(async ({}) => {
    await cli.runEach([
      async () => {
        if (!pmmAgentListenPortChanged) return;
        await (await cli.exec(`docker exec ${containerName} sed -i 's/listen-port: 7778/listen-port: 7777/' ${pmmAgentConfig}`)).assertSuccess();
        await (await cli.exec(`docker exec ${containerName} systemctl restart pmm-agent`)).assertSuccess();
        await expect(async () => {
          await (await cli.exec(`docker exec ${containerName} pmm-admin status`)).assertSuccess();
        }).toPass({ intervals: [2_000], timeout: 60_000 });
      },
      async () => {
        if (!mongodTlsEnabled) return;
        await (await cli.exec(`docker exec ${containerName} cp ${mongodSysconfigBackup} /etc/sysconfig/mongod`)).assertSuccess();
        await (await cli.exec(`docker exec ${containerName} systemctl restart mongod`)).assertSuccess();
        await cli.waitForMongod(containerName, plainProbe);
      },
      async () => {
        if (exporterId) await removeMongoService(containerName, serviceName);
      },
      async () => {
        if (exporterId) await cli.runOnPrimary(containerName, mongoUri, dropNewUser);
      },
    ]);
  });

  test('PMM-T2426 - Verify Change agent username and password for mongodb-exporter and qan-mongodb-profiler-agent', async ({}) => {
    const monitoringRoles = '[ { role: "explainRole", db: "admin" }, { role: "clusterMonitor", db: "admin" }, { role: "read", db: "local" } ]';

    await cli.runOnPrimary(containerName, mongoUri, `${dropNewUser} db.getSiblingDB("admin").createUser({ user: "${newUsername}", pwd: "${newPassword}-wrong", roles: ${monitoringRoles} })`);

    for (const command of cli.changeMongoAgents(containerName, exporterId, profilerId, `--username=${newUsername} --password=${newPassword}`)) {
      await cli.expectFailure(await cli.exec(command), 'Authentication failed');
    }

    await cli.runOnPrimary(containerName, mongoUri, `db.getSiblingDB("admin").changeUserPassword("${newUsername}", "${newPassword}")`);

    await cli.changeAgentsUntilPersisted(
      cli.changeMongoAgents(containerName, exporterId, profilerId, `--username=${newUsername} --password=${newPassword}`),
      ['- updated username', '- updated password'],
      async () => {
        for (const agentId of [exporterId, profilerId]) {
          expect((await cli.getServerAgent(agentId)).username, `Username was not persisted on ${agentId}`).toEqual(newUsername);
        }
      },
    );

    await cli.expectAgentsRunning(containerName, [exporterId, profilerId], true);
    await cli.expectMongoUp(containerName, serviceName, agentPassword);
  });

  test('PMM-T2427 - Verify Change agent custom labels for mongodb-exporter and qan-mongodb-profiler-agent', async ({}) => {
    const customLabel = { key: 'env', value: 'qa_testing_mongodb' };

    await cli.changeAgentsUntilPersisted(
      cli.changeMongoAgents(containerName, exporterId, profilerId, `--custom-labels=${customLabel.key}=${customLabel.value}`),
      [`Custom labels : ${customLabel.key}=${customLabel.value}`, '- updated custom labels'],
      async () => {
        for (const agentId of [exporterId, profilerId]) {
          expect((await cli.getServerAgent(agentId)).custom_labels, `Custom labels were not persisted on ${agentId}`)
            .toEqual({ [customLabel.key]: customLabel.value });
        }
      },
    );
  });

  test('PMM-T2428 - Verify Change agent log level for mongodb-exporter and qan-mongodb-profiler-agent', async ({}) => {
    await cli.changeAgentsUntilPersisted(
      cli.changeMongoAgents(containerName, exporterId, profilerId, '--log-level=debug'),
      ['Log level : debug', '- changed log level to debug'],
      async () => {
        for (const agentId of [exporterId, profilerId]) {
          expect((await cli.getServerAgent(agentId)).log_level, `Log level was not persisted on ${agentId}`).toEqual('LOG_LEVEL_DEBUG');
        }
      },
    );
  });

  test('PMM-T2429 - Verify Change agent debug, trace and json flags for mongodb-exporter and qan-mongodb-profiler-agent', async ({}) => {
    for (const [command, agentId] of [[cli.changeMongoExporter(containerName, exporterId, '--debug --trace --json'), exporterId], [cli.changeMongoProfiler(containerName, profilerId, '--debug --trace --json'), profilerId]]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains(agentId);
    }
  });

  test('PMM-T2430 - Verify Change agent enable and disable for mongodb-exporter and qan-mongodb-profiler-agent', async ({}) => {
    const disable = { response: '- disabled agent', running: false };
    const enable = { response: '- enabled agent', running: true };
    const enableCommands = [
      { flag: '--enable=false', ...disable },
      { flag: '--enable=true', ...enable },
      { flag: '--enable=false', ...disable },
      { flag: '--enable', ...enable },
    ];

    const agentIds = [exporterId, profilerId];

    for (const { flag, response, running } of enableCommands) {
      await cli.changeAgentsUntilPersisted(
        cli.changeMongoAgents(containerName, exporterId, profilerId, flag),
        [response],
        async () => {
          for (const agentId of agentIds) {
            expect((await cli.getServerAgent(agentId)).disabled, `Disabled was not persisted on ${agentId}`).toBe(!running);
          }
        },
      );

      await cli.expectAgentsRunning(containerName, agentIds, running);
    }
  });

  test('PMM-T2431 - Verify Change agent agent password for mongodb-exporter', async ({}) => {
    const output = await cli.exec(cli.changeMongoExporter(containerName, exporterId, `--agent-password=${changedAgentPassword}`));
    await output.assertSuccess();
    await output.outContains('- updated agent password');
    agentPassword = changedAgentPassword;

    await cli.expectMongoUp(containerName, serviceName, agentPassword);
  });

  test('PMM-T2432 - Verify Change agent expose exporter for mongodb-exporter', async ({}) => {
    await cli.changeAgentsUntilPersisted([cli.changeMongoExporter(containerName, exporterId, '--expose-exporter')], ['- enabled expose exporter'], async () => {
      expect((await cli.getServerAgent(exporterId)).expose_exporter, 'Expose exporter was not persisted on the mongodb_exporter agent').toBe(true);
    });

    await expect(async () => {
      const metrics = await cli.scrapeExporterFromPmmServer(containerName, exporterId, agentPassword);
      await metrics.assertSuccess();
      await metrics.outContains('mongodb_up');
    }).toPass({ intervals: [5_000], timeout: 90_000 });
  });

  test('PMM-T2433 - Verify Change agent push metrics for mongodb-exporter', async ({}) => {
    await cli.changeAgentsUntilPersisted([cli.changeMongoExporter(containerName, exporterId, '--push-metrics')], ['- enabled push metrics'], async () => {
      expect((await cli.getServerAgent(exporterId)).push_metrics_enabled, 'Push metrics was not persisted on the mongodb_exporter agent').toBe(true);
    });

    await expect(async () => {
      const metrics = await cli.scrapeExporterFromPmmServer(containerName, exporterId, agentPassword);
      await metrics.assertSuccess();
      await metrics.outContains('mongodb_up');
      const exporterLine = (await cli.exec(`docker exec ${containerName} pmm-admin list`)).getStdOutLines().find((line) => line.includes(exporterId));
      expect(exporterLine).toContain('Running');
      expect(exporterLine).toContain('push');
    }).toPass({ intervals: [5_000], timeout: 60_000 });

    // Only vmagent's own output: with --client-debug pmm-agent also logs every SetState, which mentions vmagent.
    await (await cli.exec(`docker exec ${containerName} sh -c 'grep type=vm_agent /var/log/pmm-agent.log | tail -20 | grep -F "\\terror\\t" || true'`)).outEquals('');
  });

  test('PMM-T2434 - Verify Change agent max query length for qan-mongodb-profiler-agent', async ({}) => {
    const maxQueryLength = 2_048;

    await cli.changeAgentsUntilPersisted(
      [cli.changeMongoProfiler(containerName, profilerId, `--max-query-length=${maxQueryLength}`)],
      [`- changed max query length to ${maxQueryLength}`],
      async () => {
        expect((await cli.getServerAgent(profilerId)).max_query_length, 'Max query length was not persisted on the qan-mongodb-profiler-agent')
          .toEqual(maxQueryLength);
      },
    );
  });

  test('PMM-T2307 - Verify Change agent stats collections for mongodb-exporter', async ({}) => {
    const statsCollections = ['db1.col1', 'db2.col2'];

    await cli.changeAgentsUntilPersisted(
      [cli.changeMongoExporter(containerName, exporterId, `--stats-collections=${statsCollections.join(',')}`)],
      [`- updated stats collections: ${statsCollections.join(',')}`],
      async () => {
        expect((await cli.getServerAgent(exporterId)).stats_collections, 'Stats collections were not persisted on the mongodb_exporter agent')
          .toEqual(statsCollections);
      },
    );
  });

  test('PMM-T2308 - Verify Change agent collections limit for mongodb-exporter', async ({}) => {
    const collectionsLimit = 100;

    await cli.changeAgentsUntilPersisted(
      [cli.changeMongoExporter(containerName, exporterId, `--collections-limit=${collectionsLimit}`)],
      [`- changed collections limit to ${collectionsLimit}`],
      async () => {
        expect((await cli.getServerAgent(exporterId)).collections_limit, 'Collections limit was not persisted on the mongodb_exporter agent')
          .toEqual(collectionsLimit);
      },
    );
  });

  test('PMM-T2309 - Verify Change agent enable diagnostic data histograms for mongodb-exporter', async ({}) => {
    await cli.changeAgentsUntilPersisted(
      [cli.changeMongoExporter(containerName, exporterId, '--enable-diagnostic-data-histograms')],
      ['- enabled diagnostic data histograms'],
      async () => {
        expect((await cli.getServerAgent(exporterId)).enable_diagnostic_data_histograms, 'Diagnostic data histograms were not enabled on the mongodb_exporter agent')
          .toBe(true);
      },
    );
  });

  test('PMM-T2310 - Verify Change agent disable collectors for mongodb-exporter', async ({}) => {
    const agentId = exporterId;

    for (const collectorsToDisable of [['diagnosticdata', 'replicasetstatus'], ['collstats', 'dbstats']]) {
      await cli.changeAgentsUntilPersisted(
        [cli.changeMongoExporter(containerName, exporterId, `--disable-collectors=${collectorsToDisable.join(',')}`)],
        [`- updated disabled collectors: [${collectorsToDisable.join(' ')}]`],
        async () => {
          expect((await cli.getServerAgent(agentId)).disabled_collectors, 'Disabled collectors were not persisted on the mongodb_exporter agent')
            .toEqual(collectorsToDisable);
        },
      );
    }
  });

  test('PMM-T2435 - Verify Change agent skip connection check for mongodb-exporter and qan-mongodb-profiler-agent', async ({}) => {
    for (const command of cli.changeMongoAgents(containerName, exporterId, profilerId, '--password=invalid_skip_check_password --skip-connection-check')) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains('agent configuration updated.');
    }

    // The agents restart in a loop with the invalid password, so the restore is often reverted (PMM-15835).
    // Passwords are not readable through the API: check the agents reconnect instead.
    await cli.changeAgentsUntilPersisted(
      cli.changeMongoAgents(containerName, exporterId, profilerId, `--username=${newUsername} --password=${newPassword}`),
      ['- updated password'],
      async () => {
        await cli.expectAgentsRunning(containerName, [exporterId, profilerId], true, 30_000);
        await cli.expectMongoUp(containerName, serviceName, agentPassword, 30_000);
      },
      180_000,
    );
  });

  test('PMM-T2436 - Verify Change agent TLS for mongodb-exporter and qan-mongodb-profiler-agent', async ({}) => {
    const ext = 'basicConstraints=CA:FALSE\\nextendedKeyUsage=serverAuth,clientAuth';
    const certCommands = [
      'mkdir -p /certs',
      'openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=pmm-qa-ca -keyout /certs/ca.key -out /certs/ca-certs.pem',
      ...['server', 'client'].flatMap((name) => [
        `openssl req -newkey rsa:2048 -nodes -subj /CN=${name === 'server' ? containerName : 'pmm-test'} -keyout /certs/${name}.key -out /certs/${name}.csr`,
        `printf "${ext}${name === 'server' ? `\\nsubjectAltName=DNS:${containerName}` : ''}" > /certs/${name}.ext && openssl x509 -req -in /certs/${name}.csr -CA /certs/ca-certs.pem -CAkey /certs/ca.key -CAcreateserial -days 1 -extfile /certs/${name}.ext -out /certs/${name}.crt`,
        `cat /certs/${name}.crt /certs/${name}.key > /certs/${name}.pem`,
      ]),
      'chown mongod:mongod /certs/server.pem /certs/ca-certs.pem && chmod 600 /certs/server.pem && chmod 644 /certs/ca-certs.pem',
    ];

    for (const command of certCommands) {
      await (await cli.exec(`docker exec ${containerName} bash -c '${command}'`)).assertSuccess();
    }

    // mongod reads its options from /etc/sysconfig/mongod; /etc/mongod/mongod.conf is a bind mount shared with rs102 and rs103.
    await (await cli.exec(`docker exec ${containerName} cp /etc/sysconfig/mongod ${mongodSysconfigBackup}`)).assertSuccess();
    mongodTlsEnabled = true;
    await (await cli.exec(`docker exec ${containerName} sed -i '/^OPTIONS=/s#"$# --tlsMode requireTLS --tlsCertificateKeyFile /certs/server.pem --tlsCAFile /certs/ca-certs.pem"#' /etc/sysconfig/mongod`)).assertSuccess();
    await (await cli.exec(`docker exec ${containerName} grep -q requireTLS /etc/sysconfig/mongod`)).assertSuccess();
    await (await cli.exec(`docker exec ${containerName} systemctl restart mongod`)).assertSuccess();

    // The unit is Type=simple, so the restart returns before mongod validates the TLS config.
    await cli.waitForMongod(containerName, tlsProbe);
    expect((await cli.exec(plainProbe)).code, 'mongod should reject connections without TLS').not.toEqual(0);

    // MongoDB agents take a single cert+key PEM via --tls-certificate-key-file. The client key is unencrypted,
    // so the driver ignores --tls-certificate-key-file-password and the connection check still passes.
    const authDatabase = 'admin';
    const tlsFlags = `--tls --tls-skip-verify --tls-certificate-key-file=/certs/client.pem --tls-certificate-key-file-password=client_key_password --tls-ca-file=/certs/ca-certs.pem --authentication-database=${authDatabase}`;

    // rs101 has just restarted and is cut off from the replica set, so auth can briefly fail; the retry covers that too.
    await cli.changeAgentsUntilPersisted(
      cli.changeMongoAgents(containerName, exporterId, profilerId, tlsFlags),
      ['TLS enabled : true', '- updated TLS certificate key password', `- changed authentication database to ${authDatabase}`],
      async () => {
        for (const agentId of [exporterId, profilerId]) {
          expect((await cli.getServerAgent(agentId)).tls, `TLS was not persisted on ${agentId}`).toBe(true);
        }
      },
      120_000,
    );

    await cli.expectAgentsRunning(containerName, [exporterId, profilerId], true);
    await cli.expectMongoUp(containerName, serviceName, agentPassword, 300_000);

    // The server certificate names rs101, so the agents can also verify it against the CA.
    await cli.changeAgentsUntilPersisted(
      cli.changeMongoAgents(containerName, exporterId, profilerId, '--tls-skip-verify=false'),
      ['- disabled TLS skip verification'],
      async () => {
        for (const agentId of [exporterId, profilerId]) {
          expect((await cli.getServerAgent(agentId)).tls_skip_verify, `TLS skip verification is still on for ${agentId}`).toBe(false);
        }
      },
      120_000,
    );
    await cli.expectAgentsRunning(containerName, [exporterId, profilerId], true);
    await cli.expectMongoUp(containerName, serviceName, agentPassword, 300_000);

    // SCRAM-SHA-256 is not in the server's authenticationMechanisms, so only check the flag is accepted,
    // then reset it to restore default negotiation.
    const authMechanism = 'SCRAM-SHA-256';

    for (const command of cli.changeMongoAgents(containerName, exporterId, profilerId, `--authentication-mechanism=${authMechanism} --skip-connection-check`)) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains(`- changed authentication mechanism to ${authMechanism}`);
    }

    for (const command of cli.changeMongoAgents(containerName, exporterId, profilerId, '--authentication-mechanism= --skip-connection-check')) {
      await (await cli.exec(command)).assertSuccess();
    }

    await cli.expectMongoUp(containerName, serviceName, agentPassword, 300_000);
  });

  test('PMM-T2437 - Verify Change agent pmm-agent listen port for mongodb-exporter and qan-mongodb-profiler-agent', async ({}) => {
    pmmAgentListenPortChanged = true;
    await (await cli.exec(`docker exec ${containerName} sed -i 's/listen-port: 7777/listen-port: 7778/' ${pmmAgentConfig}`)).assertSuccess();
    await (await cli.exec(`docker exec ${containerName} grep -q 'listen-port: 7778' ${pmmAgentConfig}`)).assertSuccess();
    await (await cli.exec(`docker exec ${containerName} systemctl restart pmm-agent`)).assertSuccess();

    await expect(async () => {
      await (await cli.exec(`docker exec ${containerName} pmm-admin status --pmm-agent-listen-port=7778`)).assertSuccess();
    }).toPass({ intervals: [2_000], timeout: 60_000 });

    await cli.changeAgentsUntilPersisted(
      cli.changeMongoAgents(containerName, exporterId, profilerId, '--log-level=info --pmm-agent-listen-port=7778'),
      ['- changed log level to info'],
      async () => {
        for (const agentId of [exporterId, profilerId]) {
          expect((await cli.getServerAgent(agentId)).log_level, `Log level was not persisted on ${agentId}`).toEqual('LOG_LEVEL_INFO');
        }
      },
    );
  });

  test('PMM-T2438 - Verify Change agent server URL and server insecure TLS for mongodb-exporter and qan-mongodb-profiler-agent', async ({}) => {
    const serverUrl = `https://admin:${adminPassword}@pmm-server:8443/`;

    for (const command of cli.changeMongoAgents(containerName, exporterId, profilerId, `--server-url=${serverUrl} --pmm-agent-listen-port=7778`)) {
      await cli.expectFailure(await cli.exec(command), 'tls: failed to verify certificate:');
    }

    for (const command of cli.changeMongoAgents(containerName, exporterId, profilerId, `--server-url=${serverUrl} --server-insecure-tls --pmm-agent-listen-port=7778`)) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains('agent configuration updated.');
    }
  });
});

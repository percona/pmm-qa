import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as mongo from '@helpers/mongo';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';
import { clientCredentialsFlags, gssapi, mongoConnection } from '@helpers/constants';

const containerName = 'rs101';
const replIpPort = 'rs101:27017';
const mongoUri = 'mongodb://root:root@localhost:27017/?authSource=admin&directConnection=true';
const profilerAgent = 'AGENT_TYPE_QAN_MONGODB_PROFILER_AGENT';
const mongologAgent = 'AGENT_TYPE_QAN_MONGODB_MONGOLOG_AGENT';

test.describe('PSMDB pmm-admin update settings', { tag: '@psmdb' }, () => {
  test.use({ pmmClientContainer: containerName });

  const serviceName = 'mongo_update_settings_cli';
  const database = 'pmm_qa_update_settings';
  const agentPassword = 'mypass';

  let serviceId: string;
  let exporterId: string;
  let profilerId: string;
  let databaseCreated = false;

  const update = async (args: string) => pmmAdmin.updateServiceOk(containerName, 'mongodb', `${serviceName} ${args}`);
  const updateJson = async (args: string) => pmmAdmin.updateServiceJson(containerName, 'mongodb', `${serviceName} ${args}`);
  const exporterArgs = async () => pmmCli.getExporterArgs(containerName, exporterId);
  const agentOfType = async (agentType: string) => pmmAdmin.findServiceAgentId(containerName, serviceId, agentType);

  test.beforeAll(async ({}) => {
    test.skip(gssapi.enabled === 'true', 'Updates the service with SCRAM credentials, which the GSSAPI setup does not use');

    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'PSMDB rs101 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=pss');

    await mongo.runOnPrimary(containerName, mongoUri, `db.getSiblingDB("${database}").items.insertOne({ created: new Date() })`);
    databaseCreated = true;

    ({ exporterId, profilerId } = await pmmAdmin.addMongoServiceAgents(
      containerName,
      `${clientCredentialsFlags} --enable-all-collectors --query-source=profiler --metrics-mode=push --agent-password=${agentPassword}`,
      serviceName,
      replIpPort,
    ));
    expect(exporterId, `mongodb_exporter for service ${serviceName} not found`).toBeTruthy();
    expect(profilerId, `mongodb_profiler_agent for service ${serviceName} not found`).toBeTruthy();
    serviceId = await pmmAdmin.getServiceId(containerName, serviceName);
    await pmmAdmin.expectAgentsRunning(containerName, [exporterId, profilerId], true);
  });

  test.afterAll(async ({}) => {
    await pmmCli.runEach([
      async () => {
        if (exporterId) await pmmAdmin.removeMongoService(containerName, serviceName);
      },
      async () => {
        if (databaseCreated) await mongo.runOnPrimary(containerName, mongoUri, `db.getSiblingDB("${database}").dropDatabase()`);
      },
    ]);
  });

  test('PMM-T2741 - Verify pmm-admin update mongodb sets and clears the custom labels and the replication set', async ({}) => {
    await update('--custom-labels= --replication-set=');

    const output = await update('--custom-labels=update_a=1,update_b=2 --replication-set=update_rs');
    expect(pmmAdmin.getChangedSettings(output).sort()).toEqual(['--custom-labels=update_a=1,update_b=2 (was empty)', '--replication-set=update_rs (was empty)']);
    const service = await pmmApi.getServerService(serviceId);
    expect(service.custom_labels, 'Custom labels are not changed on PMM Server').toEqual({ update_a: '1', update_b: '2' });
    expect(service.replication_set, 'Replication set is not changed on PMM Server').toEqual('update_rs');

    const cleared = await update('--custom-labels=');
    expect(pmmAdmin.getChangedSettings(cleared)).toEqual(['--custom-labels= (was update_a=1,update_b=2)']);
    expect((await pmmApi.getServerService(serviceId)).custom_labels ?? {}, 'Custom labels are not cleared on PMM Server').toEqual({});
    expect((await pmmApi.getServerService(serviceId)).replication_set, 'Replication set changed by clearing the labels').toEqual('update_rs');
  });

  test('PMM-T2742 - Verify pmm-admin update mongodb switches the metrics mode between push, pull and auto', async ({}) => {
    const pushEnabled = async () => (await pmmApi.getServerAgent(exporterId)).push_metrics_enabled;
    await update('--metrics-mode=push');
    expect(await pushEnabled()).toBe(true);

    const pull = await update('--metrics-mode=pull');
    expect(pmmAdmin.getChangedSettings(pull)).toEqual(['--metrics-mode=pull (was push)']);
    expect(await pushEnabled(), 'The exporter is still in push mode').toBe(false);

    // Auto picks push for an exporter that does not run on PMM Server.
    const auto = await update('--metrics-mode=auto');
    expect(pmmAdmin.getChangedSettings(auto)).toEqual(['--metrics-mode=push (was pull)']);
    expect(await pushEnabled(), 'The exporter is not in push mode').toBe(true);

    const push = await update('--metrics-mode=push');
    await push.outContains('No settings changed.');
  });

  test('PMM-T2743 - Verify pmm-admin update mongodb changes the connection timeout, the exposed exporter and the authentication mechanism', async ({}) => {
    await update('--no-expose-exporter');
    await expect(async () => {
      expect((await pmmCli.scrapeExporterFromPmmServer(containerName, exporterId, agentPassword)).code, 'The exporter is reachable from PMM Server').not.toEqual(0);
    }).toPass({ intervals: [3_000], timeout: 60_000 });

    const result = await updateJson('--connection-timeout=7s --expose-exporter --authentication-mechanism=SCRAM-SHA-1');
    expect(result.changes.map((change) => change.flag).sort()).toEqual(['--authentication-mechanism', '--connection-timeout', '--expose-exporter']);
    expect(pmmAdmin.getSettingValue(result, '--connection-timeout')).toEqual('7s');
    expect(pmmAdmin.getSettingValue(result, '--expose-exporter')).toEqual('true');
    expect(pmmAdmin.getSettingValue(result, '--authentication-mechanism')).toEqual('SCRAM-SHA-1');
    expect((await pmmApi.getServerAgent(exporterId)).expose_exporter, 'Exporter is not exposed on PMM Server').toBe(true);

    await expect(async () => {
      await (await pmmCli.scrapeExporterFromPmmServer(containerName, exporterId, agentPassword)).assertSuccess();
    }).toPass({ intervals: [3_000], timeout: 60_000 });
    await mongo.expectMongoUp(containerName, serviceName, agentPassword);

    await update('--no-expose-exporter');
    await expect(async () => {
      expect((await pmmCli.scrapeExporterFromPmmServer(containerName, exporterId, agentPassword)).code, 'The exporter is still reachable from PMM Server').not.toEqual(0);
    }).toPass({ intervals: [3_000], timeout: 60_000 });
  });

  test('PMM-T2744 - Verify pmm-admin update mongodb changes the stats collections and the agent environment variable names', async ({}) => {
    await update('--stats-collections= --agent-env-vars=');

    const collections = await update(`--stats-collections=${database}.items`);
    expect(pmmAdmin.getChangedSettings(collections)).toEqual([`--stats-collections=${database}.items (was empty)`]);
    await expect(async () => {
      expect(await exporterArgs(), 'Stats collections are not passed to the exporter').toContain(`--mongodb.collstats-colls=${database}.items`);
    }).toPass({ intervals: [3_000], timeout: 60_000 });

    const names = await update('--agent-env-vars=PMM_QA_UPDATE_VAR');
    expect(pmmAdmin.getChangedSettings(names)).toEqual(['--agent-env-vars=PMM_QA_UPDATE_VAR (was empty)']);

    const reserved = await pmmAdmin.updateService(containerName, 'mongodb', `${serviceName} --agent-env-vars=MONGODB_URI`);
    await cli.expectFailure(reserved, 'environment variable name \'MONGODB_URI\' is reserved for mongodb_exporter');

    const clearedNames = await update('--agent-env-vars=');
    expect(pmmAdmin.getChangedSettings(clearedNames), 'The rejected update changed the variable names').toEqual(['--agent-env-vars= (was PMM_QA_UPDATE_VAR)']);
    const clearedCollections = await update('--stats-collections=');
    expect(pmmAdmin.getChangedSettings(clearedCollections)).toEqual([`--stats-collections= (was ${database}.items)`]);
    await expect(async () => {
      expect(await exporterArgs(), 'Stats collections are still passed to the exporter').not.toContain(`--mongodb.collstats-colls=${database}.items`);
    }).toPass({ intervals: [3_000], timeout: 60_000 });
  });

  test('PMM-T2745 - Verify pmm-admin update mongodb switches the query source between profiler, mongolog and none', async ({}) => {
    const maxQueryLength = await updateJson('--max-query-length=1024');
    expect(pmmAdmin.getSettingValue(maxQueryLength, '--max-query-length')).toEqual('1024');
    expect(maxQueryLength.changes.map((change) => change.flag)).toEqual(['--max-query-length']);
    expect(await agentOfType(profilerAgent), 'The QAN agent is replaced by a change of its settings').toEqual(profilerId);

    const mongolog = await update('--query-source=mongolog');
    expect(pmmAdmin.getChangedSettings(mongolog)).toContain('--query-source=mongolog (was profiler)');
    expect(await agentOfType(profilerAgent), 'mongodb_profiler_agent is not removed').toBeUndefined();
    expect(await agentOfType(mongologAgent), 'mongodb_mongolog_agent is not added').toBeTruthy();

    const none = await update('--query-source=none');
    expect(pmmAdmin.getChangedSettings(none)).toContain('--query-source=none (was mongolog)');
    expect(await agentOfType(mongologAgent), 'mongodb_mongolog_agent is not removed').toBeUndefined();
    expect(await agentOfType(profilerAgent), 'mongodb_profiler_agent should not exist').toBeUndefined();

    const profiler = await update('--query-source=profiler');
    expect(pmmAdmin.getChangedSettings(profiler)).toContain('--query-source=profiler (was none)');
    const restoredId = await agentOfType(profilerAgent);
    expect(restoredId, 'mongodb_profiler_agent is not added again').toBeTruthy();
    await pmmAdmin.expectAgentsRunning(containerName, [exporterId, restoredId!], true);
    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);
  });

  test('PMM-T2746 - Verify pmm-admin update mongodb moves the Service to another address in place', async ({}) => {
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);

    const host = await update('--host=127.0.0.1');
    expect(pmmAdmin.getChangedSettings(host)).toEqual(['--host=127.0.0.1 (was rs101)']);
    expect((await pmmApi.getServerService(serviceId)).address, 'Address is not changed on PMM Server').toEqual('127.0.0.1');
    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);
    expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    await mongo.expectMongoUp(containerName, serviceName, agentPassword);

    const address = await update(replIpPort);
    expect(pmmAdmin.getChangedSettings(address)).toEqual(['--host=rs101 (was 127.0.0.1)']);
    expect((await pmmApi.getServerService(serviceId)).address, 'Address is not restored on PMM Server').toEqual('rs101');
    expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    await mongo.expectMongoUp(containerName, serviceName, agentPassword);
  });

  test.describe('credentials source', () => {
    const user = 'pmm_update_source_user';
    const credentialsService = 'mongo_update_cli_credentials_source';
    const credentialsFile = '/tmp/mongo_update_credentials_source.json';
    const adminUser = mongo.adminUser(containerName, mongoUri, user);
    let credentialsExporterId: string | undefined;
    let userCreated = false;

    test.afterAll(async ({}) => {
      await pmmCli.runEach([
        async () => {
          if (credentialsExporterId) await pmmAdmin.removeMongoService(containerName, credentialsService);
        },
        async () => {
          await (await cli.exec(`docker exec ${containerName} rm -f ${credentialsFile}`)).assertSuccess();
        },
        async () => {
          if (userCreated) await adminUser.drop();
        },
      ]);
    });

    test('PMM-T2747 - Verify pmm-admin update --credentials-source changes only the credentials present in the file', async ({}) => {
      await adminUser.create('first-password');
      userCreated = true;
      const agents = await pmmAdmin.addMongoServiceAgents(
        containerName,
        `--username=${user} --password=first-password --query-source=profiler --metrics-mode=push --agent-password=${agentPassword}`,
        credentialsService,
        replIpPort,
      );
      credentialsExporterId = agents.exporterId;
      expect(credentialsExporterId, `mongodb_exporter for service ${credentialsService} not found`).toBeTruthy();
      await pmmAdmin.expectAgentsRunning(containerName, [agents.exporterId, agents.profilerId], true);

      await adminUser.setPassword('second-password');
      await (await cli.exec(`docker exec ${containerName} sh -c ${cli.shellQuote(`echo '{"password": "second-password"}' > ${credentialsFile}`)}`)).assertSuccess();
      const reports = await pmmCli.countAgentRunningReports(containerName, agents.exporterId);

      const output = await pmmAdmin.updateServiceOk(containerName, 'mongodb', `${credentialsService} --credentials-source=${credentialsFile}`);
      expect(pmmAdmin.getChangedSettings(output), 'Only the password is in the file').toEqual(['--password (new value)']);
      expect(pmmAdmin.getCurrentSettings(output), 'The username changed').toContain(`--username=${user}`);

      await expect(async () => {
        expect(await pmmCli.countAgentRunningReports(containerName, agents.exporterId), 'pmm-agent has not restarted the exporter').toBeGreaterThan(reports);
      }).toPass({ intervals: [2_000], timeout: 60_000 });
      await mongo.expectMongoUp(containerName, credentialsService, agentPassword, 60_000);
    });
  });

  test.describe('more update flags', () => {
    const renameUser = 'pmm_update_rename_user';
    const adminUser = mongo.adminUser(containerName, mongoUri, renameUser);
    let renameUserCreated = false;

    test.afterEach(async ({}, testInfo) => {
      // A version-gated test is skipped after its fixtures ran, and afterEach still runs for it.
      if (testInfo.status === 'skipped') return;

      await pmmCli.runEach([
        async () => {
          await update(`--agent-password=${agentPassword} --username=${mongoConnection.username} --password=${mongoConnection.password} --port=27017`);
        },
        async () => {
          if (renameUserCreated) await adminUser.drop();
          renameUserCreated = false;
        },
      ]);
    });

    test('PMM-T2788 - Verify pmm-admin update mongodb turns the diagnostic data histograms on and off', async ({}) => {
      const on = await update('--enable-diagnostic-data-histograms');
      expect(pmmAdmin.getChangedSettings(on)).toEqual(['--enable-diagnostic-data-histograms (was --no-enable-diagnostic-data-histograms)']);
      await expect(async () => {
        expect(await exporterArgs(), 'Histograms are not enabled in the exporter').toContain('--collector.diagnosticdata-histograms');
      }).toPass({ intervals: [3_000], timeout: 60_000 });

      const off = await update('--no-enable-diagnostic-data-histograms');
      expect(pmmAdmin.getChangedSettings(off)).toEqual(['--no-enable-diagnostic-data-histograms (was --enable-diagnostic-data-histograms)']);
      await expect(async () => {
        expect(await exporterArgs(), 'Histograms are still enabled in the exporter').not.toContain('--collector.diagnosticdata-histograms');
      }).toPass({ intervals: [3_000], timeout: 60_000 });
    });

    test('PMM-T2789 - Verify pmm-admin update mongodb changes the authentication database', async ({}) => {
      const set = await update('--authentication-database=admin');
      expect(pmmAdmin.getChangedSettings(set)).toEqual(['--authentication-database=admin (was empty)']);
      await pmmAdmin.expectAgentsRunning(containerName, await pmmAdmin.getServiceAgentIds(containerName, serviceId), true);
      await mongo.expectMongoUp(containerName, serviceName, agentPassword);

      const cleared = await update('--authentication-database=');
      expect(pmmAdmin.getChangedSettings(cleared)).toEqual(['--authentication-database= (was admin)']);
      await mongo.expectMongoUp(containerName, serviceName, agentPassword);
    });

    test('PMM-T2790 - Verify pmm-admin update mongodb changes the password of the exporter endpoint', async ({}) => {
      const newPassword = 'newpass';

      const output = await update(`--agent-password=${newPassword}`);
      expect(pmmAdmin.getChangedSettings(output)).toEqual(['--agent-password (new value)']);
      await mongo.expectMongoUp(containerName, serviceName, newPassword);
      expect(await cli.getMetrics(serviceName, 'pmm', agentPassword, containerName), 'The old password still opens the endpoint').not.toContain('mongodb_up');
    });

    test('PMM-T2791 - Verify pmm-admin update mongodb changes the user of the exporter and the QAN agent', async ({}) => {
      await adminUser.create('rename-password');
      renameUserCreated = true;

      const output = await update(`--username=${renameUser} --password=rename-password`);
      expect(pmmAdmin.getChangedSettings(output).sort()).toEqual(['--password (new value)', `--username=${renameUser} (was ${mongoConnection.username})`]);
      await pmmAdmin.expectAgentsRunning(containerName, await pmmAdmin.getServiceAgentIds(containerName, serviceId), true);
      await mongo.expectMongoUp(containerName, serviceName, agentPassword);
    });

    test('PMM-T2792 - Verify pmm-admin update mongodb changes the port only when the connection works or is not checked', async ({}) => {
      const port = (await pmmApi.getServerService(serviceId)).port as number;

      const rejected = await pmmAdmin.updateService(containerName, 'mongodb', `${serviceName} --port=27018`);
      await cli.expectFailure(rejected, 'Connection check failed');
      expect((await pmmApi.getServerService(serviceId)).port, 'Port changed by a failed update').toEqual(port);

      const moved = await update('--port=27018 --skip-connection-check');
      expect(pmmAdmin.getChangedSettings(moved)).toEqual([`--port=27018 (was ${port})`]);
      expect((await pmmApi.getServerService(serviceId)).port, 'Port is not changed on PMM Server').toEqual(27018);

      const restored = await update(`--port=${port}`);
      expect(pmmAdmin.getChangedSettings(restored)).toEqual([`--port=${port} (was 27018)`]);
      await pmmAdmin.expectAgentsRunning(containerName, await pmmAdmin.getServiceAgentIds(containerName, serviceId), true);
      await mongo.expectMongoUp(containerName, serviceName, agentPassword);
    });
  });
});

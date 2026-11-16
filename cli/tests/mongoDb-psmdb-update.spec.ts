import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as mongo from '@helpers/mongo';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';
import { clientCredentialsFlags, gssapi } from '@helpers/constants';

const containerName = 'rs101';
const replIpPort = 'rs101:27017';
const mongoUri = 'mongodb://root:root@localhost:27017/?authSource=admin&directConnection=true';

test.describe('PSMDB pmm-admin update', { tag: '@psmdb' }, () => {
  test.use({ pmmClientContainer: containerName });

  const serviceName = 'mongo_update_cli';
  const database = 'pmm_qa_update';
  const agentPassword = 'mypass';
  const collectorFamilies = ['dbstats', 'collstats', 'indexstats', 'top'];

  let serviceId: string;
  let exporterId: string;
  let databaseCreated = false;

  const update = async (args: string) => pmmAdmin.updateServiceOk(containerName, 'mongodb', `${serviceName} ${args}`);
  const metrics = async () => cli.getMetrics(serviceName, 'pmm', agentPassword, containerName);
  const exporterArgs = async () => pmmCli.getExporterArgs(containerName, exporterId);
  const hasFamily = (scrape: string, family: string) => new RegExp(`^mongodb_${family}_`, 'm').test(scrape);

  const expectFamilies = async (present: boolean) => {
    await expect(async () => {
      const scrape = await metrics();

      for (const family of collectorFamilies) {
        expect(hasFamily(scrape, family), `mongodb_${family}_* metrics should ${present ? '' : 'not '}be exported`).toBe(present);
      }
    }).toPass({ intervals: [5_000], timeout: 90_000 });
  };

  const expectServiceIdentity = async (agentIds: string[]) => {
    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);
    expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
  };

  test.beforeAll(async ({}) => {
    test.skip(gssapi.enabled === 'true', 'Updates the service with SCRAM credentials, which the GSSAPI setup does not use');

    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'PSMDB rs101 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=pss');

    // collstats and the profiler only see a database that already exists.
    await mongo.runOnPrimary(containerName, mongoUri, `db.getSiblingDB("${database}").items.insertOne({ created: new Date() })`);
    databaseCreated = true;

    ({ exporterId } = await pmmAdmin.addMongoServiceAgents(
      containerName,
      `${clientCredentialsFlags} --enable-all-collectors --query-source=profiler --metrics-mode=push --agent-password=${agentPassword}`,
      serviceName,
      replIpPort,
    ));
    expect(exporterId, `mongodb_exporter for service ${serviceName} not found`).toBeTruthy();
    serviceId = await pmmAdmin.getServiceId(containerName, serviceName);
    await pmmAdmin.expectAgentsRunning(containerName, await pmmAdmin.getServiceAgentIds(containerName, serviceId), true);
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

  test('PMM-T2630 - Verify pmm-admin update mongodb changes disabled collectors and collections limit in place', async ({}) => {
    await update('--enable-all-collectors --max-collections-limit=-1 --disable-collectors=');
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);

    const output = await update('--max-collections-limit=0 --disable-collectors=collstats');
    await output.outContains('MongoDB Service updated.');
    expect(pmmAdmin.getChangedSettings(output).sort()).toEqual(['--disable-collectors=collstats (was empty)', '--max-collections-limit=0 (was -1)']);

    await expectServiceIdentity(agentIds);
    await expect(async () => {
      const args = await exporterArgs();
      expect(args, 'collstats limit is not passed to the exporter').toContain('--collector.collstats-limit=0');
      expect(args, 'collstats collector is still enabled').not.toContain('--collector.collstats');
    }).toPass({ intervals: [3_000], timeout: 60_000 });
    await expect(async () => {
      expect(hasFamily(await metrics(), 'collstats'), 'collstats metrics are still exported').toBe(false);
    }).toPass({ intervals: [5_000], timeout: 90_000 });
  });

  test('PMM-T2631 - Verify pmm-admin update mongodb keeps the metrics history of the Service', async ({}) => {
    const query = `mongodb_up{service_name="${serviceName}"}`;

    await expect(async () => {
      expect((await pmmApi.queryVictoriaMetrics(query)).length, `No ${query} series yet`).toBeGreaterThan(0);
    }).toPass({ intervals: [5_000], timeout: 90_000 });
    const beforeUpdate = new Date();
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);
    const runningReports = await pmmCli.countAgentRunningReports(containerName, exporterId);

    await update('--log-level=error');
    await expect(async () => {
      expect(await pmmCli.countAgentRunningReports(containerName, exporterId), 'pmm-agent has not restarted the exporter yet').toBeGreaterThan(runningReports);
    }).toPass({ intervals: [2_000], timeout: 60_000 });
    await expectServiceIdentity(agentIds);

    const series = await pmmApi.queryVictoriaMetrics(query, undefined, beforeUpdate);
    expect(series.find((labels) => labels.agent_id === exporterId && labels.service_id === serviceId), `No history before the update: ${JSON.stringify(series)}`).toBeTruthy();
    await expect(async () => {
      const current = await pmmApi.queryVictoriaMetrics(query);
      expect(current.find((labels) => labels.agent_id === exporterId && labels.service_id === serviceId), `No new data after the update: ${JSON.stringify(current)}`).toBeTruthy();
    }).toPass({ intervals: [5_000], timeout: 90_000 });
  });

  test('PMM-T2632 - Verify pmm-admin update mongodb with an empty --disable-collectors re-enables the collectors', async ({}) => {
    await update('--enable-all-collectors --max-collections-limit=-1 --disable-collectors=collstats');
    await expect(async () => {
      expect(await exporterArgs()).not.toContain('--collector.collstats');
    }).toPass({ intervals: [3_000], timeout: 60_000 });

    const output = await update('--disable-collectors=');
    expect(pmmAdmin.getChangedSettings(output)).toEqual(['--disable-collectors= (was collstats)']);

    await expect(async () => {
      expect(await exporterArgs(), 'collstats collector is not enabled again').toContain('--collector.collstats');
    }).toPass({ intervals: [3_000], timeout: 60_000 });
    await expect(async () => {
      expect(hasFamily(await metrics(), 'collstats'), 'collstats metrics are not exported again').toBe(true);
    }).toPass({ intervals: [5_000], timeout: 90_000 });
  });

  test('PMM-T2633 - Verify pmm-admin update mongodb --no-enable-all-collectors stops the extra MongoDB metrics', async ({}) => {
    await update('--enable-all-collectors --max-collections-limit=-1 --disable-collectors=');
    await expectFamilies(true);

    const output = await update('--no-enable-all-collectors');
    expect(pmmAdmin.getChangedSettings(output)).toEqual(['--no-enable-all-collectors (was --enable-all-collectors)']);

    await expectFamilies(false);
  });

  test('PMM-T2634 - Verify pmm-admin update changes only the flags passed on the command line', async ({}) => {
    const first = await update('--environment=preproduction');
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);

    const output = await update('--environment=staging');
    expect(pmmAdmin.getChangedSettings(output)).toEqual(['--environment=staging (was preproduction)']);

    const settings = (result: typeof output) => pmmAdmin.getCurrentSettings(result).filter((setting) => !setting.startsWith('--environment='));
    expect(settings(output), 'Settings other than the environment changed').toEqual(settings(first));
    expect(pmmAdmin.getCurrentSettings(output)).toContain('--environment=staging');
    await expectServiceIdentity(agentIds);
  });

  test('PMM-T2635 - Verify pmm-admin update reports "No settings changed." when the values already match', async ({}) => {
    await update('--environment=staging --max-collections-limit=-1');
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);

    const output = await update('--environment=staging --max-collections-limit=-1');
    await output.outContains('No settings changed.');
    await output.outNotContains('Changed settings:');
    expect(pmmAdmin.getChangedSettings(output)).toEqual([]);
    await expectServiceIdentity(agentIds);
  });

  test('PMM-T2636 - Verify pmm-admin update --dry-run shows the changes without applying them', async ({}) => {
    await update('--environment=staging');
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);
    const listBefore = await pmmAdmin.listServices(containerName);
    const serviceBefore = await pmmApi.getServerService(serviceId);
    const exporterBefore = await pmmApi.getServerAgent(exporterId);

    const output = await update('--environment=dry-run-environment --dry-run');
    await output.outContains('MongoDB Service not changed (dry run).');
    await output.outContains('Settings the update would change:');
    expect(pmmAdmin.getChangedSettings(output)).toEqual(['--environment=dry-run-environment (was staging)']);

    expect(await pmmAdmin.listServices(containerName), 'pmm-admin list changed').toEqual(listBefore);
    await expectServiceIdentity(agentIds);
    expect(await pmmApi.getServerService(serviceId), 'Service changed on PMM Server').toEqual(serviceBefore);
    expect(await pmmApi.getServerAgent(exporterId), 'Exporter changed on PMM Server').toEqual(exporterBefore);
    expect(serviceBefore.environment).toEqual('staging');
  });

  test('PMM-T2637 - Verify pmm-admin update --json reports the changed settings', async ({}) => {
    await update('--environment=staging');

    const result = await pmmAdmin.updateServiceJson(containerName, 'mongodb', `${serviceName} --environment=json-environment`);
    expect(result.service_id).toEqual(serviceId);
    expect(result.service_name).toEqual(serviceName);
    expect(result.dry_run).toBe(false);
    expect(result.changed).toBe(true);
    expect(result.changes).toEqual([{
      flag: '--environment', before: 'staging', after: 'json-environment',
    }]);
    expect(result.settings).toContainEqual({ flag: '--environment', value: 'json-environment' });

    const dryRun = await pmmAdmin.updateServiceJson(containerName, 'mongodb', `${serviceName} --environment=staging --dry-run`);
    expect(dryRun.dry_run).toBe(true);
    expect(dryRun.changed).toBe(true);
    expect(dryRun.changes).toEqual([{
      flag: '--environment', before: 'json-environment', after: 'staging',
    }]);
  });

  test('PMM-T2638 - Verify pmm-admin update mongodb rejects a wrong password and changes nothing', async ({}) => {
    await update('--environment=staging');
    const serviceBefore = await pmmApi.getServerService(serviceId);
    const exporterBefore = await pmmApi.getServerAgent(exporterId);

    const output = await pmmAdmin.updateService(containerName, 'mongodb', `${serviceName} --password=wrong --environment=wrong-password`);
    await cli.expectFailure(output, 'Connection check failed');

    expect(await pmmApi.getServerService(serviceId), 'Service changed on PMM Server').toEqual(serviceBefore);
    expect(await pmmApi.getServerAgent(exporterId), 'Exporter changed on PMM Server').toEqual(exporterBefore);
    await expect(async () => {
      expect(await metrics(), 'mongodb_exporter does not connect').toMatch(/^mongodb_up\{[^}]*\} 1$/m);
    }).toPass({ intervals: [5_000], timeout: 60_000 });
  });

  test.describe('credentials', () => {
    const user = 'pmm_update_user';
    const credentialsService = 'mongo_update_cli_credentials';
    const setPassword = (password: string) => mongo.runOnPrimary(
      containerName,
      mongoUri,
      `db.getSiblingDB("admin").changeUserPassword("${user}", "${password}")`,
    );
    let credentialsAgentIds: { exporterId: string, profilerId: string } | undefined;
    let userCreated = false;

    test.afterAll(async ({}) => {
      await pmmCli.runEach([
        async () => {
          if (credentialsAgentIds) await pmmAdmin.removeMongoService(containerName, credentialsService);
        },
        async () => {
          if (userCreated) await mongo.runOnPrimary(containerName, mongoUri, `db.getSiblingDB("admin").dropUser("${user}")`);
        },
      ]);
    });

    test('PMM-T2639 - Verify pmm-admin update mongodb applies a new password to the exporter and the QAN agent', async ({}) => {
      await mongo.runOnPrimary(
        containerName,
        mongoUri,
        `db.getSiblingDB("admin").createUser({ user: "${user}", pwd: "first-password", roles: [{ role: "root", db: "admin" }] })`,
      );
      userCreated = true;
      credentialsAgentIds = await pmmAdmin.addMongoServiceAgents(
        containerName,
        `--username=${user} --password=first-password --query-source=profiler --metrics-mode=push --agent-password=${agentPassword}`,
        credentialsService,
        replIpPort,
      );
      const { exporterId: userExporterId, profilerId } = credentialsAgentIds;
      expect(userExporterId, `mongodb_exporter for service ${credentialsService} not found`).toBeTruthy();
      expect(profilerId, `mongodb_profiler_agent for service ${credentialsService} not found`).toBeTruthy();
      await pmmAdmin.expectAgentsRunning(containerName, [userExporterId, profilerId], true);

      await setPassword('second-password');
      const reports = {
        exporter: await pmmCli.countAgentRunningReports(containerName, userExporterId),
        profiler: await pmmCli.countAgentRunningReports(containerName, profilerId),
      };

      const output = await pmmAdmin.updateServiceOk(containerName, 'mongodb', `${credentialsService} --password=second-password`);
      expect(pmmAdmin.getChangedSettings(output)).toEqual(['--password (new value)']);

      // A restarted agent has to authenticate again, so it only reconnects with the new password.
      await expect(async () => {
        expect(await pmmCli.countAgentRunningReports(containerName, userExporterId), 'pmm-agent has not restarted the exporter').toBeGreaterThan(reports.exporter);
        expect(await pmmCli.countAgentRunningReports(containerName, profilerId), 'pmm-agent has not restarted the QAN agent').toBeGreaterThan(reports.profiler);
      }).toPass({ intervals: [2_000], timeout: 60_000 });
      await pmmAdmin.expectAgentsRunning(containerName, [userExporterId, profilerId], true);
      await expect(async () => {
        expect(await cli.getMetrics(credentialsService, 'pmm', agentPassword, containerName), 'mongodb_exporter does not connect with the new password')
          .toMatch(/^mongodb_up\{[^}]*\} 1$/m);
      }).toPass({ intervals: [5_000], timeout: 60_000 });
    });
  });

  test('PMM-T2640 - Verify pmm-admin update rejects a Service of another type', async ({}) => {
    await update('--environment=staging');
    const serviceBefore = await pmmApi.getServerService(serviceId);

    const output = await pmmAdmin.updateService(containerName, 'mysql', `${serviceName} --environment=wrong-type`);
    await cli.expectFailure(output, `Service ${serviceName} is a mongodb Service, not mysql.`);

    expect(await pmmApi.getServerService(serviceId), 'Service changed on PMM Server').toEqual(serviceBefore);
  });

  test('PMM-T2641 - Verify pmm-admin update rejects moving the Service to another Node', async ({}) => {
    const serviceBefore = await pmmApi.getServerService(serviceId);

    for (const flag of ['node-id', 'pmm-agent-id']) {
      const output = await pmmAdmin.updateService(containerName, 'mongodb', `${serviceName} --${flag}=pmm-server`);
      await cli.expectFailure(output, `--${flag} cannot be changed by update; remove the Service and add it again`);
    }

    expect(await pmmApi.getServerService(serviceId), 'Service changed on PMM Server').toEqual(serviceBefore);
  });

  test.describe('scheduled backups', () => {
    const clusterA = 'update_cluster_a';
    const clusterB = 'update_cluster_b';
    let locationId: string;
    let scheduleId: string;

    test.beforeAll(async ({}) => {
      locationId = await pmmApi.addFilesystemBackupLocation('mongo_update_cli_location', '/tmp/mongo_update_cli_backups');
    });

    test.beforeEach(async ({}) => {
      await update(`--cluster=${clusterA}`);
      scheduleId = await pmmApi.scheduleBackup(serviceId, locationId, 'mongo_update_cli_schedule');
      expect(await pmmApi.getScheduledBackupIds(serviceId)).toEqual([scheduleId]);
    });

    test.afterEach(async ({}) => {
      for (const id of await pmmApi.getScheduledBackupIds(serviceId)) {
        await pmmApi.removeScheduledBackup(id);
      }
    });

    test.afterAll(async ({}) => {
      await pmmApi.removeBackupLocation(locationId);
    });

    test('PMM-T2642 - Verify pmm-admin update mongodb keeps the scheduled backups when the cluster is not changed', async ({}) => {
      await update('--environment=staging');
      expect(await pmmApi.getScheduledBackupIds(serviceId), 'Schedule removed by an update that leaves the cluster').toEqual([scheduleId]);

      const output = await update(`--cluster=${clusterA}`);
      await output.outContains('No settings changed.');
      expect(await pmmApi.getScheduledBackupIds(serviceId), 'Schedule removed by an update to the same cluster').toEqual([scheduleId]);
    });

    test('PMM-T2643 - Verify pmm-admin update mongodb removes the scheduled backups when the cluster is changed', async ({}) => {
      const output = await update(`--cluster=${clusterB}`);
      expect(pmmAdmin.getChangedSettings(output)).toEqual([`--cluster=${clusterB} (was ${clusterA})`]);

      expect(await pmmApi.getScheduledBackupIds(serviceId), 'Schedule is kept after the cluster change').toEqual([]);
      expect((await pmmApi.getServerService(serviceId)).cluster).toEqual(clusterB);
    });

    test('PMM-T2644 - Verify pmm-admin update mongodb keeps the scheduled backups when the cluster change fails the connection check', async ({}) => {
      const output = await pmmAdmin.updateService(containerName, 'mongodb', `${serviceName} --cluster=${clusterB} --password=wrong`);
      await cli.expectFailure(output, 'Connection check failed');

      expect(await pmmApi.getScheduledBackupIds(serviceId), 'Schedule removed by a failed update').toEqual([scheduleId]);
      expect((await pmmApi.getServerService(serviceId)).cluster, 'Cluster changed by a failed update').toEqual(clusterA);
    });
  });
});

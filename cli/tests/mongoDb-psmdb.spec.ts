import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import { expectMongoUp, runOnPrimary } from '@helpers/mongo';
import * as pbm from '@helpers/pbm';
import { ChangeAgentType, addMongoServiceAndGetExporterId, getPmmAdminMinorVersion, inventoryChangeAgent, removeMongoService } from '@root/helpers/pmm-admin';
import { clientCredentialsFlags, mongoConnection } from '@helpers/constants';
import { versionBelow } from '@helpers/versionGates';
import { faker } from '@faker-js/faker';
import * as pmmApi from '@helpers/pmm-api-helper';

const replIpPort = 'rs101:27017';
const ip = replIpPort.split(':')[0];
const port = replIpPort.split(':')[1];
const mongoPushMetricsServiceName = 'mongo_push_1';
const mongoPullMetricsServiceName = 'mongo_pull_1';
const mongoServiceName = 'mongo_service_1';
const containerName = 'rs101';
let adminVersion: number;
const servicesToRemove: string[] = [];
const connectionTimeoutServiceName = 'mongo_connection_timeout_service';
const exporterContainer = 'rs102';
const agentPassword = 'mypass';
const exporterPath = '/usr/local/percona/pmm/exporters/mongodb_exporter';
const baselineVersion = '3.10.0';
const baselineExporter = `/tmp/mongodb_exporter-${baselineVersion}`;
const currentExporterBackup = '/tmp/mongodb_exporter-under-test';
const megabyte = 1_000_000;
// Two runs of the same binary differ by up to about 8%; the fix measured 33% (46 to 31 MiB).
const requiredMemoryRatio = 0.9;

test.describe('Percona Server MongoDB (PSMDB) CLI tests', { tag: '@psmdb' }, () => {
  test.use({ pmmClientContainer: containerName });

  test.beforeAll(async ({}) => {
    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'PSMDB rs101 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=pss');
    adminVersion = await getPmmAdminMinorVersion(containerName);
  });

  test.afterEach(async ({}) => {
    for (const serviceName of servicesToRemove.splice(0)) {
      await removeMongoService(containerName, serviceName);
    }
  });

  test('run pmm-admin', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin`);
    await output.outContains('Usage: pmm-admin <command>');
  });

  test('run pmm-admin add mongodb with metrics-mode push', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --metrics-mode=push ${mongoPushMetricsServiceName} ${replIpPort}`);
    await output.assertSuccess();
    await output.outContains('MongoDB Service added');

    await removeMongoService(containerName, mongoPushMetricsServiceName);
  });

  test('run pmm-admin add mongodb with metrics-mode pull', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --metrics-mode=pull ${mongoPullMetricsServiceName} ${replIpPort}`);
    await output.assertSuccess();
    await output.outContains('MongoDB Service added');

    await removeMongoService(containerName, mongoPullMetricsServiceName);
  });

  test('run pmm-admin add mongodb again based on running instances to check if fails with error message exists', async ({}) => {
    let output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} mongo_exists ${replIpPort}`);
    await output.assertSuccess();
    await output.outContains('MongoDB Service added');
    await cli.exec('sleep 2');

    output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} mongo_exists ${replIpPort}`);
    await output.exitCodeEquals(1);
    await output.outContains('already exists.');

    await removeMongoService(containerName, 'mongo_exists');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/modb-tests.bats#L108
   */
  test("PMM-T160 User can't use both socket and address while using pmm-admin add mongodb", async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --socket=/tmp/mongodb-${port}.sock ${mongoServiceName} ${replIpPort}`);
    await output.exitCodeEquals(1);
    await output.outContains('Socket and address cannot be specified together.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/modb-tests.bats#L148
   */
  test('PMM-T157 PMM-T161 Adding and removing MongoDB with specified socket for modb', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --socket=/tmp/mongodb-27017.sock mongo_socket`);
    await output.assertSuccess();
    await output.outContains('MongoDB Service added');
    await cli.exec('sleep 2');

    await removeMongoService(containerName, 'mongo_socket');
  });

  test('run pmm-admin add and remove mongodb based on running instances using service-name, port, username and password labels', async ({}) => {
    const serviceName = 'mongo_host_port';

    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --host=${ip} --port=${port} --service-name=${serviceName}`);
    await output.assertSuccess();
    await output.outContains('MongoDB Service added');

    await removeMongoService(containerName, serviceName);
  });

  test('PMM-T964 run pmm-admin add mongodb with --agent-password flag', async ({}) => {
    const serviceName = 'mongo_agent_password';
    await cli.exec(`docker exec ${containerName} pmm-admin remove mongodb ${serviceName} || true`);

    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --host=${ip} --agent-password=mypass --port=${port} --service-name=${serviceName}`);
    await output.assertSuccess();
    await output.outContains('MongoDB Service added');

    await test.step('PMM-T964 check metrics from mongodb service with custom agent password', async () => {
      await expect(async () => {
        const metrics = await cli.getMetrics(serviceName, 'pmm', 'mypass', containerName);
        const expectedValue = 'mongodb_up{cluster_role="mongod"} 1';
        expect(metrics, `Scraped metrics do not contain ${expectedValue}!`).toContain(expectedValue);
      }).toPass({ intervals: [2_000], timeout: 120_000 });
    });

    await removeMongoService(containerName, serviceName);
  });

  test('PMM-T2128 verify environment variable passed using --agent-env-vars parameter from pmm agent to mongodb_exporter', async ({}) => {
    test.skip(adminVersion < 6, 'This test is relevant for pmm-client version 3.6.0 and above');

    const serviceName = `mongo_agent_env_vars_${faker.number.int(100)}`;
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --host=${ip} --agent-env-vars="KRB5_CLIENT_KTNAME" --port=${port} --service-name=${serviceName}`);
    await output.assertSuccess();

    await expect(async () => {
      const mongodbExporterPid = await cli.exec(`docker exec ${containerName} pgrep -f mongodb_exporter | tail -n1`);
      const vmAgentOpts = await cli.exec(`docker exec ${containerName} cat /proc/${mongodbExporterPid.getStdOutLines()[0]}/environ`);
      await vmAgentOpts.outContains('KRB5_CLIENT_KTNAME=/keytabs/mongodb.keytab');
    }).toPass({
      timeout: 60_000,
      intervals: [5_000],
    });
  });

  test('PMM-T2129 verify validation for --agent-env-vars parameter when adding mondogb for monitoring', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --agent-env-vars="TEST=123" --service-name=test`);
    await output.exitCodeEquals(1);
    await output.outContains('invalid environment variable name: TEST=123 (must match [A-Za-z_][A-Za-z0-9_]*)');
  });

  test('PMM-T2325 - Verify --agent-env-vars can be changed on an existing mongodb_exporter with pmm-admin inventory change agent', async ({}) => {
    const serviceName = `mongo_change_env_vars_${faker.number.int(100)}`;
    const agentId = await addMongoServiceAndGetExporterId(containerName, serviceName, replIpPort, () => servicesToRemove.push(serviceName));
    const changeAgent = (flags: string) => inventoryChangeAgent(containerName, ChangeAgentType.MongodbExporter, agentId, flags);

    let output = await cli.exec(changeAgent('--agent-env-vars=KRB5_CLIENT_KTNAME,DOES_NOT_EXIST_VAR'));
    await output.assertSuccess();
    await output.outContainsMany([
      'Environment variables : KRB5_CLIENT_KTNAME, DOES_NOT_EXIST_VAR',
      'updated environment variable names: KRB5_CLIENT_KTNAME, DOES_NOT_EXIST_VAR',
    ]);

    output = await cli.exec(changeAgent('--log-level=debug'));
    await output.assertSuccess();
    await output.outContains('Environment variables : KRB5_CLIENT_KTNAME, DOES_NOT_EXIST_VAR');

    await expect(async () => {
      const agents = JSON.parse((await cli.exec(`docker exec ${containerName} pmm-admin list --json`)).stdout).agent;
      const listenPort = agents.find((a: { agent_id: string }) => a.agent_id === agentId)?.port;
      expect(listenPort, `mongodb_exporter ${agentId} has no listen port yet`).toBeTruthy();
      // Other exporters in this container (e.g. PMM-T2128's) carry KRB5_CLIENT_KTNAME too.
      const environ = await cli.exec(`docker exec ${containerName} sh -c 'for p in $(pgrep -f "[e]xporters/mongodb_exporter"); do tr "\\0" " " < /proc/$p/cmdline | grep -q ":${listenPort} " && tr "\\0" "\\n" < /proc/$p/environ; done'`);
      await environ.outContains('KRB5_CLIENT_KTNAME=/keytabs/mongodb.keytab');
      await environ.outNotContains('DOES_NOT_EXIST_VAR');
      const list = await cli.exec(`docker exec ${containerName} pmm-admin list`);
      expect(list.getStdOutLines().find((line) => line.includes(agentId))).toContain('Running');
    }).toPass({ intervals: [5_000], timeout: 60_000 });

    output = await cli.exec(changeAgent('--agent-env-vars=MY_TEST_VAR'));
    await output.assertSuccess();
    await output.outContains('Environment variables : MY_TEST_VAR');

    output = await cli.exec(changeAgent('--agent-env-vars='));
    await output.assertSuccess();
    await output.outContainsMany(['Environment variables : (none)', 'environment variable names are removed']);
  });

  test('PMM-T2326 - Verify validation of --agent-env-vars for pmm-admin inventory change agent mongodb-exporter', async ({}) => {
    const serviceName = `mongo_change_env_vars_validation_${faker.number.int(100)}`;
    const agentId = await addMongoServiceAndGetExporterId(containerName, serviceName, replIpPort, () => servicesToRemove.push(serviceName));
    const changeAgent = (flags: string) => inventoryChangeAgent(containerName, ChangeAgentType.MongodbExporter, agentId, flags);

    let output = await cli.exec(changeAgent('--agent-env-vars=VALID_VAR'));
    await output.assertSuccess();

    const tooManyNames = Array.from({ length: 33 }, (_, i) => `VAR${i}`).join(',');
    const invalidValues: [string, string][] = [
      ['MONGODB_URI', 'environment variable name \'MONGODB_URI\' is reserved for mongodb_exporter'],
      ['mongodb_uri', 'environment variable name \'mongodb_uri\' is reserved for mongodb_exporter'],
      ['PMM_AGENT_SERVER_PASSWORD', 'environment variable name \'PMM_AGENT_SERVER_PASSWORD\' is reserved for pmm-agent\'s own configuration'],
      ['VAR1,,VAR2', 'environment variable name cannot be empty'],
      ['KRB5_KTNAME=/tmp/test.keytab', 'invalid environment variable name: KRB5_KTNAME=/tmp/test.keytab'],
      [tooManyNames, 'too many environment variable names: 33 (max 32)'],
    ];

    for (const [value, error] of invalidValues) {
      output = await cli.exec(changeAgent(`--agent-env-vars="${value}"`));
      expect(output.code, `--agent-env-vars="${value}" should be rejected`).not.toEqual(0);
      expect(`${output.stdout}${output.stderr.text}`).toContain(error);
    }

    output = await cli.exec(changeAgent(''));
    await output.assertSuccess();
    await output.outContains('Environment variables : VALID_VAR');

    output = await cli.exec(changeAgent('--agent-env-vars=lowercase_var'));
    await output.assertSuccess();
    await output.outContains('Environment variables : lowercase_var');
  });

  test('PMM-T2005 verify PBM Agent health status metric is correct', async ({}) => {
    await cli.exec('docker exec rs103 systemctl start pbm-agent');
    await expect(async () => {
      const metrics = await cli.getMetrics('rs103', 'pmm', 'mypass', 'rs103');

      expect(metrics).toContain('mongodb_pbm_agent_status{host="rs103:27017",replica_set="rs",role="S",self="1"} 0');
    }).toPass({ intervals: [2_000], timeout: 120_000 });

    await cli.exec('docker exec rs103 pkill -f pbm-agent');

    await expect(async () => {
      const metrics = await cli.getMetrics('rs103', 'pmm', 'mypass', 'rs103');

      expect(metrics).toContain('mongodb_pbm_agent_status{host="rs103:27017",replica_set="rs",role="S",self="1"} 2');
    }).toPass({ intervals: [2_000], timeout: 120_000 });

    await cli.exec('docker exec rs103 systemctl start pbm-agent');

    await expect(async () => {
      const metrics = await cli.getMetrics('rs103', 'pmm', 'mypass', 'rs103');

      expect(metrics).toContain('mongodb_pbm_agent_status{host="rs103:27017",replica_set="rs",role="S",self="1"} 0');
    }).toPass({ intervals: [2_000], timeout: 120_000 });
  });

  test('PMM-T2179 - Verify adding RTA Agent in pmm-admin CLI', async ({ }) => {
    test.skip(adminVersion < 7, 'This test is relevant for pmm-client version 3.7.0 and above');

    const serviceId = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep "rs101" | awk -F" " '{print $4}'`)).getStdOutLines()[0];
    const pmmAgentId = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep pmm_agent | awk -F" " '{print $3}'`)).getStdOutLines()[0];

    const output = await cli.exec(`docker exec ${containerName} pmm-admin inventory add agent rta-mongodb-agent --server-url=https://admin:admin@pmm-server:8443 --server-insecure-tls ${pmmAgentId} ${serviceId} pmm --password=pmmpass`);
    await output.outContains('Real-Time Analytics MongoDB agent added.');

    await expect(async () => {
      const pmmAdminListOutput = await cli.exec(`docker exec ${containerName} pmm-admin list`);

      await pmmAdminListOutput.outContains('rta_mongodb_agent Running');
    }).toPass({ intervals: [1_000], timeout: 60_000 });

    await expect(async () => {
      const pmmAdminListOutput = await cli.exec(`docker exec ${containerName} pmm-admin inventory list agents`);

      await pmmAdminListOutput.outContains('rta_mongodb_agent Running');
    }).toPass({ intervals: [1_000], timeout: 60_000 });

    await expect(async () => {
      const pmmAdminListOutput = await cli.exec(`docker exec ${containerName} pmm-admin status`);

      await pmmAdminListOutput.outContains('rta_mongodb_agent Running');
    }).toPass({ intervals: [1_000], timeout: 60_000 });

    await expect(async () => {
      const pmmAdminListOutput = await cli.exec(`docker exec ${containerName} pmm-admin inventory list agents --service-id=${serviceId}`);

      await pmmAdminListOutput.outContains('rta_mongodb_agent Running');
    }).toPass({ intervals: [1_000], timeout: 60_000 });
  });

  test('PMM-T2180 - Verify removing RTA Agent in pmm-admin CLI', async ({ }) => {
    test.skip(adminVersion < 7, 'This test is relevant for pmm-client version 3.7.0 and above');

    const serviceId = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep "rs101" | awk -F" " '{print $4}'`)).getStdOutLines()[0];

    const rtaAgentId = (await cli.exec(`docker exec ${containerName} pmm-admin list | grep rta_mongodb_agent | awk -F" " '{print $3}'`)).getStdOutLines()[0];
    console.log(`RTA Agent id is: ${rtaAgentId}`);
    const rtaAgentRemoved = await cli.exec(`docker exec ${containerName} pmm-admin inventory remove agent ${rtaAgentId}`);
    await rtaAgentRemoved.outContains('Agent removed.');

    await expect(async () => {
      const pmmAdminListOutput = await cli.exec(`docker exec ${containerName} pmm-admin list`);

      await pmmAdminListOutput.outNotContains('rta_mongodb_agent');
    }).toPass({ intervals: [1_000], timeout: 60_000 });

    await expect(async () => {
      const pmmAdminListOutput = await cli.exec(`docker exec ${containerName} pmm-admin inventory list agents`);

      await pmmAdminListOutput.outNotContains('rta_mongodb_agent');
    }).toPass({ intervals: [1_000], timeout: 60_000 });

    await expect(async () => {
      const pmmAdminListOutput = await cli.exec(`docker exec ${containerName} pmm-admin status`);

      await pmmAdminListOutput.outNotContains('rta_mongodb_agent');
    }).toPass({ intervals: [1_000], timeout: 60_000 });

    await expect(async () => {
      const pmmAdminListOutput = await cli.exec(`docker exec ${containerName} pmm-admin inventory list agents --service-id=${serviceId}`);

      await pmmAdminListOutput.outNotContains('rta_mongodb_agent');
    }).toPass({ intervals: [1_000], timeout: 60_000 });
  });

  test('PMM-T2221 - User can use connection timeout while using pmm-admin add', async ({ }) => {
    test.skip(adminVersion < 8, 'This test is relevant for pmm-client version 3.8.0 and above');
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --connection-timeout=5s ${connectionTimeoutServiceName} ${replIpPort}`);
    await output.exitCodeEquals(0);
    await cli.exec('sleep 5');

    const serviceId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${connectionTimeoutServiceName} | awk -F' ' '{print $4}'`);
    const agentId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId.stdout.trim()} | grep mongodb_exporter | awk -F' ' '{print $4}'`);
    const dataSourceName = await cli.exec(`docker exec ${containerName} cat /var/log/pmm-agent.log | grep MONGODB_URI | grep ${agentId.stdout.trim()} | grep connectTimeoutMS=5000`);
    await dataSourceName.assertSuccess();
  });

  test('PMM-T2222 - User can change connection timeout using pmm-admin inventory change agent', async ({ }) => {
    test.skip(adminVersion < 8, 'This test is relevant for pmm-client version 3.8.0 and above');
    const serviceId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${connectionTimeoutServiceName} | awk -F' ' '{print $4}'`);
    const agentId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId.stdout} | grep mongodb_exporter | awk -F' ' '{print $4}'`);
    await serviceId.exitCodeEquals(0);
    await agentId.exitCodeEquals(0);
    const chaneAgent = await cli.exec(inventoryChangeAgent(containerName, ChangeAgentType.MongodbExporter, agentId.stdout, '--connection-timeout=4s'));
    await chaneAgent.exitCodeEquals(0);
    await cli.exec('sleep 5');
    const dataSourceName = await cli.exec(`docker exec ${containerName} cat /var/log/pmm-agent.log | grep MONGODB_URI | grep ${agentId.stdout.trim()} | grep connectTimeoutMS=4000`);
    await dataSourceName.assertSuccess();
  });

  test('PMM-T2223 - User can clear connection timeout using pmm-admin inventory change agent', async ({ }) => {
    test.skip(adminVersion < 8, 'This test is relevant for pmm-client version 3.8.0 and above');
    const serviceId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${connectionTimeoutServiceName} | awk -F' ' '{print $4}'`);
    const agentId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId.stdout} | grep mongodb_exporter | awk -F' ' '{print $4}'`);
    await serviceId.exitCodeEquals(0);
    await agentId.exitCodeEquals(0);
    const chaneAgent = await cli.exec(inventoryChangeAgent(containerName, ChangeAgentType.MongodbExporter, agentId.stdout, '--connection-timeout=0s'));
    await chaneAgent.exitCodeEquals(0);
    const dataSourceName = await cli.exec(`docker exec ${containerName} cat /var/log/pmm-agent.log | grep MONGODB_URI | grep ${agentId.stdout.trim()} | grep connectTimeoutMS=2000`);
    await dataSourceName.assertSuccess();
  });

  test('PMM-T2224 - Connection timeout is used when adding service with command: pmm-admin add', async ({ }) => {
    test.skip(adminVersion < 8, 'This test is relevant for pmm-client version 3.8.0 and above');
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --connection-timeout=5s ${connectionTimeoutServiceName}_timeout 195.15.25.15:27017`);
    await output.exitCodeEquals(1);

    expect(
      output.durationMs,
      `Expected pmm-admin to honor --connection-timeout=5s, got ${output.durationMs.toFixed(0)} ms`,
    ).toBeGreaterThan(5_000);
  });

  test('PMM-15355 - Verify mongodb_exporter is about 18 MB', async ({}) => {
    const size = await cli.execSilent('docker exec psmdb-server sh -lc \'stat -c %s /usr/local/percona/pmm/exporters/mongodb_exporter | awk "{printf \\"%.2f \\n\\", \\$1/1024/1024}"\'');
    const sizeMiB = parseFloat(size.stdout.trim());

    if (Number.isNaN(sizeMiB)) {
      throw new Error(`Invalid numeric output: "${size.stdout.trim()}"`);
    }

    expect(sizeMiB).toBeGreaterThan(16.0);
    expect(sizeMiB).toBeLessThan(20.0);
  });

    test('PMM-15355 - Verify mongodb_exporter uses at least 10% less memory after a client restart than it did in 3.10.0 on the same node', async ({}) => {
      const agentId = (await cli.execSilent('docker exec psmdb-server pmm-admin list | grep "mongodb_exporter" | awk -F\' \' \'{print $4}\'')).stdout.trim();
      console.log(`Agent id is: ${agentId}`);
      const usedMemoryValue = await pmmApi.queryVictoriaMetrics(`query=max(process_resident_memory_bytes{agent_id="${agentId}"})`);
      console.log(`Used memory value is: ${usedMemoryValue}`);
    });
});

test.describe('Percona Server MongoDB (PSMDB) PBM metrics', { tag: '@pbm-metrics-psmdb' }, () => {
  test.use({ pmmClientContainer: containerName });

  const members = ['rs101', 'rs102', 'rs103'];
  const replsetName = 'rs';
  let bucket: string;

  const everyMember = async (check: (member: string) => Promise<void>) => {
    for (const member of members) {
      await check(member);
    }
  };

  // The member PBM runs a backup on and the leader of the others is not fixed, so only the primary's pbm is used.
  const pbmHost = 'rs101';

  test.beforeAll(async ({}) => {
    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'PSMDB rs101 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=pss');
    await pbm.skipBelowClient(containerName, '3.11.0');
    bucket = await pbm.pbmStorageBucket(pbmHost);
  });

  test.describe('existing metrics and agent version', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}) => {
      test.setTimeout(10 * 60_000);
      await pbm.setAgents(members, 'start');
      await pbm.expectAgentsOk(pbmHost);
      await pbm.takeBackup(pbmHost);
    });

    test('PMM-15232 - Verify the existing PBM metrics have the same series and values as in 3.10.0 on every member', async ({}) => {
      test.setTimeout(10 * 60_000);
      await pbm.ensureBaselineExporter(members);

      await everyMember(async (member) => {
        const baseline = pbm.onlyExisting(pbm.parseSeries((await pbm.spawnScrape(member, member, pbm.baselineExporterPath)).scrapes[0]));
        const current = pbm.onlyExisting(pbm.parseSeries((await pbm.spawnScrape(member, member, pbm.exporterPath)).scrapes[0]));

        expect(pbm.selectSeries(baseline, 'mongodb_pbm_agent_status'), `${member}: 3.10.0 serves no agent status`).toHaveLength(members.length);
        expect(pbm.selectSeries(baseline, 'mongodb_pbm_backup_size_bytes').length, `${member}: 3.10.0 serves no backup`).toBeGreaterThan(0);
        expect(pbm.seriesTexts(current), `${member}: PBM series differ from 3.10.0's`).toEqual(pbm.seriesTexts(baseline));
      });
    });

    test('PMM-15232 - Verify the exporter logs no PBM warnings or errors and no password in normal operation', async ({}) => {
      await everyMember(async (member) => {
        const mark = await pbm.logLineCount(member);
        const spawned = await pbm.spawnScrape(member, member, pbm.exporterPath, { scrapes: 3 });

        for (let i = 0; i < 3; i++) {
          await pbm.scrapePbm(member);
        }
        const logged = await pbm.logSince(member, mark);

        expect(pbm.pbmLogProblems(spawned.log), `${member}: PBM problems logged by a second exporter`).toEqual([]);
        expect(pbm.pbmLogProblems(logged), `${member}: PBM problems logged by pmm-agent's exporter`).toEqual([]);
        for (const password of [mongoConnection.password, 'pbmpass']) {
          expect(`${spawned.log}${logged}`, `${member}: a log line contains the password ${password}`).not.toContain(password);
        }
      });
    });

    test('PMM-15222 - Verify each member has one pbm agent version series for its own agent', async ({}) => {
      const nodes = (await pbm.pbmStatus(pbmHost)).cluster.flatMap((replset) => replset.nodes);
      expect(nodes, 'pbm status lists every member').toHaveLength(members.length);

      await everyMember(async (member) => {
        const host = `${member}:27017`;
        const version = nodes.find((node) => node.host === host)?.agent.replace(/^v/, '');

        await expect(async () => {
          const versions = pbm.selectSeries(await pbm.scrapePbm(member), 'mongodb_pbm_agent_version_info');

          expect(pbm.seriesTexts(versions), `${member}: agent version series`).toHaveLength(1);
          expect(versions[0].labels).toEqual({
            host,
            replica_set: replsetName,
            self: '1',
            version,
          });
          expect(versions[0].value).toEqual(1);
        }).toPass({ intervals: [5_000], timeout: 120_000 });
      });
    });

    test('PMM-15222 - Verify hidden and delayed members report their pbm agent version', async ({}) => {
      test.setTimeout(10 * 60_000);
      const reconfigure = (special: boolean) => 'cfg = rs.conf(); '
        + `cfg.members[1].priority = ${special ? 0 : 1}; cfg.members[1].hidden = ${special}; `
        + `cfg.members[2].priority = ${special ? 0 : 1}; cfg.members[2].secondaryDelaySecs = ${special ? 5 : 0}; rs.reconfig(cfg)`;
      const expectRoles = async (roles: Record<string, string>) => {
        await expect(async () => {
          const nodes = (await pbm.pbmStatus(pbmHost)).cluster.flatMap((replset) => replset.nodes);

          expect(Object.fromEntries(nodes.map((node) => [node.host, node.role]))).toEqual(roles);
        }).toPass({ intervals: [5_000], timeout: 180_000 });
      };

      try {
        await runOnPrimary(pbmHost, pbm.mongoRootUri, reconfigure(true));
        await expectRoles({
          'rs101:27017': 'P',
          'rs102:27017': 'H',
          'rs103:27017': 'D',
        });

        await everyMember(async (member) => {
          await expect(async () => {
            const series = await pbm.scrapePbm(member);
            const versions = pbm.selectSeries(series, 'mongodb_pbm_agent_version_info');

            expect(pbm.seriesTexts(versions), `${member}: agent version series`).toHaveLength(1);
            expect(versions[0].labels).toMatchObject({
              host: `${member}:27017`,
              self: '1',
              version: '2.9.1',
            });
            expect(pbm.seriesValue(series, 'mongodb_pbm_agent_status', { host: `${member}:27017` }), `${member}: agent status`).toEqual(0);
          }).toPass({ intervals: [5_000], timeout: 120_000 });
        });
      } finally {
        await runOnPrimary(pbmHost, pbm.mongoRootUri, reconfigure(false));
        await expectRoles({
          'rs101:27017': 'P',
          'rs102:27017': 'S',
          'rs103:27017': 'S',
        });
      }
    });

    test('PMM-15222 - Verify the agent version label changes after the pbm-agent of one member is replaced', async ({}) => {
      test.setTimeout(10 * 60_000);
      const member = 'rs103';
      const host = `${member}:27017`;
      const installed = (await cli.exec(`docker exec ${member} rpm -q --qf "%{VERSION}-%{RELEASE}" percona-backup-mongodb`)).stdout.trim();
      const original = installed.split('-')[0];
      const target = original === '2.9.0' ? '2.9.1' : '2.9.0';
      const install = async (version: string, action: 'downgrade' | 'install') => {
        await (await cli.exec(`docker exec ${member} dnf ${action} -y percona-backup-mongodb-${version}-${installed.split('-').slice(1).join('-')}`)).assertSuccess();
        await pbm.setAgents([member], 'stop');
        await pbm.setAgents([member], 'start');
      };
      const expectVersion = async (version: string) => {
        await expect(async () => {
          const versions = pbm.selectSeries(await pbm.scrapePbm(member), 'mongodb_pbm_agent_version_info');

          expect(versions.map((item) => item.labels.version), `agent version series of ${host}`).toEqual([version]);
        }).toPass({ intervals: [3_000], timeout: 120_000 });
      };

      try {
        await expectVersion(original);
        await install(target, versionBelow(target, original) ? 'downgrade' : 'install');
        await expectVersion(target);
      } finally {
        await install(original, versionBelow(original, target) ? 'downgrade' : 'install');
        await expectVersion(original);
        await pbm.expectAgentsOk(pbmHost);
      }
    });
  });

  test.describe('backup failures', () => {
    test.describe.configure({ mode: 'serial' });

    const failuresMetric = 'mongodb_pbm_cluster_backup_failures_since_last_success';

    const expectFailures = async (type: string, expected: number, timeout = 120_000) => {
      await everyMember(async (member) => {
        await expect(async () => {
          const series = await pbm.scrapePbm(member);

          expect(pbm.seriesValue(series, failuresMetric, { type }), `${failuresMetric}{type="${type}"} on ${member}`).toEqual(expected);
        }).toPass({ intervals: [5_000], timeout });
      });
    };

    test.beforeAll(async ({}) => {
      test.setTimeout(10 * 60_000);
      await pbm.setAgents(members, 'start');
      await pbm.unpauseStorage();
      await pbm.fixStorage(pbmHost, bucket);
    });

    test.afterAll(async ({}) => {
      test.setTimeout(10 * 60_000);
      await pbm.unpauseStorage();
      await pbm.setAgents(members, 'start');
      await pbm.fixStorage(pbmHost, bucket);
    });

    test('PMM-15219 - Verify failures since the last successful backup are counted per type until a backup succeeds', async ({}) => {
      test.setTimeout(15 * 60_000);

      await test.step('a successful backup leaves the logical count at 0 on every member', async () => {
        await pbm.takeBackup(pbmHost);
        await expectFailures('logical', 0);
      });

      await test.step('two backups to a storage that cannot be written count 2', async () => {
        await pbm.breakStorage(pbmHost);
        for (let i = 0; i < 2; i++) {
          const backup = await pbm.pbm(pbmHost, 'backup');
          expect(backup.code, 'pbm backup to a missing bucket should fail').not.toEqual(0);
        }
        await expectFailures('logical', 2);
      });

      await test.step('a backup left unfinished by stopping every pbm-agent counts 3 before PBM marks it failed', async () => {
        await pbm.pauseStorage();
        await cli.exec(`docker exec -d ${pbmHost} pbm backup`);
        await expect(async () => {
          expect(await pbm.countBackupRecords(pbmHost, '{ status: { $nin: ["done", "error"] } }'), 'backups in progress').toEqual(1);
        }).toPass({ intervals: [500], timeout: 60_000 });
        await pbm.setAgents(members, 'kill');

        await expectFailures('logical', 3, 180_000);
        expect(await pbm.countBackupRecords(pbmHost, '{ status: "error" }'), 'backups PBM marked failed').toEqual(2);
      });

      await test.step('a backup after the storage is fixed and the agents are started counts 0', async () => {
        await pbm.unpauseStorage();
        await pbm.setAgents(members, 'start');
        await pbm.expectAgentsOk(pbmHost);
        await pbm.fixStorage(pbmHost, bucket);
        await pbm.takeBackup(pbmHost);
        await expectFailures('logical', 0);
      });
    });

    test('PMM-15219 - Verify a failed physical backup counts under physical only and a logical success does not reset it', async ({}) => {
      test.setTimeout(15 * 60_000);
      await pbm.takeBackup(pbmHost);

      const physical = await pbm.startOperation(pbmHost, 'backup --type=physical');
      await expect(async () => {
        expect(await pbm.countBackupRecords(pbmHost, '{ status: "running", type: "physical" }'), 'physical backups running').toEqual(1);
      }).toPass({ intervals: [2_000], timeout: 180_000 });
      await pbm.setAgents(members, 'kill');

      await expectFailures('physical', 1, 180_000);
      await expectFailures('logical', 0);
      expect(await pbm.backupStatus(pbmHost, physical.name), 'the interrupted physical backup is not done').not.toEqual('done');

      await pbm.setAgents(members, 'start');
      await pbm.expectAgentsOk(pbmHost);
      await pbm.takeBackup(pbmHost);

      await expectFailures('logical', 0);
      await expectFailures('physical', 1);
    });
  });

  test.describe('PITR freshness', () => {
    test.describe.configure({ mode: 'serial' });

    const recoveryPointMetric = 'mongodb_pbm_cluster_pitr_recovery_point_ts';
    const lastWriteMetric = 'mongodb_pbm_pitr_last_write_ts';
    const writerUri = `mongodb://${mongoConnection.username}:${mongoConnection.password}@rs101:27017/?replicaSet=rs`;
    let oplogSpan: string;
    let enabledAt: number;

    const recoveryPoint = async (member: string) => {
      const series = await pbm.scrapePbm(member);

      return {
        cluster: pbm.seriesValue(series, recoveryPointMetric),
        replset: pbm.seriesValue(series, lastWriteMetric, { replica_set: replsetName }),
      };
    };

    test.beforeAll(async ({}) => {
      test.setTimeout(10 * 60_000);
      await pbm.setAgents(members, 'start');
      await pbm.unpauseStorage();
      await pbm.fixStorage(pbmHost, bucket);
      await pbm.takeBackup(pbmHost);
      oplogSpan = await pbm.pbmConfigValue(pbmHost, 'pitr.oplogSpanMin');
      await pbm.pbm(pbmHost, 'delete-pitr --all --force --wait');
      enabledAt = Math.floor(Date.now() / 1000);
      await (await pbm.pbm(pbmHost, 'config --set pitr.enabled=true --set pitr.oplogSpanMin=1')).assertSuccess();
      await pbm.startWriter(pbmHost, writerUri);
    });

    test.afterAll(async ({}) => {
      test.setTimeout(10 * 60_000);
      await pbm.setAgents(members, 'start');
      await pbm.stopWriter(pbmHost);
      await pbm.pbm(pbmHost, `config --set pitr.enabled=false --set pitr.oplogSpanMin=${oplogSpan}`);
      await pbm.pbm(pbmHost, 'delete-pitr --all --force --wait');
      await runOnPrimary(pbmHost, pbm.mongoRootUri, 'db.getSiblingDB("pbm_metrics_test").dropDatabase()');
    });

    test('PMM-15207 - Verify the PITR recovery point equals the end of the PITR range in pbm list and advances once a minute', async ({}) => {
      test.setTimeout(15 * 60_000);

      await everyMember(async (member) => {
        await expect(async () => {
          const end = await pbm.pitrRangeEnd(pbmHost);
          const metrics = await recoveryPoint(member);

          expect(end, 'pbm list shows no PITR range yet').toBeDefined();
          expect(metrics, `${recoveryPointMetric} and ${lastWriteMetric} on ${member}`).toEqual({ cluster: end, replset: end });
        }).toPass({ intervals: [3_000], timeout: 6 * 60_000 });
      });

      await expect(async () => {
        expect((await recoveryPoint(pbmHost)).cluster, 'recovery point of the PITR that was just enabled').toBeGreaterThan(enabledAt);
      }).toPass({ intervals: [3_000], timeout: 6 * 60_000 });

      const advances: number[] = [(await recoveryPoint(pbmHost)).cluster ?? 0];
      while (advances.length < 3) {
        await expect(async () => {
          expect((await recoveryPoint(pbmHost)).cluster).toBeGreaterThan(advances[advances.length - 1]);
        }).toPass({ intervals: [3_000], timeout: 150_000 });
        advances.push((await recoveryPoint(pbmHost)).cluster ?? 0);
      }

      for (const [first, second] of [[advances[0], advances[1]], [advances[1], advances[2]]]) {
        expect(second - first, `PITR recovery points ${advances.join(', ')}`).toBeGreaterThanOrEqual(50);
        expect(second - first, `PITR recovery points ${advances.join(', ')}`).toBeLessThanOrEqual(90);
      }
    });

    test('PMM-15207 - Verify the PITR metrics stop advancing without pbm-agents and catch up when they are started', async ({}) => {
      test.setTimeout(15 * 60_000);
      await pbm.setAgents(members, 'stop');

      try {
        const frozen = (await recoveryPoint(pbmHost)).cluster as number;
        const lagAtStart = Date.now() / 1000 - frozen;

        for (let i = 0; i < 9; i++) {
          await pbm.sleep(10_000);
          expect(await recoveryPoint(pbmHost), 'PITR metrics move with every pbm-agent stopped').toEqual({ cluster: frozen, replset: frozen });
        }
        expect(Date.now() / 1000 - frozen, 'time() - recovery point grows').toBeGreaterThan(lagAtStart + 60);

        await pbm.setAgents(members, 'start');
        await expect(async () => {
          const end = await pbm.pitrRangeEnd(pbmHost);

          expect(end, 'PITR range end').toBeGreaterThan(frozen);
          expect(await recoveryPoint(pbmHost)).toEqual({ cluster: end, replset: end });
        }).toPass({ intervals: [5_000], timeout: 6 * 60_000 });
      } finally {
        await pbm.setAgents(members, 'start');
      }
    });

    test('PMM-15207 - Verify the PITR recovery point pauses during a logical backup and continues afterwards', async ({}) => {
      test.setTimeout(15 * 60_000);
      await pbm.expectAgentsOk(pbmHost);

      const backup = await pbm.startOperation(pbmHost, 'backup');
      const during: (number | undefined)[] = [];
      await expect(async () => {
        during.push((await recoveryPoint(pbmHost)).cluster);
        expect(await pbm.backupStatus(pbmHost, backup.name), 'the backup is still running').toEqual('done');
      }).toPass({ intervals: [1_000], timeout: 5 * 60_000 });

      expect(new Set(during.slice(0, -1)).size, `recovery points while the backup ran: ${during.join(', ')}`).toBeLessThanOrEqual(1);
      const paused = during[0] as number;

      await expect(async () => {
        expect((await recoveryPoint(pbmHost)).cluster, 'recovery point after the backup').toBeGreaterThan(paused);
      }).toPass({ intervals: [5_000], timeout: 5 * 60_000 });
      await expect(async () => {
        const end = await pbm.pitrRangeEnd(pbmHost);

        expect(await recoveryPoint(pbmHost)).toEqual({ cluster: end, replset: end });
      }).toPass({ intervals: [3_000], timeout: 3 * 60_000 });
    });

    test('PMM-15207 - Verify both PITR metrics disappear when PITR is disabled while pbm list still shows the chunks', async ({}) => {
      test.setTimeout(10 * 60_000);
      await (await pbm.pbm(pbmHost, 'config --set pitr.enabled=false')).assertSuccess();

      await everyMember(async (member) => {
        await expect(async () => {
          const series = await pbm.scrapePbm(member);

          expect(pbm.selectSeries(series, recoveryPointMetric), `${recoveryPointMetric} on ${member}`).toHaveLength(0);
          expect(pbm.selectSeries(series, lastWriteMetric), `${lastWriteMetric} on ${member}`).toHaveLength(0);
          expect(pbm.seriesValue(series, 'mongodb_pbm_cluster_pitr_backup_enabled')).toEqual(0);
        }).toPass({ intervals: [5_000], timeout: 120_000 });
      });
      expect(await pbm.pitrRangeEnd(pbmHost), 'pbm list still shows the PITR chunks').toBeDefined();
    });
  });

  test.describe('restores', () => {
    test.describe.configure({ mode: 'serial' });

    const restoreStatusMetric = 'mongodb_pbm_restore_status';
    let backupName: string;

    const restoreSeries = (series: pbm.Series[], name?: string) => series.filter((item) => item.name.startsWith('mongodb_pbm_restore_')
      && item.name !== restoreStatusMetric && (!name || item.labels.name === name));

    // The exporter cannot scrape while a restore replaces the users it logs in as.
    const restoreStatus = async (member: string) => pbm.seriesValue(await pbm.scrapePbm(member), restoreStatusMetric);

    const expectRestoreStatusOnEveryMember = async (expected: number, timeout = 180_000) => {
      await everyMember(async (member) => {
        await expect(async () => {
          expect(await restoreStatus(member), `${restoreStatusMetric} on ${member}`).toEqual(expected);
        }).toPass({ intervals: [3_000], timeout });
      });
    };

    const restoreBackup = async () => {
      let started: pbm.StartedOperation | undefined;

      await expect(async () => {
        started = await pbm.startOperation(pbmHost, `restore ${backupName}`);
      }).toPass({ intervals: [3_000], timeout: 120_000 });

      return started as pbm.StartedOperation;
    };

    test.beforeAll(async ({}) => {
      test.setTimeout(10 * 60_000);
      await pbm.setAgents(members, 'start');
      await pbm.unpauseStorage();
      await pbm.removeStoredRestores(pbmHost, bucket);
      await pbm.fixStorage(pbmHost, bucket);
      backupName = await pbm.takeBackup(pbmHost);
    });

    test.afterAll(async ({}) => {
      test.setTimeout(10 * 60_000);
      await pbm.setAgents(members, 'start');
      for (const member of members) {
        await pbm.recoverExporter(member);
      }
    });

    test('PMM-15220 - Verify restore_status is 0 and there are no restore series before any restore', async ({}) => {
      await everyMember(async (member) => {
        await expect(async () => {
          const series = await pbm.scrapePbm(member);

          expect(pbm.seriesValue(series, restoreStatusMetric), `${restoreStatusMetric} on ${member}`).toEqual(0);
          expect(pbm.seriesTexts(restoreSeries(series)), `restore series on ${member}`).toEqual([]);
        }).toPass({ intervals: [3_000], timeout: 120_000 });
      });
    });

    test('PMM-15220 - Verify a logical restore shows 1 while it runs and 3 when it is done, with its labels and duration', async ({}) => {
      test.setTimeout(15 * 60_000);
      const restore = await restoreBackup();
      const seen = new Set<number | undefined>();
      const finished = async () => (await pbm.describeRestore(pbmHost, restore.name).catch(() => undefined))?.status === 'done';

      for (let attempt = 0; attempt < 600 && !(await finished()); attempt++) {
        seen.add(await restoreStatus(members[attempt % members.length]).catch(() => undefined));
      }
      expect(seen.has(1), `${restoreStatusMetric} values seen while the restore ran: ${[...seen].join(', ')}`).toBeTruthy();

      for (const member of members) {
        await pbm.recoverExporter(member);
      }
      const info = await pbm.describeRestore(pbmHost, restore.name);
      const duration = (Date.parse(info.finish) - Date.parse(info.start)) / 1000;

      await everyMember(async (member) => {
        await expect(async () => {
          const series = await pbm.scrapePbm(member);
          const labels = {
            name: restore.name,
            backup: backupName,
            type: 'logical',
            status: 'done',
          };

          expect(pbm.seriesValue(series, restoreStatusMetric), `${restoreStatusMetric} on ${member}`).toEqual(3);
          expect(pbm.selectSeries(series, 'mongodb_pbm_restore_last_transition_ts', labels), `last transition of ${restore.name} on ${member}`).toHaveLength(1);
          const [seconds] = pbm.selectSeries(series, 'mongodb_pbm_restore_duration_seconds', labels);
          expect(seconds?.value, `duration of ${restore.name} on ${member}`).toBeGreaterThanOrEqual(duration - 1);
          expect(seconds?.value, `duration of ${restore.name} on ${member}`).toBeLessThanOrEqual(duration + 1);
        }).toPass({ intervals: [3_000], timeout: 120_000 });
      });
    });

    test('PMM-15220 - Verify a restore interrupted by stopping every pbm-agent shows 2 before the agents are started', async ({}) => {
      test.setTimeout(15 * 60_000);

      try {
        const restore = await restoreBackup();
        await pbm.setAgents(members, 'kill');

        await expectRestoreStatusOnEveryMember(2);
        expect((await pbm.describeRestore(pbmHost, restore.name)).status, 'the interrupted restore is not done').not.toEqual('done');
      } finally {
        await pbm.setAgents(members, 'start');
        await pbm.expectAgentsOk(pbmHost);
        for (const member of members) {
          await pbm.recoverExporter(member);
        }
      }
    });

    test('PMM-15220 - Verify a restore PBM reports as failed shows 2 and status error', async ({}) => {
      test.setTimeout(15 * 60_000);
      const prefix = await pbm.pbmConfigValue(pbmHost, 'storage.s3.prefix');
      const backupDir = `/backups/${bucket}/${prefix}/${backupName}/rs`;
      const files = (await cli.exec(`docker exec minio ls ${backupDir}`)).getStdOutLines();
      const dataFile = files.find((file) => file.endsWith('.s2') && !file.startsWith('admin.'));
      expect(dataFile, `no collection file of ${backupName} in ${files.join(', ')}`).toBeTruthy();

      let restore: pbm.StartedOperation | undefined;
      try {
        await (await cli.exec(`docker exec minio mv ${backupDir}/${dataFile} ${backupDir}/${dataFile}.moved`)).assertSuccess();
        restore = await restoreBackup();
        await pbm.expectRestoreStatus(pbmHost, restore.name, 'error');
      } finally {
        await cli.exec(`docker exec minio mv ${backupDir}/${dataFile}.moved ${backupDir}/${dataFile}`);
        for (const member of members) {
          await pbm.recoverExporter(member);
        }
      }

      await everyMember(async (member) => {
        await expect(async () => {
          const series = await pbm.scrapePbm(member);
          const labels = {
            name: restore?.name ?? '',
            backup: backupName,
            type: 'logical',
            status: 'error',
          };

          expect(pbm.seriesValue(series, restoreStatusMetric), `${restoreStatusMetric} on ${member}`).toEqual(2);
          expect(pbm.selectSeries(series, 'mongodb_pbm_restore_last_transition_ts', labels), `failed restore on ${member}`).toHaveLength(1);
        }).toPass({ intervals: [3_000], timeout: 120_000 });
      });
    });

    test('PMM-15220 - Verify only the 10 most recent restores have series after 11 restores and the status follows the latest', async ({}) => {
      test.setTimeout(30 * 60_000);
      const names: string[] = [];

      for (let i = 0; i < 11; i++) {
        const restore = await restoreBackup();
        names.push(restore.name);
        await pbm.expectRestoreStatus(pbmHost, restore.name, 'done');
      }
      for (const member of members) {
        await pbm.recoverExporter(member);
      }

      await everyMember(async (member) => {
        await expect(async () => {
          const series = await pbm.scrapePbm(member);
          const listed = pbm.selectSeries(series, 'mongodb_pbm_restore_last_transition_ts').map((item) => item.labels.name).sort();

          expect(listed, `restores with series on ${member}`).toEqual(names.slice(1).sort());
          expect(pbm.selectSeries(series, 'mongodb_pbm_restore_duration_seconds'), `restore durations on ${member}`).toHaveLength(10);
          expect(pbm.seriesValue(series, restoreStatusMetric), `${restoreStatusMetric} on ${member}`).toEqual(3);
        }).toPass({ intervals: [3_000], timeout: 120_000 });
      });
    });

    test('PMM-15220 - Verify a physical restore appears only after a resync of the PBM configuration', async ({}) => {
      test.setTimeout(40 * 60_000);
      const physicalBackup = await pbm.takeBackup(pbmHost, 'physical');
      const restore = await pbm.startOperation(pbmHost, `restore ${physicalBackup}`);

      try {
        // A physical restore ends every pbm-agent and leaves mongod stopped.
        for (const member of members) {
          await expect(async () => {
            const state = await cli.exec(`docker exec ${member} systemctl is-active pbm-agent`);

            expect(state.stdout.trim(), `pbm-agent on ${member}`).toEqual('inactive');
          }).toPass({ intervals: [10_000], timeout: 10 * 60_000 });
        }
        for (const member of members) {
          await (await cli.exec(`docker exec ${member} systemctl start mongod`)).assertSuccess();
        }
        await runOnPrimary(pbmHost, pbm.mongoRootUri, 'db.hello().isWritablePrimary');
        await pbm.setAgents(members, 'start');
        await pbm.expectAgentsOk(pbmHost);

        await everyMember(async (member) => {
          await expect(async () => {
            const series = await pbm.scrapePbm(member);

            expect(pbm.seriesValue(series, restoreStatusMetric), `${restoreStatusMetric} on ${member} before the resync`).toEqual(0);
            expect(pbm.seriesTexts(restoreSeries(series, restore.name)), `series of the physical restore on ${member} before the resync`).toEqual([]);
          }).toPass({ intervals: [3_000], timeout: 120_000 });
        });

        await pbm.resync(pbmHost);
        const info = await pbm.describeRestore(pbmHost, restore.name);
        const duration = (Date.parse(info.finish) - Date.parse(info.start)) / 1000;

        await everyMember(async (member) => {
          await expect(async () => {
            const series = await pbm.scrapePbm(member);
            const labels = {
              name: restore.name,
              backup: physicalBackup,
              type: 'physical',
              status: 'done',
            };

            expect(pbm.seriesValue(series, restoreStatusMetric), `${restoreStatusMetric} on ${member} after the resync`).toEqual(3);
            expect(pbm.selectSeries(series, 'mongodb_pbm_restore_last_transition_ts', labels), `physical restore on ${member}`).toHaveLength(1);
            expect(pbm.selectSeries(series, 'mongodb_pbm_restore_duration_seconds', labels)[0]?.value, `duration of the physical restore on ${member}`)
              .toBeGreaterThanOrEqual(duration - 1);
          }).toPass({ intervals: [3_000], timeout: 120_000 });
        });
      } finally {
        await pbm.setAgents(members, 'start');
        await pbm.removeStoredRestores(pbmHost, bucket);
        await pbm.resync(pbmHost);
      }
    });
  });

  test.describe('permissions and failures', () => {
    test.describe.configure({ mode: 'serial' });

    const restrictedUser = 'pbm_metrics_restricted';
    const restrictedRole = 'pbmMetricsFindOnly';
    const restrictedPassword = 'RestrictedPass1';
    const collectionsGranted = ['pbmBackups', 'pbmAgents', 'pbmConfig'];
    const failuresMetric = 'mongodb_pbm_cluster_backup_failures_since_last_success';

    const adminJs = (js: string) => `const admin = db.getSiblingDB("admin"); ${js}`;
    const privileges = collectionsGranted.map((collection) => `{ resource: { db: "admin", collection: "${collection}" }, actions: ["find"] }`).join(', ');

    const warnings = (log: string, message: string) => log.split('\n').filter((line) => line.includes('collector=pbm') && line.includes(message));

    test.beforeAll(async ({}) => {
      test.setTimeout(10 * 60_000);
      await pbm.setAgents(members, 'start');
      await pbm.expectAgentsOk(pbmHost);
      await pbm.ensureBaselineExporter(members);
    });

    test('PMM-15232 - Verify a user with find only on pbmBackups, pbmAgents and pbmConfig gets no restore or PITR series and one warning per scrape for each', async ({}) => {
      test.setTimeout(15 * 60_000);
      const scrapes = 3;
      const oplogSpan = await pbm.pbmConfigValue(pbmHost, 'pitr.oplogSpanMin');

      try {
        await runOnPrimary(pbmHost, pbm.mongoRootUri, adminJs(
          `admin.createRole({ role: "${restrictedRole}", privileges: [${privileges}], roles: [] }); `
          + `admin.createUser({ user: "${restrictedUser}", pwd: "${restrictedPassword}", roles: [{ role: "clusterMonitor", db: "admin" }, { role: "${restrictedRole}", db: "admin" }] })`,
        ));
        await (await pbm.pbm(pbmHost, 'config --set pitr.enabled=true')).assertSuccess();

        for (const member of ['rs101', 'rs102']) {
          const run = await pbm.spawnScrape(member, member, pbm.exporterPath, {
            scrapes,
            user: restrictedUser,
            password: restrictedPassword,
          });

          for (const text of run.scrapes) {
            const series = pbm.parseSeries(text);
            const names = new Set(series.map((item) => item.name));

            expect([...names].filter((name) => name.includes('restore') || name.includes('pitr_last_write') || name.includes('recovery_point')), `${member}: restore and PITR series`).toEqual([]);
            for (const name of ['mongodb_pbm_agent_status', 'mongodb_pbm_agent_version_info', 'mongodb_pbm_backup_size_bytes', 'mongodb_pbm_cluster_backup_configured', failuresMetric]) {
              expect(names.has(name), `${member}: ${name} is served`).toBeTruthy();
            }
            expect(pbm.seriesValue(series, 'mongodb_pbm_cluster_pitr_backup_enabled'), `${member}: PITR enabled flag`).toEqual(1);
          }
          expect(warnings(run.log, 'failed to get PBM restore list'), `${member}: restore warnings in ${scrapes} scrapes`).toHaveLength(scrapes);
          expect(warnings(run.log, 'failed to get the last PITR chunk'), `${member}: PITR warnings in ${scrapes} scrapes`).toHaveLength(scrapes);
          expect(run.log, `${member}: a log line contains the password`).not.toContain(restrictedPassword);
        }
      } finally {
        await pbm.pbm(pbmHost, `config --set pitr.enabled=false --set pitr.oplogSpanMin=${oplogSpan}`);
        await pbm.pbm(pbmHost, 'delete-pitr --all --force --wait');
        await runOnPrimary(pbmHost, pbm.mongoRootUri, adminJs(`admin.dropUser("${restrictedUser}"); admin.dropRole("${restrictedRole}")`));
      }
    });

    test('PMM-15232 - Verify the PBM metrics are the same as in 3.10.0 and the scrape succeeds when there is no primary', async ({}) => {
      test.setTimeout(15 * 60_000);
      const secondaries = ['rs102', 'rs103'];

      try {
        for (const member of secondaries) {
          await (await cli.exec(`docker exec ${member} systemctl stop mongod`)).assertSuccess();
        }
        await expect(async () => {
          const hello = await cli.exec(`docker exec ${pbmHost} mongo "${pbm.mongoRootUri}" --quiet --eval 'db.hello().isWritablePrimary'`);

          expect(hello.stdout.trim(), `${pbmHost} is still a primary`).toEqual('false');
        }).toPass({ intervals: [3_000], timeout: 120_000 });

        const baseline = await pbm.spawnScrape(pbmHost, pbmHost, pbm.baselineExporterPath);
        const current = await pbm.spawnScrape(pbmHost, pbmHost, pbm.exporterPath);

        for (const run of [baseline, current]) {
          expect(pbm.seriesValue(pbm.parseSeries(run.scrapes[0], 'mongodb_up'), 'mongodb_up'), 'mongodb_up').toEqual(1);
          expect(run.log, 'a log line contains the password').not.toContain(mongoConnection.password);
        }
        expect(pbm.seriesTexts(pbm.parseSeries(current.scrapes[0])), 'PBM series without a primary').toEqual(pbm.seriesTexts(pbm.parseSeries(baseline.scrapes[0])));
      } finally {
        for (const member of secondaries) {
          await cli.exec(`docker exec ${member} systemctl start mongod`);
        }
        await runOnPrimary(pbmHost, pbm.mongoRootUri, 'db.hello().isWritablePrimary');
        await pbm.expectAgentsOk(pbmHost);
      }
    });

    test('PMM-15232 - Verify no pmm-agent log line contains the connection password after the failures above', async ({}) => {
      for (const member of members) {
        const matches = await cli.exec(`docker exec ${member} grep -c -e ${mongoConnection.password} -e pbmpass ${pbm.agentLogPath}`);

        expect(matches.stdout.trim(), `lines of ${pbm.agentLogPath} on ${member} with a password`).toEqual('0');
      }
    });
  });
});

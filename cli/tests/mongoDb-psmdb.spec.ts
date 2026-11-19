import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import { expectMongoUp } from '@helpers/mongo';
import { ChangeAgentType, addMongoServiceAndGetExporterId, getPmmAdminMinorVersion, inventoryChangeAgent, removeMongoService } from '@root/helpers/pmm-admin';
import { clientCredentialsFlags } from '@helpers/constants';
import { faker } from '@faker-js/faker';

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

  test.describe('mongodb_exporter binary size and memory against 3.10.0', { tag: '@exporter-footprint' }, () => {
    const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });
    const mb = (bytes: number) => (bytes / megabyte).toFixed(1);
    const mib = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

    const fileSize = async (path: string) => {
      const output = await cli.exec(`docker exec ${exporterContainer} stat -c %s ${path}`);
      await output.assertSuccess();

      return Number(output.stdout.trim());
    };

    // The version gate runs after beforeAll hooks, so the download happens here and a skipped run never makes it.
    // A failed test restarts the worker, so the download is kept.
    const prepareBaselineExporter = async () => {
      const cached = await cli.exec(`docker exec ${exporterContainer} test -s ${baselineExporter}`);

      if (cached.code !== 0) {
        const download = await cli.exec(
          `docker exec ${exporterContainer} sh -c 'curl -fsSL --retry 3 --connect-timeout 30 `
          + `https://downloads.percona.com/downloads/pmm3/${baselineVersion}/binary/tarball/pmm-client-${baselineVersion}-$(uname -m).tar.gz `
          + `| tar -xzO --wildcards "*/bin/mongodb_exporter" > ${baselineExporter}.part && chmod 0755 ${baselineExporter}.part && mv ${baselineExporter}.part ${baselineExporter}'`,
        );
        await download.assertSuccess();
      }

      const size = await fileSize(baselineExporter);
      expect(size, `The ${baselineVersion} mongodb_exporter was not extracted`).toBeGreaterThan(0);

      return size;
    };

    const restartAgentAndWaitForExporter = async () => {
      await (await cli.exec(`docker exec ${exporterContainer} systemctl restart pmm-agent`)).assertSuccess();
      await expectMongoUp(exporterContainer, exporterContainer, agentPassword);
    };

    // One scrape of the exporter itself: through PMM Server the _hr and _lr jobs would report the same process twice.
    const exporterRss = async () => {
      const metrics = await cli.getMetrics(exporterContainer, 'pmm', agentPassword, exporterContainer);
      const value = metrics.match(/^process_resident_memory_bytes\s+(\S+)$/m)?.[1];
      expect(value, 'process_resident_memory_bytes is missing from the mongodb_exporter metrics').toBeTruthy();

      return Number(value);
    };

    const settledExporterRss = async () => {
      await restartAgentAndWaitForExporter();
      await sleep(30_000);
      const samples: number[] = [];

      for (let i = 0; i < 3; i++) {
        samples.push(await exporterRss());
        await sleep(10_000);
      }

      return samples.sort((a, b) => a - b)[1];
    };

    const restoreExporterUnderTest = async () => {
      const backedUp = await cli.exec(`docker exec ${exporterContainer} test -f ${currentExporterBackup}`);

      if (backedUp.code === 0) {
        await cli.exec(`docker exec ${exporterContainer} sh -c 'systemctl stop pmm-agent; install -m 0755 ${currentExporterBackup} ${exporterPath} && rm -f ${currentExporterBackup}; systemctl start pmm-agent'`);
        await expectMongoUp(exporterContainer, exporterContainer, agentPassword);
      }
    };

    test.afterAll(async () => {
      test.setTimeout(5 * 60_000);
      await restoreExporterUnderTest();
    });

    test('PMM-15355 - Verify mongodb_exporter is about 18 MB', async ({}) => {
      const size = await fileSize(exporterPath);
      const message = `${exporterPath} is ${mb(size)} MB, expected about 18 MB`;

      expect(size, message).toBeGreaterThan(14 * megabyte);
      expect(size, message).toBeLessThan(22 * megabyte);
    });

    test('PMM-15355 - Verify mongodb_exporter uses at least 10% less memory after a client restart than it did in 3.10.0 on the same node', async ({}) => {
      test.setTimeout(10 * 60_000);
      await prepareBaselineExporter();

      await (await cli.exec(`docker exec ${exporterContainer} cp -p ${exporterPath} ${currentExporterBackup}`)).assertSuccess();
      const currentRss = await settledExporterRss();

      await (await cli.exec(
        `docker exec ${exporterContainer} sh -c 'systemctl stop pmm-agent && install -m 0755 ${baselineExporter} ${exporterPath}'`,
      )).assertSuccess();
      const baselineRss = await settledExporterRss();

      await restoreExporterUnderTest();

      const summary = `${mib(currentRss)} MiB, ${baselineVersion}: ${mib(baselineRss)} MiB`;
      console.log(`mongodb_exporter RSS: ${summary}`);
      test.info().annotations.push({ type: 'mongodb_exporter RSS', description: summary });
      expect(
        currentRss,
        `mongodb_exporter RSS is ${mib(currentRss)} MiB after a restart, ${baselineVersion}'s is ${mib(baselineRss)} MiB`,
      ).toBeLessThan(baselineRss * requiredMemoryRatio);
    });
  });
});

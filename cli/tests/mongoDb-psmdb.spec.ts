import { test, expect } from '@playwright/test';
import * as cli from '@helpers/cli-helper';
import { getPmmAdminMinorVersion, removeMongoService } from '@root/helpers/pmm-admin';
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
const connectionTimeoutServiceName = 'mongo_connection_timeout_service';

test.describe('Percona Server MongoDB (PSMDB) CLI tests', { tag: '@psmdb' }, async () => {
  test.beforeAll(async ({}) => {
    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'PSMDB rs101 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=pss');
    adminVersion = await getPmmAdminMinorVersion(containerName);
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
    test.skip(adminVersion < 6, 'This test is relevant for pmm-client version 3.6.0 and above');

    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --agent-env-vars="TEST=123" --service-name=test`);
    await output.exitCodeEquals(1);
    await output.outContains('invalid environment variable name: TEST=123 (must match [A-Z_][A-Z0-9_]*)');
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

  test("PMM-T2221 - User can use connection timeout while using pmm-admin add", async ({ }) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --connection-timeout=5s ${connectionTimeoutServiceName} ${replIpPort}`);
    await output.exitCodeEquals(0);
    await cli.exec('sleep 5');

    const serviceId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${connectionTimeoutServiceName} | awk -F' ' '{print $4}'`);
    const agentId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId.stdout.trim()} | grep mongodb_exporter | awk -F' ' '{print $4}'`)
    const dataSourceName = await cli.exec(`docker exec ${containerName} cat /var/log/pmm-agent.log | grep MONGODB_URI | grep ${agentId.stdout.trim()} | grep connectTimeoutMS=5000`);
    await dataSourceName.assertSuccess();
  });

  test("PMM-T2222 - User can change connection timeout using pmm-admin inventory change agent", async ({ }) => {
    const serviceId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${connectionTimeoutServiceName} | awk -F' ' '{print $4}'`);
    const agentId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId.stdout} | grep mongodb_exporter | awk -F' ' '{print $4}'`)
    await serviceId.exitCodeEquals(0);
    await agentId.exitCodeEquals(0);
    const chaneAgent = await cli.exec(`docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${agentId.stdout} --connection-timeout=4s`);
    await chaneAgent.exitCodeEquals(0);
    const dataSourceName = await cli.exec(`docker exec ${containerName} cat /var/log/pmm-agent.log | grep MONGODB_URI | grep ${agentId.stdout.trim()} | grep connectTimeoutMS=4000`);
    await dataSourceName.assertSuccess();
  });

  test("PMM-T2223 - User can clear connection timeout using pmm-admin inventory change agent", async ({ }) => {
    const serviceId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${connectionTimeoutServiceName} | awk -F' ' '{print $4}'`);
    const agentId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId.stdout} | grep mongodb_exporter | awk -F' ' '{print $4}'`)
    await serviceId.exitCodeEquals(0);
    await agentId.exitCodeEquals(0);
    const chaneAgent = await cli.exec(`docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${agentId.stdout} --connection-timeout=0s`);
    await chaneAgent.exitCodeEquals(0);
    const dataSourceName = await cli.exec(`docker exec ${containerName} cat /var/log/pmm-agent.log | grep MONGODB_URI | grep ${agentId.stdout.trim()} | grep connectTimeoutMS=2000`);
    await dataSourceName.assertSuccess();
  });

  test("PMM-T2224 - Connection timeout is used when adding service with command: pmm-admin add", async ({ }) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --connection-timeout=5s ${connectionTimeoutServiceName}_timeout 195.15.25.15:27017`);
    await output.exitCodeEquals(1)

    expect(
      output.durationMs,
      `Expected pmm-admin to honor --connection-timeout=5s, got ${output.durationMs.toFixed(0)} ms`,
    ).toBeGreaterThan(5_000);
  });
});

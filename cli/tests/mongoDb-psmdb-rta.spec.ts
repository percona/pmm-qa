import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import { getPmmAdminMinorVersion } from '@helpers/pmm-admin';
import { mongoConnection } from '@helpers/constants';

const containerName = 'rs101';
const { username, password } = mongoConnection;
let serviceId: string;
let pmmAgentId: string;
let mongoExporterId: string;
let rtaAgentId: string;
let changeRtaAgent: string;

const getAgentIds = async (filter: string, column: number) => {
  const output = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${filter} | awk '{print $${column}}'`);
  await output.assertSuccess();

  return output.getStdOutLines();
};

interface RtaAgent {
  agent_id: string;
  custom_labels?: Record<string, string>;
  log_level?: string;
  rta_options?: { collect_interval?: string };
}

const parseRtaAgent = (stdout: string) => (JSON.parse(stdout) as { rta_mongodb_agent: RtaAgent }).rta_mongodb_agent;

const getRtaAgent = async () => {
  const output = await cli.exec(`${changeRtaAgent} --json`);
  await output.assertSuccess();

  return parseRtaAgent(output.stdout);
};

const expectRtaAgentStatus = async (status: string, timeout = 60_000) => {
  await expect(async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin list | grep rta_mongodb_agent | grep ${rtaAgentId}`);
    await output.assertSuccess();
    await output.outContains(status);
  }).toPass({ intervals: [5_000], timeout });
};

test.describe('Real-Time Analytics MongoDB agent: pmm-admin inventory change agent', { tag: '@rta-psmdb' }, () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ pmmClientContainer: containerName });

  test.beforeAll(async ({}) => {
    const containers = await cli.exec(`docker ps --format '{{.Names}}' | grep -x ${containerName}`);
    await containers.outContains(containerName, 'PSMDB rs101 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=pss');
    test.skip(await getPmmAdminMinorVersion(containerName) < 9, 'This suite is relevant for pmm-client version 3.9.0 and above');

    [serviceId] = await getAgentIds(`"MongoDB.*${containerName}"`, 4);
    [pmmAgentId] = await getAgentIds('pmm_agent', 3);
    [mongoExporterId] = await getAgentIds(`"mongodb_exporter.*${serviceId}"`, 4);

    // pmm-framework does not register RTA, so add the agent here. Take its ID from the add output: a service
    // can hold more than one RTA agent, and grepping pmm-admin list would return all of them.
    const output = await cli.exec(`docker exec ${containerName} pmm-admin inventory add agent rta-mongodb-agent ${pmmAgentId} ${serviceId} ${username} --password=${password}`);
    await output.assertSuccess();
    rtaAgentId = output.stdout.match(/^Agent ID\s*:\s*(\S+)/m)?.[1] ?? '';
    expect(rtaAgentId, `RTA agent ID not found in: ${output.stdout}`).toBeTruthy();
    changeRtaAgent = `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId}`;
  });

  test('PMM-T2311 - Verify RTA Change agent username and password', async ({}) => {
    let output = await cli.exec(`${changeRtaAgent} --username=${username} --password=wrong_${password}`);
    expect(output.code, 'Wrong password should be rejected').not.toEqual(0);
    expect(`${output.stdout}${output.stderr.text}`).toContain('Authentication failed');

    output = await cli.exec(`${changeRtaAgent} --username=${username} --password=${password}`);
    await output.assertSuccess();
    await output.outContainsMany(['- updated username', '- updated password']);
  });

  test('PMM-T2312 - Verify RTA Change agent custom labels', async ({}) => {
    const customLabels = { env: 'qa_testing_rta_agent' };

    const output = await cli.exec(`${changeRtaAgent} --custom-labels=env=${customLabels.env}`);
    await output.assertSuccess();
    await output.outContains('- updated custom labels');

    expect((await getRtaAgent()).custom_labels, 'Custom labels were not persisted on the rta_mongodb_agent').toEqual(customLabels);
  });

  test('PMM-T2313 - Verify RTA Change agent log level', async ({}) => {
    const output = await cli.exec(`${changeRtaAgent} --log-level=debug`);
    await output.assertSuccess();
    await output.outContains('- changed log level to debug');

    expect((await getRtaAgent()).log_level, 'Log level was not persisted on the rta_mongodb_agent').toEqual('LOG_LEVEL_DEBUG');
  });

  test('PMM-T2314 - Verify RTA Change agent debug, trace and json', async ({}) => {
    const output = await cli.exec(`${changeRtaAgent} --debug --trace --json`);
    await output.assertSuccess();
    expect(parseRtaAgent(output.stdout).agent_id).toEqual(rtaAgentId);
  });

  test('PMM-T2315 - Verify RTA Change agent enable true/false', async ({}) => {
    const enableCommands = [
      {
        flag: '--enable=false', response: '- disabled agent', status: 'Done (disabled)',
      },
      {
        flag: '--enable=true', response: '- enabled agent', status: 'Running',
      },
      {
        flag: '--enable=false', response: '- disabled agent', status: 'Done (disabled)',
      },
      {
        flag: '--enable', response: '- enabled agent', status: 'Running',
      },
    ];

    for (const { flag, response, status } of enableCommands) {
      const output = await cli.exec(`${changeRtaAgent} ${flag}`);
      await output.assertSuccess();
      await output.outContains(response);
      await expectRtaAgentStatus(status);
    }
  });

  test('PMM-T2316 - Verify RTA Change agent collect interval', async ({}) => {
    const collectInterval = '5s';

    const output = await cli.exec(`${changeRtaAgent} --collect-interval=${collectInterval}`);
    await output.assertSuccess();
    await output.outContains(`- changed collect interval to ${collectInterval}`);

    expect((await getRtaAgent()).rta_options?.collect_interval, 'Collect interval was not persisted on the rta_mongodb_agent').toEqual(collectInterval);
  });

  test('PMM-T2317 - Verify RTA Change agent skip connection check', async ({}) => {
    let output = await cli.exec(`${changeRtaAgent} --password=invalid_skip_check_password --skip-connection-check`);
    await output.assertSuccess();
    await output.outContains('agent configuration updated.');

    output = await cli.exec(`${changeRtaAgent} --username=${username} --password=${password}`);
    await output.assertSuccess();
  });

  test('PMM-T99103 - Verify RTA Change agent server url and server insecure tls', async ({}) => {
    const serverUrl = `https://admin:${process.env.ADMIN_PASSWORD || 'admin'}@pmm-server:8443/`;

    let output = await cli.exec(`${changeRtaAgent} --server-url=${serverUrl}`);
    expect(`${output.stdout}${output.stderr.text}`).toContain('tls: failed to verify certificate:');

    output = await cli.exec(`${changeRtaAgent} --server-url=${serverUrl} --server-insecure-tls`);
    await output.assertSuccess();
    await output.outContains('agent configuration updated.');
  });

  test('PMM-T2318 - Verify RTA Change agent tls', async ({}) => {
    const exec = `docker exec ${containerName}`;
    const pki = '/easy-rsa/easyrsa3/pki';

    await cli.createTlsCertificates(containerName);

    for (const command of [
      `${exec} bash -c "cat ${pki}/issued/${containerName}.crt ${pki}/private/${containerName}.key > /certs/server.pem"`,
      `${exec} bash -c "cat ${pki}/issued/pmm-test.crt ${pki}/private/pmm-test.key > /certs/client.pem"`,
      `${exec} cp ${pki}/ca.crt /certs/ca-certs.pem`,
      `${exec} chown mongod:mongod /certs/server.pem /certs/ca-certs.pem`,
      `${exec} chmod 600 /certs/server.pem`,
      `${exec} chmod 644 /certs/ca-certs.pem`,
      `${exec} sed -i '/bindIp: 0.0.0.0/a\\  tls:\\n    mode: requireTLS\\n    certificateKeyFile: /certs/server.pem\\n    CAFile: /certs/ca-certs.pem' /etc/mongod/mongod.conf`,
      `${exec} systemctl restart mongod`,
    ]) {
      await (await cli.exec(command)).assertSuccess();
    }

    // mongod is Type=simple, so `systemctl restart` returns before mongod has validated the TLS config.
    await expect(async () => {
      const probe = await cli.exec(`${exec} mongo --tls --host localhost --port 27017 --tlsCAFile /certs/ca-certs.pem --tlsCertificateKeyFile /certs/client.pem --tlsAllowInvalidCertificates --quiet --eval 'db.hello()'`);
      const journal = probe.code === 0 ? '' : (await cli.exec(`${exec} journalctl -u mongod --no-pager -n 20`)).stdout;
      expect(probe.code, `mongod is not serving TLS after restart. mongod journal:\n${journal}`).toEqual(0);
    }).toPass({ intervals: [5_000], timeout: 120_000 });

    // The client key is unencrypted, so the driver ignores --tls-certificate-key-file-password. requireTLS cuts the
    // restarted rs101 off from its replica set, so the connection check can briefly reject auth; the change only
    // persists on success, so retrying it is safe.
    await expect(async () => {
      const output = await cli.exec(`${changeRtaAgent} --tls-certificate-key-file=/certs/client.pem --tls-certificate-key-file-password=client_key_password --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify`);
      await output.assertSuccess();
      await output.outContains('- updated TLS certificate key password');
    }).toPass({ intervals: [5_000], timeout: 120_000 });

    // The exporter and profiler on rs101 stay non-TLS and the service reports Down, so check the RTA agent only.
    await expectRtaAgentStatus('Running', 300_000);

    // The test server may not advertise the pinned SASL mechanism, so check the flag without a handshake and reset it.
    const authMechanism = 'SCRAM-SHA-256';
    let output = await cli.exec(`${changeRtaAgent} --authentication-mechanism=${authMechanism} --skip-connection-check`);
    await output.assertSuccess();
    await output.outContains(`- changed authentication mechanism to ${authMechanism}`);

    output = await cli.exec(`${changeRtaAgent} --authentication-mechanism= --skip-connection-check`);
    await output.assertSuccess();
  });

  test('PMM-T1011 - Verify RTA Change agent pmm agent listen port', async ({}) => {
    for (const command of [
      `docker exec ${containerName} sed -i 's/listen-port: 7777/listen-port: 7778/' /usr/local/percona/pmm/config/pmm-agent.yaml`,
      `docker restart ${containerName}`,
      `docker exec -d ${containerName} pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml`,
    ]) {
      await (await cli.exec(command)).assertSuccess();
    }

    await expect(async () => {
      await (await cli.exec(`docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --pmm-agent-listen-port=7778`)).assertSuccess();
    }).toPass({ intervals: [2_000], timeout: 60_000 });
    await (await cli.exec(`${changeRtaAgent} --pmm-agent-listen-port=7778`)).assertSuccess();
  });
});

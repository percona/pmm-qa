import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import ExecReturn from '@support/types/exec-return.class';
import { getPmmAdminVersion, removeMongoService } from '@helpers/pmm-admin';
import { clientCredentialsFlags, gssapi } from '@helpers/constants';
import { versionBelow } from '@helpers/versionGates';

const containerName = 'rs101';
const replIpPort = 'rs101:27017';
const serviceName = 'mongo_change_agent_service';
const newUsername = 'new_pmm_username';
const newPassword = 'new_pmm_user_password';
const changedAgentPassword = 'newAgentPassword';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
const mongoUri = 'mongodb://root:root@localhost:27017/?authSource=admin&directConnection=true';
const pmmAgentConfig = '/usr/local/percona/pmm/config/pmm-agent.yaml';
const mongodSysconfigBackup = '/tmp/mongod.sysconfig.orig';
const tlsProbe = `docker exec ${containerName} mongo --tls --host localhost --port 27017 --tlsCAFile /certs/ca-certs.pem --tlsCertificateKeyFile /certs/client.pem --tlsAllowInvalidCertificates --quiet --eval 'db.hello()'`;
const plainProbe = `docker exec ${containerName} mongo "${mongoUri}" --quiet --eval 'db.hello()'`;

interface ListAgent {
  agent_id: string;
  agent_type: string;
  service_id: string;
  port?: number;
}

let adminVersion: string;
let exporterId: string;
let profilerId: string;
let agentPassword = 'mypass';
let mongodTlsEnabled = false;
let pmmAgentListenPortChanged = false;

const mongoEval = (js: string) => `docker exec ${containerName} mongo "${mongoUri}" --quiet --eval '${js}'`;
const changeExporter = (flags: string) => `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${exporterId} ${flags}`;
const changeProfiler = (flags: string) => `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${profilerId} ${flags}`;
const changeBoth = (flags: string) => [changeExporter(flags), changeProfiler(flags)];

const expectFailure = async (output: ExecReturn, message: string) => {
  expect(output.code, `"${output.command}" should fail`).not.toEqual(0);
  expect(`${output.stdout}${output.stderr.text}`).toContain(message);
};

const getServerAgent = async (agentId: string) => {
  const output = await cli.exec(`docker exec pmm-server curl -sSf -u admin:${adminPassword} http://127.0.0.1:8080/v1/inventory/agents/${agentId}`);
  await output.assertSuccess();
  const response = JSON.parse(output.stdout) as Record<string, Record<string, unknown> | undefined>;

  return response.mongodb_exporter ?? response.qan_mongodb_profiler_agent ?? {};
};

const listAgents = async () => {
  return (JSON.parse((await cli.exec(`docker exec ${containerName} pmm-admin list --json`)).stdout) as { agent: ListAgent[] }).agent;
};

const getExporterPort = async () => (await listAgents()).find((agent) => agent.agent_id === exporterId)?.port;

const expectAgentsStatus = async (status: string, timeout = 60_000) => {
  await expect(async () => {
    const lines = (await cli.exec(`docker exec ${containerName} pmm-admin list`)).getStdOutLines();

    for (const agentId of [exporterId, profilerId]) {
      expect(lines.find((line) => line.includes(agentId)), `Agent ${agentId} should be "${status}"`).toContain(status);
    }
  }).toPass({ intervals: [5_000], timeout });
};

const expectMongoUp = async (timeout = 120_000) => {
  await expect(async () => {
    const metrics = await cli.getMetrics(serviceName, 'pmm', agentPassword, containerName);

    expect(metrics).toMatch(/^mongodb_up(\{[^}]*\})? 1$/m);
  }).toPass({ intervals: [5_000], timeout });
};

const waitForMongod = async (probe: string) => {
  await expect(async () => {
    const output = await cli.exec(probe);
    const journal = output.code === 0 ? '' : (await cli.exec(`docker exec ${containerName} journalctl -u mongod --no-pager -n 20`)).stdout;

    expect(output.code, `mongod is not serving. mongod journal:\n${journal}`).toEqual(0);
  }).toPass({ intervals: [5_000], timeout: 120_000 });
};

// User management must run on the primary. Talk to rs101 (the priority-2 primary) directly: from inside the container
// replica-set discovery resolves the primary to loopback, and an election makes mongosh fail with ECONNREFUSED.
const runOnPrimary = async (js: string) => {
  await expect(async () => {
    await (await cli.exec(mongoEval(`if (!db.hello().isWritablePrimary) throw new Error("rs101 is not primary yet"); ${js}`))).assertSuccess();
  }).toPass({ intervals: [5_000], timeout: 120_000 });
};

const dropNewUser = `if (db.getSiblingDB("admin").getUser("${newUsername}")) db.getSiblingDB("admin").dropUser("${newUsername}");`;

test.describe('PSMDB pmm-admin inventory change agent for mongodb_exporter and QAN profiler agent', { tag: '@psmdb' }, () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ pmmClientContainer: containerName });

  test.beforeAll(async ({}) => {
    test.skip(gssapi.enabled === 'true', 'Changes the agents to SCRAM users and TLS, which the GSSAPI setup does not use');

    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'PSMDB rs101 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=pss');
    adminVersion = await getPmmAdminVersion(containerName);
    test.skip(versionBelow(adminVersion, '3.7.0'), 'pmm-admin inventory change agent requires pmm-client 3.7.0+');

    await (await cli.exec(`docker exec ${containerName} pmm-admin remove mongodb ${serviceName} || true`)).assertSuccess();
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --query-source=profiler --agent-password=${agentPassword} ${serviceName} ${replIpPort}`);
    await output.assertSuccess();
    const serviceId = output.stdout.match(/Service ID\s*:\s*(\S+)/)?.[1];
    expect(serviceId, `Service ID not found in: ${output.stdout}`).toBeTruthy();

    const agents = await listAgents();
    const agentOfType = (type: string) => agents.find((agent) => agent.agent_type === type && agent.service_id === serviceId)?.agent_id ?? '';
    exporterId = agentOfType('AGENT_TYPE_MONGODB_EXPORTER');
    profilerId = agentOfType('AGENT_TYPE_QAN_MONGODB_PROFILER_AGENT');
    expect(exporterId, `mongodb_exporter for service ${serviceId} not found`).toBeTruthy();
    expect(profilerId, `mongodb_profiler_agent for service ${serviceId} not found`).toBeTruthy();
  });

  test.afterAll(async ({}) => {
    if (pmmAgentListenPortChanged) {
      await (await cli.exec(`docker exec ${containerName} sed -i 's/listen-port: 7778/listen-port: 7777/' ${pmmAgentConfig}`)).assertSuccess();
      await (await cli.exec(`docker exec ${containerName} systemctl restart pmm-agent`)).assertSuccess();
      await expect(async () => {
        await (await cli.exec(`docker exec ${containerName} pmm-admin status`)).assertSuccess();
      }).toPass({ intervals: [2_000], timeout: 60_000 });
    }

    if (mongodTlsEnabled) {
      await (await cli.exec(`docker exec ${containerName} cp ${mongodSysconfigBackup} /etc/sysconfig/mongod`)).assertSuccess();
      await (await cli.exec(`docker exec ${containerName} systemctl restart mongod`)).assertSuccess();
      await waitForMongod(plainProbe);
    }

    if (exporterId) {
      await removeMongoService(containerName, serviceName);
      await runOnPrimary(dropNewUser);
    }
  });

  test('PMM-T1001 - Verify Change agent username and password', async ({}) => {
    const monitoringRoles = '[ { role: "explainRole", db: "admin" }, { role: "clusterMonitor", db: "admin" }, { role: "read", db: "local" } ]';

    await runOnPrimary(`${dropNewUser} db.getSiblingDB("admin").createUser({ user: "${newUsername}", pwd: "${newPassword}-wrong", roles: ${monitoringRoles} })`);

    for (const command of changeBoth(`--username=${newUsername} --password=${newPassword}`)) {
      await expectFailure(await cli.exec(command), 'Authentication failed');
    }

    await runOnPrimary(`db.getSiblingDB("admin").changeUserPassword("${newUsername}", "${newPassword}")`);

    for (const command of changeBoth(`--username=${newUsername} --password=${newPassword}`)) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContainsMany(['- updated username', '- updated password']);
    }

    await expectAgentsStatus('Running');
    await expectMongoUp();
  });

  test('PMM-T1002 - Verify Change agent custom labels', async ({}) => {
    const customLabel = { key: 'env', value: 'qa_testing_mongodb' };

    for (const command of changeBoth(`--custom-labels=${customLabel.key}=${customLabel.value}`)) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains(`Custom labels : ${customLabel.key}=${customLabel.value}`);
      await output.outContains('- updated custom labels');
    }

    for (const agentId of [exporterId, profilerId]) {
      expect((await getServerAgent(agentId)).custom_labels, `Custom labels were not persisted on ${agentId}`)
        .toEqual({ [customLabel.key]: customLabel.value });
    }
  });

  test('PMM-T1003 - Verify Change agent log level', async ({}) => {
    for (const command of changeBoth('--log-level=debug')) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains('Log level : debug');
      await output.outContains('- changed log level to debug');
    }

    for (const agentId of [exporterId, profilerId]) {
      expect((await getServerAgent(agentId)).log_level, `Log level was not persisted on ${agentId}`).toEqual('LOG_LEVEL_DEBUG');
    }
  });

  test('PMM-T1004 - Verify Change agent debug, trace and json', async ({}) => {
    for (const [command, agentId] of [[changeExporter('--debug --trace --json'), exporterId], [changeProfiler('--debug --trace --json'), profilerId]]) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains(agentId);
    }
  });

  test('PMM-T1005 - Verify Change agent enable true/false', async ({}) => {
    const disable = { response: '- disabled agent', status: 'Done (disabled)' };
    const enable = { response: '- enabled agent', status: 'Running' };
    const enableCommands = [
      { flag: '--enable=false', ...disable },
      { flag: '--enable=true', ...enable },
      { flag: '--enable=false', ...disable },
      { flag: '--enable', ...enable },
    ];

    for (const { flag, response, status } of enableCommands) {
      for (const command of changeBoth(flag)) {
        const output = await cli.exec(command);
        await output.assertSuccess();
        await output.outContains(response);
      }

      await expectAgentsStatus(status);
    }
  });

  test('PMM-T1006 - Verify Change agent agent password', async ({}) => {
    const output = await cli.exec(changeExporter(`--agent-password=${changedAgentPassword}`));
    await output.assertSuccess();
    await output.outContains('- updated agent password');
    agentPassword = changedAgentPassword;

    await expectMongoUp();
  });

  test('PMM-T1007 - Verify Change agent expose exporter', async ({}) => {
    const output = await cli.exec(changeExporter('--expose-exporter'));
    await output.assertSuccess();
    await output.outContains('- enabled expose exporter');

    await expect(async () => {
      const metrics = await cli.exec(`docker exec pmm-server curl -sS -u pmm:${agentPassword} http://${containerName}:${await getExporterPort()}/metrics`);
      await metrics.assertSuccess();
      await metrics.outContains('mongodb_up');
    }).toPass({ intervals: [5_000], timeout: 90_000 });
  });

  test('PMM-T1008 - Verify Change agent push metrics', async ({}) => {
    const output = await cli.exec(changeExporter('--push-metrics'));
    await output.assertSuccess();
    await output.outContains('- enabled push metrics');

    await expect(async () => {
      const metrics = await cli.exec(`docker exec pmm-server curl -sS -u pmm:${agentPassword} http://${containerName}:${await getExporterPort()}/metrics`);
      await metrics.assertSuccess();
      await metrics.outContains('mongodb_up');
      const exporterLine = (await cli.exec(`docker exec ${containerName} pmm-admin list`)).getStdOutLines().find((line) => line.includes(exporterId));
      expect(exporterLine).toContain('Running');
      expect(exporterLine).toContain('push');
    }).toPass({ intervals: [5_000], timeout: 60_000 });

    await (await cli.exec(`docker exec ${containerName} sh -c 'grep vmagent /var/log/pmm-agent.log | tail -20 | grep -i error || true'`)).outEquals('');
  });

  test('PMM-T1009 - Verify Change agent disable collectors', async ({}) => {
    const collectorsToDisable = ['diagnosticdata', 'replicasetstatus'];

    const output = await cli.exec(changeExporter(`--disable-collectors=${collectorsToDisable.join(',')}`));
    await output.assertSuccess();
    await output.outContains(`- updated disabled collectors: [${collectorsToDisable.join(' ')}]`);

    expect((await getServerAgent(exporterId)).disabled_collectors, 'Disabled collectors were not persisted on the mongodb_exporter agent')
      .toEqual(collectorsToDisable);
  });

  test('PMM-T1015 - Verify Change agent max query length', async ({}) => {
    const maxQueryLength = 2_048;

    const output = await cli.exec(changeProfiler(`--max-query-length=${maxQueryLength}`));
    await output.assertSuccess();
    await output.outContains(`- changed max query length to ${maxQueryLength}`);

    expect((await getServerAgent(profilerId)).max_query_length, 'Max query length was not persisted on the qan-mongodb-profiler-agent')
      .toEqual(maxQueryLength);
  });

  test('PMM-T2307 - Verify Change agent stats collections', async ({}) => {
    const statsCollections = ['db1.col1', 'db2.col2'];

    const output = await cli.exec(changeExporter(`--stats-collections=${statsCollections.join(',')}`));
    await output.assertSuccess();
    await output.outContains(`- updated stats collections: ${statsCollections.join(',')}`);

    expect((await getServerAgent(exporterId)).stats_collections, 'Stats collections were not persisted on the mongodb_exporter agent')
      .toEqual(statsCollections);
  });

  test('PMM-T2308 - Verify Change agent collections limit', async ({}) => {
    const collectionsLimit = 100;

    const output = await cli.exec(changeExporter(`--collections-limit=${collectionsLimit}`));
    await output.assertSuccess();
    await output.outContains(`- changed collections limit to ${collectionsLimit}`);

    expect((await getServerAgent(exporterId)).collections_limit, 'Collections limit was not persisted on the mongodb_exporter agent')
      .toEqual(collectionsLimit);
  });

  test('PMM-T2309 - Verify Change agent enable diagnostic data histograms', async ({}) => {
    test.skip(versionBelow(adminVersion, '3.9.0'), 'Requires pmm-client 3.9.0+');

    const output = await cli.exec(changeExporter('--enable-diagnostic-data-histograms'));
    await output.assertSuccess();
    await output.outContains('- enabled diagnostic data histograms');

    expect((await getServerAgent(exporterId)).enable_diagnostic_data_histograms, 'Diagnostic data histograms were not enabled on the mongodb_exporter agent')
      .toBe(true);
  });

  test('PMM-T2310 - Verify Change agent overrides disabled collectors', async ({}) => {
    const collectorsToDisable = ['collstats', 'dbstats'];

    const output = await cli.exec(changeExporter(`--disable-collectors=${collectorsToDisable.join(',')}`));
    await output.assertSuccess();
    await output.outContains(`- updated disabled collectors: [${collectorsToDisable.join(' ')}]`);

    expect((await getServerAgent(exporterId)).disabled_collectors, 'Disabled collectors were not persisted on the mongodb_exporter agent')
      .toEqual(collectorsToDisable);
  });

  test('PMM-T1013 - Verify Change agent skip connection check', async ({}) => {
    test.skip(versionBelow(adminVersion, '3.9.0'), 'Requires pmm-client 3.9.0+');

    for (const command of changeBoth('--password=invalid_skip_check_password --skip-connection-check')) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains('agent configuration updated.');
    }

    for (const command of changeBoth(`--username=${newUsername} --password=${newPassword}`)) {
      await (await cli.exec(command)).assertSuccess();
    }

    await expectAgentsStatus('Running');
    await expectMongoUp();
  });

  test('PMM-T1010 - Verify Change agent tls', async ({}) => {
    test.skip(versionBelow(adminVersion, '3.9.0'), 'Requires pmm-client 3.9.0+');

    const ext = 'basicConstraints=CA:FALSE\\nextendedKeyUsage=serverAuth,clientAuth';
    const certCommands = [
      'mkdir -p /certs',
      'openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=pmm-qa-ca -keyout /certs/ca.key -out /certs/ca-certs.pem',
      ...['server', 'client'].flatMap((name) => [
        `openssl req -newkey rsa:2048 -nodes -subj /CN=${name === 'server' ? containerName : 'pmm-test'} -keyout /certs/${name}.key -out /certs/${name}.csr`,
        `printf "${ext}" > /certs/${name}.ext && openssl x509 -req -in /certs/${name}.csr -CA /certs/ca-certs.pem -CAkey /certs/ca.key -CAcreateserial -days 1 -extfile /certs/${name}.ext -out /certs/${name}.crt`,
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
    await waitForMongod(tlsProbe);
    expect((await cli.exec(plainProbe)).code, 'mongod should reject connections without TLS').not.toEqual(0);

    // MongoDB agents take a single cert+key PEM via --tls-certificate-key-file. The client key is unencrypted,
    // so the driver ignores --tls-certificate-key-file-password and the connection check still passes.
    const authDatabase = 'admin';
    const tlsFlags = `--tls --tls-skip-verify --tls-certificate-key-file=/certs/client.pem --tls-certificate-key-file-password=client_key_password --tls-ca-file=/certs/ca-certs.pem --authentication-database=${authDatabase}`;

    for (const command of changeBoth(tlsFlags)) {
      // rs101 has just restarted and is cut off from the replica set, so auth can briefly fail.
      // The change only persists on success, so re-running it is idempotent.
      await expect(async () => {
        const output = await cli.exec(command);
        await output.assertSuccess();
        await output.outContains('TLS enabled : true');
        await output.outContains('- updated TLS certificate key password');
        await output.outContains(`- changed authentication database to ${authDatabase}`);
      }).toPass({ intervals: [5_000], timeout: 120_000 });
    }

    await expectAgentsStatus('Running');
    await expectMongoUp(300_000);

    // SCRAM-SHA-256 is not in the server's authenticationMechanisms, so only check the flag is accepted,
    // then reset it to restore default negotiation.
    const authMechanism = 'SCRAM-SHA-256';

    for (const command of changeBoth(`--authentication-mechanism=${authMechanism} --skip-connection-check`)) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains(`- changed authentication mechanism to ${authMechanism}`);
    }

    for (const command of changeBoth('--authentication-mechanism= --skip-connection-check')) {
      await (await cli.exec(command)).assertSuccess();
    }

    await expectMongoUp(300_000);
  });

  test('PMM-T1011 - Verify Change agent pmm agent listen port', async ({}) => {
    pmmAgentListenPortChanged = true;
    await (await cli.exec(`docker exec ${containerName} sed -i 's/listen-port: 7777/listen-port: 7778/' ${pmmAgentConfig}`)).assertSuccess();
    await (await cli.exec(`docker exec ${containerName} grep -q 'listen-port: 7778' ${pmmAgentConfig}`)).assertSuccess();
    await (await cli.exec(`docker exec ${containerName} systemctl restart pmm-agent`)).assertSuccess();

    await expect(async () => {
      await (await cli.exec(`docker exec ${containerName} pmm-admin status --pmm-agent-listen-port=7778`)).assertSuccess();
    }).toPass({ intervals: [2_000], timeout: 60_000 });

    for (const command of changeBoth('--log-level=info --pmm-agent-listen-port=7778')) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains('- changed log level to info');
    }
  });

  test('PMM-T99103 - Verify Change agent server url and server insecure tls', async ({}) => {
    const serverUrl = `https://admin:${adminPassword}@pmm-server:8443/`;

    for (const command of changeBoth(`--server-url=${serverUrl} --pmm-agent-listen-port=7778`)) {
      await expectFailure(await cli.exec(command), 'tls: failed to verify certificate:');
    }

    for (const command of changeBoth(`--server-url=${serverUrl} --server-insecure-tls --pmm-agent-listen-port=7778`)) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains('agent configuration updated.');
    }
  });
});

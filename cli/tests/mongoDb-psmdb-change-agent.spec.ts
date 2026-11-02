import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
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

let adminVersion: string;
let exporterId: string;
let profilerId: string;
let agentPassword = 'mypass';
let mongodTlsEnabled = false;
let pmmAgentListenPortChanged = false;

// User management must run on the primary. Talk to rs101 (the priority-2 primary) directly: from inside the container
// replica-set discovery resolves the primary to loopback, and an election makes mongosh fail with ECONNREFUSED.
const runOnPrimary = async (js: string) => {
  await expect(async () => {
    await (await cli.exec(cli.mongoEval(containerName, mongoUri, `if (!db.hello().isWritablePrimary) throw new Error("rs101 is not primary yet"); ${js}`))).assertSuccess();
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

    const agents = await cli.listAgents(containerName);
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
      await cli.waitForMongod(containerName, plainProbe);
    }

    if (exporterId) {
      await removeMongoService(containerName, serviceName);
      await runOnPrimary(dropNewUser);
    }
  });

  test('PMM-T2426 - Verify Change agent username and password for mongodb-exporter and qan-mongodb-profiler-agent', async ({}) => {
    const monitoringRoles = '[ { role: "explainRole", db: "admin" }, { role: "clusterMonitor", db: "admin" }, { role: "read", db: "local" } ]';

    await runOnPrimary(`${dropNewUser} db.getSiblingDB("admin").createUser({ user: "${newUsername}", pwd: "${newPassword}-wrong", roles: ${monitoringRoles} })`);

    for (const command of cli.changeMongoAgents(containerName, exporterId, profilerId, `--username=${newUsername} --password=${newPassword}`)) {
      await cli.expectFailure(await cli.exec(command), 'Authentication failed');
    }

    await runOnPrimary(`db.getSiblingDB("admin").changeUserPassword("${newUsername}", "${newPassword}")`);

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
      const metrics = await cli.exec(`docker exec pmm-server curl -sS -u pmm:${agentPassword} http://${containerName}:${await cli.getAgentPort(containerName, exporterId)}/metrics`);
      await metrics.assertSuccess();
      await metrics.outContains('mongodb_up');
    }).toPass({ intervals: [5_000], timeout: 90_000 });
  });

  test('PMM-T2433 - Verify Change agent push metrics for mongodb-exporter', async ({}) => {
    await cli.changeAgentsUntilPersisted([cli.changeMongoExporter(containerName, exporterId, '--push-metrics')], ['- enabled push metrics'], async () => {
      expect((await cli.getServerAgent(exporterId)).push_metrics_enabled, 'Push metrics was not persisted on the mongodb_exporter agent').toBe(true);
    });

    await expect(async () => {
      const metrics = await cli.exec(`docker exec pmm-server curl -sS -u pmm:${agentPassword} http://${containerName}:${await cli.getAgentPort(containerName, exporterId)}/metrics`);
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
    test.skip(versionBelow(adminVersion, '3.9.0'), 'Requires pmm-client 3.9.0+');

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

    // The second list replaces the first rather than adding to it.
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
    test.skip(versionBelow(adminVersion, '3.9.0'), 'Requires pmm-client 3.9.0+');

    for (const command of cli.changeMongoAgents(containerName, exporterId, profilerId, '--password=invalid_skip_check_password --skip-connection-check')) {
      const output = await cli.exec(command);
      await output.assertSuccess();
      await output.outContains('agent configuration updated.');
    }

    for (const command of cli.changeMongoAgents(containerName, exporterId, profilerId, `--username=${newUsername} --password=${newPassword}`)) {
      await (await cli.exec(command)).assertSuccess();
    }

    await cli.expectAgentsRunning(containerName, [exporterId, profilerId], true);
    await cli.expectMongoUp(containerName, serviceName, agentPassword);
  });

  test('PMM-T2436 - Verify Change agent TLS for mongodb-exporter and qan-mongodb-profiler-agent', async ({}) => {
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

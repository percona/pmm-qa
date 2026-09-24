import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe(
  'Tests to verify pmm-admin inventory change agent functionality for the RTA MongoDB agent',
  () => {
    pmmTest.describe.configure({ mode: 'serial' });

    const mongoUsername = 'pmm';
    const mongoPassword = 'pmmpass';
    let containerName: string;
    let serviceId: string;
    let mongoExporterId: string;
    let pmmAgentId: string;
    let rtaAgentId: string;

    pmmTest.beforeAll(async ({ cliHelper }) => {
      containerName = cliHelper.execSilent(`docker ps --format '{{.Names}}' | grep rs101`).stdout.trim();
      serviceId = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep rs101 | head -1 | awk -F' ' '{print $4}'`,
        )
        .stdout.trim();
      pmmAgentId = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep pmm_agent | head -1 | awk -F' ' '{print $3}'`,
        )
        .stdout.trim();
      mongoExporterId = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep mongodb_exporter | awk -F' ' '{print $4}'`,
        )
        .stdout.trim();

      // Real-Time Analytics is not registered by the framework's `pmm-admin add
      // mongodb` (that creates the exporter and profiler agents). Enable it for the
      // rs101 service by adding the RTA MongoDB agent. Capture the new agent ID from
      // the command output rather than grepping `pmm-admin list` -- a service can
      // hold more than one RTA agent, and a list grep would return every match.
      const addOutput = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory add agent rta-mongodb-agent ${pmmAgentId} ${serviceId} ${mongoUsername} --password=${mongoPassword}`,
        )
        .assertSuccess().stdout;
      const agentIdLine = addOutput.split('\n').find((line) => line.trim().startsWith('Agent ID'));

      if (!agentIdLine) {
        throw new Error(`Could not find the RTA agent ID in the add-agent output:\n${addOutput}`);
      }

      rtaAgentId = agentIdLine.slice(agentIdLine.indexOf(':') + 1).trim();
    });

    pmmTest(
      'PMM-T2311 - Verify RTA Change agent username and password @rta-mongodb-integration',
      async ({ cliHelper }) => {
        cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} --username=${mongoUsername} --password=wrong_${mongoPassword}`,
          )
          .outContains('Authentication failed');

        cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} --username=${mongoUsername} --password=${mongoPassword}`,
          )
          .assertSuccess();
      },
    );

    pmmTest(
      'PMM-T2312 - Verify RTA Change agent custom labels @rta-mongodb-integration',
      async ({ api, cliHelper }) => {
        const customLabels = { env: 'qa_testing_rta_agent' };

        await cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} --custom-labels=env=${customLabels.env}`,
          )
          .assertSuccess()
          .outContains('- updated custom labels');

        const agent = await api.inventoryApi.getAgentById(rtaAgentId);

        expect(agent.custom_labels, 'Custom labels were not persisted on the rta_mongodb_agent').toEqual(
          customLabels,
        );
      },
    );

    pmmTest(
      'PMM-T2313 - Verify RTA Change agent log level @rta-mongodb-integration',
      async ({ api, cliHelper }) => {
        await cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} --log-level=debug`,
          )
          .assertSuccess()
          .outContains('- changed log level to debug');

        const agent = await api.inventoryApi.getAgentById(rtaAgentId);

        expect(agent.log_level, 'Log level was not persisted on the rta_mongodb_agent').toEqual(
          'LOG_LEVEL_DEBUG',
        );
      },
    );

    pmmTest(
      'PMM-T2314 - Verify RTA Change agent debug, trace and json @rta-mongodb-integration',
      async ({ cliHelper }) => {
        cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} --debug --trace --json`,
          )
          .assertSuccess();
      },
    );

    pmmTest(
      'PMM-T2315 - Verify RTA Change agent enable true/false @rta-mongodb-integration',
      async ({ cliHelper, page }) => {
        const enableCommands = [
          { command: '--enable=false', response: '- disabled agent', status: 'Done (disabled)' },
          { command: '--enable=true', response: '- enabled agent', status: 'Running' },
          { command: '--enable=false', response: '- disabled agent', status: 'Done (disabled)' },
          { command: '--enable', response: '- enabled agent', status: 'Running' },
        ];

        for (const enableCommand of enableCommands) {
          await cliHelper
            .execSilent(
              `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} ${enableCommand.command}`,
            )
            .assertSuccess()
            .outContains(enableCommand.response);

          // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for the state change to propagate
          await page.waitForTimeout(Timeouts.TEN_SECONDS);

          await cliHelper
            .execSilent(
              `docker exec ${containerName} pmm-admin list | grep rta_mongodb_agent | grep ${serviceId}`,
            )
            .assertSuccess()
            .outContains(enableCommand.status);
        }
      },
    );

    pmmTest(
      'PMM-T2316 - Verify RTA Change agent collect interval @rta-mongodb-integration',
      async ({ api, cliHelper }) => {
        const collectInterval = '5s';

        await cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} --collect-interval=${collectInterval}`,
          )
          .assertSuccess()
          .outContains(`- changed collect interval to ${collectInterval}`);

        const agent = await api.inventoryApi.getAgentById(rtaAgentId);

        expect(
          agent.rta_options.collect_interval,
          'Collect interval was not persisted on the rta_mongodb_agent',
        ).toEqual(collectInterval);
      },
    );

    pmmTest(
      'PMM-T2317 - Verify RTA Change agent skip connection check @rta-mongodb-integration',
      async ({ cliHelper }) => {
        await cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} --password=invalid_skip_check_password --skip-connection-check`,
          )
          .assertSuccess()
          .outContains('agent configuration updated.');

        await cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} --username=${mongoUsername} --password=${mongoPassword}`,
          )
          .assertSuccess();
      },
    );

    pmmTest(
      'PMM-T99103 - Verify Change agent server url and server insecure tls @rta-mongodb-integration',
      async ({ cliHelper }) => {
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
        const serverUrl = `https://admin:${adminPassword}@pmm-server:8443/`;
        let commands = [
          `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} --server-url=${serverUrl}`,
        ];

        for (const command of commands) {
          await cliHelper.execSilent(command).outContains('tls: failed to verify certificate:');
        }

        commands = [
          `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} --server-url=${serverUrl} --server-insecure-tls`,
        ];

        for (const command of commands) {
          await cliHelper.execSilent(command).assertSuccess().outContains('agent configuration updated.');
        }
      },
    );

    pmmTest('PMM-T2318 - Verify RTA Change agent tls @rta-mongodb-integration', async ({ cliHelper }) => {
      const confPath = `/etc/mongod/mongod.conf`;

      cliHelper.createTlsCertificates(containerName);

      const commands = [
        `docker exec ${containerName} bash -c "cat /easy-rsa/easyrsa3/pki/issued/${containerName}.crt /easy-rsa/easyrsa3/pki/private/${containerName}.key > /certs/server.pem"`,
        `docker exec ${containerName} bash -c "cat /easy-rsa/easyrsa3/pki/issued/pmm-test.crt /easy-rsa/easyrsa3/pki/private/pmm-test.key > /certs/client.pem"`,
        `docker exec ${containerName} cp /easy-rsa/easyrsa3/pki/ca.crt /certs/ca-certs.pem`,
        `docker exec ${containerName} chown mongod:mongod /certs/server.pem /certs/ca-certs.pem`,
        `docker exec ${containerName} chmod 600 /certs/server.pem`,
        `docker exec ${containerName} chmod 644 /certs/ca-certs.pem`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      cliHelper.execSilent(
        `docker exec ${containerName} sed -i '/bindIp: 0.0.0.0/a\\  tls:\\n    mode: requireTLS\\n    certificateKeyFile: /certs/server.pem\\n    CAFile: /certs/ca-certs.pem' ${confPath}`,
      );
      cliHelper.execSilent(`docker exec ${containerName} systemctl restart mongod`);

      // The mongod unit is Type=simple, so `systemctl restart` returns 0 the moment
      // it execs mongod -- before mongod validates the new TLS config. Poll mongod
      // directly over TLS until it serves again; on timeout, surface mongod's own
      // startup log so the real cause is visible instead of a downstream error.
      await expect(() => {
        const probe = cliHelper.execSilent(
          `docker exec ${containerName} mongo --tls --host localhost --port 27017 --tlsCAFile /certs/ca-certs.pem --tlsCertificateKeyFile /certs/client.pem --tlsAllowInvalidCertificates --quiet --eval 'db.hello()'`,
        );

        expect(
          probe.code,
          `mongod is not serving TLS after restart. mongod journal:\n${
            cliHelper.execSilent(`docker exec ${containerName} journalctl -u mongod --no-pager -n 20`).stdout
          }`,
        ).toEqual(0);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });

      // MongoDB agents take a single cert+key PEM via --tls-certificate-key-file. The
      // client key is unencrypted, so --tls-certificate-key-file-password is ignored
      // by the driver and the connection check still passes. requireTLS isolates the
      // freshly-restarted rs101 from its replica set, so the connection check can
      // transiently reject auth right after the restart -- retry until it passes (the
      // change only persists on success, so re-running the same command is idempotent).
      const certKeyFilePassword = 'client_key_password';
      const tlsCommand = `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} --tls-certificate-key-file=/certs/client.pem --tls-certificate-key-file-password=${certKeyFilePassword} --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify`;

      await expect(async () => {
        await cliHelper
          .execSilent(tlsCommand)
          .assertSuccess()
          .outContains('- updated TLS certificate key password');
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });

      // The exporter and profiler agents on rs101 stay non-TLS, so the overall service
      // remains Down under requireTLS; verify the RTA agent itself reconnects over TLS.
      await expect(() => {
        cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin list | grep rta_mongodb_agent | grep ${serviceId}`,
          )
          .assertSuccess()
          .outContains('Running');
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });

      // --authentication-mechanism pins a specific SASL mechanism that the test server
      // may not advertise, so verify the flag is accepted without a live handshake,
      // then reset it to restore default negotiation.
      const authMechanism = 'SCRAM-SHA-256';

      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} --authentication-mechanism=${authMechanism} --skip-connection-check`,
        )
        .assertSuccess()
        .outContains(`- changed authentication mechanism to ${authMechanism}`);

      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} --authentication-mechanism= --skip-connection-check`,
        )
        .assertSuccess();
    });

    pmmTest(
      'PMM-T1011 - Verify Change agent pmm agent listen port @rta-mongodb-integration',
      async ({ cliHelper }) => {
        let commands = [
          `docker exec ${containerName} sed -i 's/listen-port: 7777/listen-port: 7778/' /usr/local/percona/pmm/config/pmm-agent.yaml`,
          `docker restart ${containerName}`,
          `docker exec -d ${containerName} pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml`,
        ];

        commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

        commands = [
          `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --pmm-agent-listen-port=7778`,
          `docker exec ${containerName} pmm-admin inventory change agent rta-mongodb-agent ${rtaAgentId} --pmm-agent-listen-port=7778`,
        ];

        commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
      },
    );
  },
);

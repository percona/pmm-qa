import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  const newUsername = 'new_pmmm_username';
  const newPassword = 'new_pmm_user_password';
  let containerName: string;
  let serviceName: string;
  let serviceId: string;
  let mongoExporterId: string;
  let mongoProfilerAgentId: string;
  let pgExporterPort: string;
  const pgExporterPassword = 'newAgentPassword';

  pmmTest.beforeAll(async ({ cliHelper }) => {
    containerName = cliHelper.execSilent(`docker ps --format '{{.Names}}' | grep rs101`).stdout.trim();
    serviceName = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep rs101 | head -1 | awk -F' ' '{print $2}'`,
      )
      .stdout.trim();
    serviceId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep rs101 | head -1 | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    mongoExporterId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep mongodb_exporter | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    mongoProfilerAgentId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep mongodb_mongolog_agent | awk -F' ' '{print $3}'`,
      )
      .stdout.trim();
  });

  pmmTest(
    'PMM-T1001 - Verify Change agent username and password @psmdb-mongolog-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      const mongoUri = 'mongodb://root:root@localhost:27017/?authSource=admin&directConnection=true';
      const monitoringRoles =
        '[ { role: "explainRole", db: "admin" }, { role: "clusterMonitor", db: "admin" }, { role: "read", db: "local" } ]';
      const mongoEval = (js: string) =>
        `docker exec ${containerName} mongo "${mongoUri}" --quiet --eval '${js}'`;

      // Talk straight to rs101 (the priority-2 primary) with a direct connection
      // instead of driving replica-set discovery: from inside the container the
      // discovered primary resolves to loopback, so a mongod restart/election makes
      // mongosh abort the whole command with "ECONNREFUSED 127.0.0.1:27017" even
      // when the local mongod is up. createUser must run on the primary, so wait
      // until rs101 answers as a writable primary before creating the user.
      await expect(() => {
        cliHelper
          .execSilent(
            mongoEval('if (!db.hello().isWritablePrimary) throw new Error("rs101 is not primary yet")'),
          )
          .assertSuccess();
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });

      cliHelper
        .execSilent(
          mongoEval(
            `db.getSiblingDB("admin").createUser({ user: "${newUsername}", pwd: "${newPassword}-wrong", roles: ${monitoringRoles} })`,
          ),
        )
        .assertSuccess();

      let commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --password=${newPassword} --username=${newUsername}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-mongolog-agent ${mongoProfilerAgentId} --password=${newPassword} --username=${newUsername}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).outContains('Authentication failed'));

      cliHelper.execSilent(
        mongoEval(`db.getSiblingDB("admin").changeUserPassword("${newUsername}", "${newPassword}")`),
      );

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --password=${newPassword} --username=${newUsername}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-mongolog-agent ${mongoProfilerAgentId} --password=${newPassword} --username=${newUsername}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.TWO_MINUTES);
    },
  );

  pmmTest(
    'PMM-T1002 - Verify Change agent custom labels @psmdb-profiler-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const customLabel = 'env=qa_testing_mysqld_exporter';
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --custom-labels=${customLabel}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --custom-labels=${customLabel}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(mongoExporterId);
      await expect(agentsPage.builders.property(customLabel)).toBeVisible();
      await agentsPage.hideRowDetails(mongoExporterId);
      await agentsPage.showRowDetails(mongoProfilerAgentId);
      await expect(agentsPage.builders.property(customLabel)).toBeVisible();
      await agentsPage.hideRowDetails(mongoProfilerAgentId);
    },
  );

  pmmTest(
    'PMM-T1003 - Verify Change agent log level @psmdb-profiler-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --log-level=debug`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --log-level=debug`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(mongoExporterId);
      await expect(agentsPage.builders.property('log_level=LOG_LEVEL_DEBUG')).toBeVisible();
      await agentsPage.hideRowDetails(mongoExporterId);
      await agentsPage.showRowDetails(mongoProfilerAgentId);
      await expect(agentsPage.builders.property('log_level=LOG_LEVEL_DEBUG')).toBeVisible();
      await agentsPage.hideRowDetails(mongoProfilerAgentId);
    },
  );

  pmmTest(
    'PMM-T1004 - Verify Change agent debug, trace and json @psmdb-profiler-integration',
    async ({ cliHelper }) => {
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --debug --trace --json`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --debug --trace --json`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
    },
  );

  pmmTest(
    'PMM-T1005 - Verify Change agent enable true/false @psmdb-profiler-integration',
    async ({ cliHelper, page }) => {
      const enableCommands = [
        { command: '--enable=false', response: '- disabled agent', status: 'Done (disabled)' },
        { command: '--enable=true', response: '- enabled agent', status: 'Running' },
        { command: '--enable=false', response: '- disabled agent', status: 'Done (disabled)' },
        { command: '--enable', response: '- enabled agent', status: 'Running' },
      ];

      for (const enableCommand of enableCommands) {
        let commands = [
          `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} ${enableCommand.command}`,
          `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} ${enableCommand.command}`,
        ];

        for (const command of commands) {
          await cliHelper.execSilent(command).assertSuccess().outContains(enableCommand.response);
        }

        // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
        await page.waitForTimeout(Timeouts.TEN_SECONDS);

        commands = [
          `docker exec ${containerName} pmm-admin list | grep mongodb_exporter | grep ${serviceId}`,
          `docker exec ${containerName} pmm-admin list | grep mongodb_profiler_agent | grep ${serviceId}`,
        ];

        for (const command of commands) {
          await cliHelper.execSilent(command).assertSuccess().outContains(enableCommand.status);
        }
      }
    },
  );

  pmmTest(
    'PMM-T1006 - Verify Change agent agent password @psmdb-profiler-integration',
    async ({ cliHelper, page }) => {
      cliHelper.execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --agent-password=${pgExporterPassword}`,
      );

      // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
      await page.waitForTimeout(Timeouts.TEN_SECONDS);

      const metrics = cliHelper.getMetrics({
        agentPassword: pgExporterPassword,
        dockerContainer: containerName,
        serviceName: serviceName,
      });

      expect(metrics).toContain('mongodb_up');
    },
  );

  pmmTest(
    'PMM-T1007 - Verify Change agent expose exporter @psmdb-profiler-integration',
    async ({ cliHelper, page }) => {
      pgExporterPort = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep ${mongoExporterId} | awk -F' ' '{print $6}'`,
        )
        .stdout.trim();
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --expose-exporter`,
        )
        .assertSuccess()
        .outContains('- enabled expose exporter');
      // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
      await page.waitForTimeout(Timeouts.ONE_MINUTE);
      await cliHelper
        .execSilent(
          `docker exec pmm-server curl -u pmm:${pgExporterPassword} http://${containerName}:${pgExporterPort}/metrics`,
        )
        .assertSuccess()
        .outContains('mongodb_up');
    },
  );

  pmmTest(
    'PMM-T1008 - Verify Change agent push metrics @psmdb-profiler-integration',
    async ({ cliHelper, page }) => {
      pgExporterPort = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep ${mongoExporterId} | awk -F' ' '{print $6}'`,
        )
        .stdout.trim();
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --push-metrics`,
        )
        .assertSuccess()
        .outContains('- enabled push metrics');

      // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
      await page.waitForTimeout(Timeouts.FIVE_SECONDS);
      await cliHelper
        .execSilent(
          `docker exec pmm-server curl -u pmm:${pgExporterPassword} http://${containerName}:${pgExporterPort}/metrics`,
        )
        .assertSuccess()
        .outContains('mongodb_up');
      await cliHelper
        .execSilent(
          `docker exec ${containerName} cat /var/log/pmm-agent.log | grep vmagent | tail -20 | grep error`,
        )
        .outEquals('');
      await cliHelper
        .execSilent(`docker exec ${containerName} pmm-admin list | grep ${mongoExporterId}`)
        .outContains('Running');
    },
  );

  pmmTest(
    'PMM-T1009 - Verify Change agent disable collectors @psmdb-profiler-integration',
    async ({ api, cliHelper }) => {
      const collectorsToDisable = ['diagnosticdata', 'replicasetstatus'];

      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --disable-collectors=${collectorsToDisable.join(',')}`,
        )
        .assertSuccess()
        .outContains(`- updated disabled collectors: [${collectorsToDisable.join(' ')}]`);

      const agent = await api.inventoryApi.getAgentById(mongoExporterId);

      expect(
        agent.disabled_collectors,
        'Disabled collectors were not persisted on the mongodb_exporter agent',
      ).toEqual(collectorsToDisable);
    },
  );

  pmmTest(
    'PMM-T1015 - Verify Change agent max query length @psmdb-profiler-integration',
    async ({ api, cliHelper }) => {
      const maxQueryLength = 2_048;

      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --max-query-length=${maxQueryLength}`,
        )
        .assertSuccess()
        .outContains(`- changed max query length to ${maxQueryLength}`);

      const agent = await api.inventoryApi.getAgentById(mongoProfilerAgentId);

      expect(
        agent.max_query_length,
        'Max query length was not persisted on the qan-mongodb-profiler-agent',
      ).toEqual(maxQueryLength);
    },
  );

  pmmTest(
    'PMM-T2307 - Verify Change agent stats collections @psmdb-profiler-integration',
    async ({ api, cliHelper }) => {
      const statsCollections = ['db1.col1', 'db2.col2'];

      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --stats-collections=${statsCollections.join(',')}`,
        )
        .assertSuccess()
        .outContains(`- updated stats collections: ${statsCollections.join(',')}`);

      const agent = await api.inventoryApi.getAgentById(mongoExporterId);

      expect(
        agent.mongo_db_options.stats_collections,
        'Stats collections were not persisted on the mongodb_exporter agent',
      ).toEqual(statsCollections);
    },
  );

  pmmTest(
    'PMM-T2308 - Verify Change agent collections limit @psmdb-profiler-integration',
    async ({ api, cliHelper }) => {
      const collectionsLimit = 100;

      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --collections-limit=${collectionsLimit}`,
        )
        .assertSuccess()
        .outContains(`- changed collections limit to ${collectionsLimit}`);

      const agent = await api.inventoryApi.getAgentById(mongoExporterId);

      expect(
        agent.mongo_db_options.collections_limit,
        'Collections limit was not persisted on the mongodb_exporter agent',
      ).toEqual(collectionsLimit);
    },
  );

  pmmTest(
    'PMM-T2309 - Verify Change agent enable diagnostic data histograms @psmdb-profiler-integration',
    async ({ api, cliHelper }) => {
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --enable-diagnostic-data-histograms`,
        )
        .assertSuccess()
        .outContains('- enabled diagnostic data histograms');

      const agent = await api.inventoryApi.getAgentById(mongoExporterId);

      expect(
        agent.mongo_db_options.enable_diagnostic_data_histograms,
        'Diagnostic data histograms were not enabled on the mongodb_exporter agent',
      ).toBe(true);
    },
  );

  pmmTest(
    'PMM-T2310 - Verify Change agent disable collectors @psmdb-profiler-integration',
    async ({ api, cliHelper }) => {
      const collectorsToDisable = ['collstats', 'dbstats'];

      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --disable-collectors=${collectorsToDisable.join(',')}`,
        )
        .assertSuccess()
        .outContains(`- updated disabled collectors: [${collectorsToDisable.join(' ')}]`);

      const agent = await api.inventoryApi.getAgentById(mongoExporterId);

      expect(
        agent.disabled_collectors,
        'Disabled collectors were not persisted on the mongodb_exporter agent',
      ).toEqual(collectorsToDisable);
    },
  );

  pmmTest(
    'PMM-T1013 - Verify Change agent skip connection check @psmdb-profiler-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      let commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --password=invalid_skip_check_password --skip-connection-check`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --password=invalid_skip_check_password --skip-connection-check`,
      ];

      for (const command of commands) {
        await cliHelper.execSilent(command).assertSuccess().outContains('agent configuration updated.');
      }

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --username=${newUsername} --password=${newPassword}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --username=${newUsername} --password=${newPassword}`,
      ];

      for (const command of commands) {
        await cliHelper.execSilent(command).assertSuccess();
      }

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.TWO_MINUTES);
    },
  );

  pmmTest(
    'PMM-T1010 - Verify Change agent tls @psmdb-profiler-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      const confPath = `/etc/mongod/mongod.conf`;

      cliHelper.createTlsCertificates(containerName);

      let commands = [
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
      cliHelper.execSilent(`docker exec ${containerName} cat ${confPath}`);
      cliHelper.execSilent(`docker exec ${containerName} systemctl restart mongod`);

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Down', Timeouts.TWO_MINUTES);

      // The mongod unit is Type=simple, so `systemctl restart` returns 0 the moment
      // it execs mongod -- before mongod validates the new TLS config. A bad or
      // unreadable certificate makes mongod exit right after, yet the restart still
      // reports success and the service reads "Down" (the old non-TLS agent lost its
      // connection). The change-agent connection check would then hit a dead mongod
      // and fail with a misleading "connection refused". Poll mongod directly over
      // TLS until it serves again; if it never does, surface mongod's own startup
      // log so the real cause is visible instead.
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

      // MongoDB agents take a single cert+key PEM via --tls-certificate-key-file;
      // the MySQL-style --tls-cert-file/--tls-key-file flags do not exist here and
      // make pmm-admin reject the whole command, leaving the agents without TLS.
      // The client key is unencrypted, so --tls-certificate-key-file-password is
      // ignored by the driver and the connection check still passes;
      // --authentication-database=admin is where the monitoring user lives and
      // also matches the driver's default authSource.
      const authDatabase = 'admin';
      const certKeyFilePassword = 'client_key_password';

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --tls-certificate-key-file=/certs/client.pem --tls-certificate-key-file-password=${certKeyFilePassword} --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify --authentication-database=${authDatabase}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --tls-certificate-key-file=/certs/client.pem --tls-certificate-key-file-password=${certKeyFilePassword} --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify --authentication-database=${authDatabase}`,
      ];

      // The connection check authenticates against rs101, a freshly-restarted node
      // that requireTLS has isolated from the replica set; it can transiently reject
      // auth for a moment after coming back (seen as "sasl conversation error ...
      // AuthenticationFailed"). Retry until the check passes -- the change only
      // persists on success, so re-running the same command is idempotent.
      for (const command of commands) {
        await expect(async () => {
          await cliHelper
            .execSilent(command)
            .assertSuccess()
            .outContainsNormalizedMany([
              '- updated TLS certificate key password',
              `- changed authentication database to ${authDatabase}`,
            ]);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
      }

      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.FIVE_MINUTES);

      // --authentication-mechanism pins a specific SASL mechanism that the test
      // server may not advertise, so verify the flag is accepted without a live
      // handshake, then reset it to restore default negotiation and keep the
      // agents Up for the following tests.
      const authMechanism = 'SCRAM-SHA-256';

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --authentication-mechanism=${authMechanism} --skip-connection-check`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --authentication-mechanism=${authMechanism} --skip-connection-check`,
      ];

      for (const command of commands) {
        await cliHelper
          .execSilent(command)
          .assertSuccess()
          .outContains(`- changed authentication mechanism to ${authMechanism}`);
      }

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --authentication-mechanism= --skip-connection-check`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --authentication-mechanism= --skip-connection-check`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.FIVE_MINUTES);
    },
  );

  pmmTest('PMM-T1011 - Verify Change agent pmm agent listen port @ps-integration', async ({ cliHelper }) => {
    let commands = [
      `docker exec ${containerName} sed -i 's/listen-port: 7777/listen-port: 7778/' /usr/local/percona/pmm/config/pmm-agent.yaml`,
      `docker restart ${containerName}`,
      `docker exec -d ${containerName} pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml`,
    ];

    commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

    commands = [
      `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --pmm-agent-listen-port=7778`,
      `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --pmm-agent-listen-port=7778`,
    ];

    commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
  });

  pmmTest(
    'PMM-T99103 - Verify Change agent server url and server insecure tls @ps-integration',
    async ({ cliHelper }) => {
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
      const serverUrl = `https://admin:${adminPassword}@pmm-server:8443/`;
      let commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --server-url=${serverUrl}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --server-url=${serverUrl}`,
      ];

      for (const command of commands) {
        await cliHelper.execSilent(command).outContains('tls: failed to verify certificate:');
      }

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --server-url=${serverUrl} --server-insecure-tls`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --server-url=${serverUrl} --server-insecure-tls`,
      ];

      for (const command of commands) {
        await cliHelper.execSilent(command).assertSuccess().outContains('agent configuration updated.');
      }
    },
  );
});

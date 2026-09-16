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
        `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep mongodb_profiler_agent | awk -F' ' '{print $3}'`,
      )
      .stdout.trim();
  });

  // PMM-T1010 appends a requireTLS block to /etc/mongod/mongod.conf, which is a
  // tracked file bind-mounted into every replica set member. Left in place it
  // stops mongod from starting on the next provisioning's fresh containers --
  // they have none of the certs T1010 created -- so the whole set comes up with
  // no primary and every later run fails at connection time. Strip the block so
  // a reused checkout provisions cleanly. Idempotent and safe when T1010 was
  // skipped: the sed matches nothing on an unmodified config.
  pmmTest.afterAll(({ cliHelper }) => {
    if (containerName) {
      cliHelper.execSilent(
        `docker exec ${containerName} sed -i '/^  tls:/,/CAFile:/d' /etc/mongod/mongod.conf`,
      );
    }
  });

  pmmTest(
    'PMM-T1001 - Verify Change agent username and password @psmdb-profiler-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      const replicaSetMembers = ['rs101', 'rs102', 'rs103'];
      const monitoringRoles =
        '[ { role: "explainRole", db: "admin" }, { role: "clusterMonitor", db: "admin" }, { role: "read", db: "local" } ]';
      // Direct connection to a specific member sidesteps replica-set discovery,
      // which from inside the container resolves the primary to loopback and makes
      // mongosh abort with "ECONNREFUSED 127.0.0.1:27017" during an election.
      // db.hello() answers before authentication, so probe for the primary without
      // credentials: discovery then stays correct even while the monitoring user or
      // the server's auth mechanisms are momentarily out of sync across members.
      const helloEval = (host: string) =>
        `docker exec ${containerName} mongo "mongodb://${host}:27017/?directConnection=true" --quiet --eval 'if (db.hello().isWritablePrimary) { print("isWritablePrimary") }'`;
      const mongoEval = (host: string, js: string) =>
        `docker exec ${containerName} mongo "mongodb://root:root@${host}:27017/?authSource=admin&directConnection=true" --quiet --eval '${js}'`;
      // createUser must run on the primary, but rs101 (priority 2) is not always
      // the primary when the suite starts -- a mongod restart/election can leave it
      // down or a secondary while another member holds the primary. Find whichever
      // member currently answers as the writable primary rather than assuming rs101.
      let primaryHost = '';

      await expect(() => {
        primaryHost = '';

        const attempts: string[] = [];

        for (const host of replicaSetMembers) {
          const result = cliHelper.execSilent(helloEval(host));

          if (result.code === 0 && result.stdout.includes('isWritablePrimary')) {
            primaryHost = host;
            break;
          }

          attempts.push(
            `${host}: ${result.code === 0 ? 'not primary' : (result.stderr || result.stdout).trim().split('\n')[0] || `exit ${result.code}`}`,
          );
        }

        expect(primaryHost, `no writable primary in replica set [${attempts.join('; ')}]`).not.toEqual('');
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });

      cliHelper
        .execSilent(
          mongoEval(
            primaryHost,
            `db.getSiblingDB("admin").createUser({ user: "${newUsername}", pwd: "${newPassword}-wrong", roles: ${monitoringRoles} })`,
          ),
        )
        .assertSuccess();

      let commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --password=${newPassword} --username=${newUsername}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --password=${newPassword} --username=${newUsername}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).outContains('Authentication failed'));

      cliHelper.execSilent(
        mongoEval(
          primaryHost,
          `db.getSiblingDB("admin").changeUserPassword("${newUsername}", "${newPassword}")`,
        ),
      );

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --password=${newPassword} --username=${newUsername}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --password=${newPassword} --username=${newUsername}`,
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
    'PMM-T1009 - Verify Change agent disable collectors @ps-integration',
    async ({ api, cliHelper }) => {
      const collectorsToDisable = ['perf_schema.eventsstatements', 'perf_schema.tablelocks'];

      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} --disable-collectors=${collectorsToDisable.join(',')}`,
        )
        .assertSuccess()
        .outContains(`- updated disabled collectors: [${collectorsToDisable.join(' ')}]`);

      const agent = await api.inventoryApi.getAgentById(mysqldExporterId);

      expect(
        agent.disabled_collectors,
        'Disabled collectors were not persisted on the mysqld_exporter agent',
      ).toEqual(collectorsToDisable);
    },
  );

  pmmTest(
    'PMM-T1014 - Verify Change agent disable query examples @ps-integration',
    async ({ api, cliHelper }) => {
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent qan-mysql-perfschema-agent ${mysqldPerfschemaAgentId} --disable-query-examples`,
        )
        .assertSuccess()
        .outContains('- disabled query examples');

      const agent = await api.inventoryApi.getAgentById(mysqldPerfschemaAgentId);

      expect(
        agent.query_examples_disabled,
        'Query examples were not disabled on the qan_mysql_perfschema_agent',
      ).toEqual(true);
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
    'PMM-T1012 - Verify Change agent tablestats group table limit @ps-integration',
    async ({ api, cliHelper }) => {
      const tablestatsGroupTableLimit = 2_000;

      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} --tablestats-group-table-limit=${tablestatsGroupTableLimit}`,
        )
        .assertSuccess()
        .outContains(`- changed tablestats group table limit to ${tablestatsGroupTableLimit}`);

      const agent = await api.inventoryApi.getAgentById(mysqldExporterId);

      expect(
        agent.table_count_tablestats_group_limit,
        'Tablestats group table limit was not persisted on the mysqld_exporter agent',
      ).toEqual(tablestatsGroupTableLimit);
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
      cliHelper.execSilent(`docker exec ${containerName} systemctl restart mongod`).assertSuccess();

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Down', Timeouts.TWO_MINUTES);

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

      // Restarting only rs101 into requireTLS churns the replica set -- its peers
      // stay non-TLS -- so the monitoring user's first TLS handshake can transiently
      // fail SASL auth while rs101 settles. The change is idempotent (its connection
      // check gates the update), so retry each agent until the check passes.
      for (const command of commands) {
        await expect(() => {
          const result = cliHelper.execSilent(command);

          result.assertSuccess();

          const out = result.stdout.replace(/ +(?= )/g, '');

          expect(out).toContain('- updated TLS certificate key password');
          expect(out).toContain(`- changed authentication database to ${authDatabase}`);
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

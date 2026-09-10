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

  pmmTest(
    'PMM-T1001 - Verify Change agent username and password @psmdb-profiler-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      const mongoUri = 'mongodb://root:root@localhost/?replicaSet=rs';
      const monitoringRoles =
        '[ { role: "explainRole", db: "admin" }, { role: "clusterMonitor", db: "admin" }, { role: "read", db: "local" } ]';
      const mongoEval = (js: string) =>
        `docker exec ${containerName} mongo "${mongoUri}" --quiet --eval '${js}'`;

      // The replica set can be briefly unreachable when the suite starts (a mongod
      // restart/election leaves the primary refusing connections -> ECONNREFUSED),
      // so wait for it to answer before creating the monitoring user.
      await expect(() => {
        cliHelper.execSilent(mongoEval('db.adminCommand({ ping: 1 })')).assertSuccess();
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
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --password=${newPassword} --username=${newUsername}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).outContains('Authentication failed'));

      cliHelper.execSilent(
        mongoEval(`db.getSiblingDB("admin").changeUserPassword("${newUsername}", "${newPassword}")`),
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
        `docker exec ${containerName} bash -c "cat /easy-rsa/easyrsa3/pki/private/pmm-test.key > /certs/client.key"`,
        `docker exec ${containerName} bash -c "cat /easy-rsa/easyrsa3/pki/issued/pmm-test.crt > /certs/client.crt"`,
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

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${mongoExporterId} --tls-cert-file=/certs/client.crt --tls-key-file=/certs/client.key --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${mongoProfilerAgentId} --tls-cert-file=/certs/client.crt --tls-key-file=/certs/client.key --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command));
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

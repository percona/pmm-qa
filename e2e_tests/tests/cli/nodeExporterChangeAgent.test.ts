import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  const newUsername = 'new_pmmm_username';
  // const newPassword = 'new_pmm_user_password';
  let containerName: string;
  // let pgVersion: string;
  // let nodeName: string;
  let nodeId: string;
  let nodeExporterId: string;
  // let pgExporterId: string;
  let nodeExporterPort: string;
  // let pgStatMonitorId: string;
  // let pgExporterSocketId: string;
  // let pgStatMonitorSocketId: string;
  let nodeExporterPassword = 'newAgentPassword';

  pmmTest.beforeAll(async ({ cliHelper }) => {
    containerName = cliHelper.execSilent(`docker ps --format '{{.Names}}' | grep pdpgsql`).stdout.trim();
    // nodeName = cliHelper
    //   .execSilent(
    //     `docker exec ${containerName} pmm-admin status | grep "Node name:" | awk -F' ' '{print $3}'`,
    //   )
    //   .stdout.trim();
    nodeId = cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin status | grep "Node ID" | awk -F' ' '{print $4}'`)
      .stdout.trim();
    nodeExporterId = cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin list | grep node_exporter | awk -F' ' '{print $4}'`)
      .stdout.trim();

    /*socketServiceId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep socket_pdpgsql_pmm | head -1 | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    pgExporterId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${nodeId} | grep postgres_exporter | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    pgStatMonitorId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${nodeId} | grep postgresql_pgstatmonitor_agent | awk -F' ' '{print $3}'`,
      )
      .stdout.trim();
    pgExporterSocketId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${socketServiceId} | grep postgres_exporter | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    pgStatMonitorSocketId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${socketServiceId} | grep postgresql_pgstatmonitor_agent | awk -F' ' '{print $3}'`,
      )
      .stdout.trim();*/
  });

  pmmTest.afterAll(async ({ cliHelper }) => {
    cliHelper.execSilent(`docker exec ${containerName} psql -U postgres -c "DROP ROLE ${newUsername};"`);
  });

  /*
  pdmmTest(
    'PMM-T9991 - Verfiy Change agent username and password @node-exporter-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      let commands = [
        `docker exec ${containerName} psql -U postgres -c "CREATE ROLE ${newUsername} WITH LOGIN PASSWORD '${newPassword}-Wrong';"`,
        `docker exec ${containerName} pg_ctlcluster ${pgVersion} main restart`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --password=${newPassword} --username=${newUsername}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorId} --password=${newPassword} --username=${newUsername}`,
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterSocketId} --password=${newPassword} --username=${newUsername}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorSocketId} --password=${newPassword} --username=${newUsername}`,
      ];

      commands.forEach((command) =>
        cliHelper.execSilent(command).outContains('password authentication failed for user'),
      );

      commands = [
        `docker exec ${containerName} psql -U postgres -c "ALTER USER ${newUsername} WITH PASSWORD '${newPassword}';"`,
        `docker exec ${containerName} pg_ctlcluster ${pgVersion} main restart`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.ONE_MINUTE);
    },
  );
*/

  pmmTest(
    'PMM-T9992 - Verify Change agent custom labels @node-exporter-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent node-exporter ${nodeExporterId} --custom-labels=env=qa_testing_node_exporter`,
        )
        .assertSuccess();
      await grafanaHelper.authorize();
      await page.goto(agentsPage.nodesUrl(nodeId));
      await agentsPage.showRowDetails(nodeExporterId);
      await expect(agentsPage.builders.property('env=qa_testing_node_exporter')).toBeVisible();
    },
  );

  // eslint-disable-next-line playwright/no-commented-out-tests -- Temporary test
  /*
  pmmTgest(
    'PMM-T9993 - Verify Change agent log level @node-exporter-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --log-level=debug`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorId} --log-level=debug`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(pgExporterId);
      await expect(agentsPage.builders.property('log_level=LOG_LEVEL_DEBUG')).toBeVisible();
      await agentsPage.hideRowDetails(pgExporterId);
      await agentsPage.showRowDetails(pgStatMonitorId);
      await expect(agentsPage.builders.property('log_level=LOG_LEVEL_DEBUG')).toBeVisible();

      await expect(async () => {
        const metrics = cliHelper.getMetrics({
          agentPassword: pgExporterId,
          dockerContainer: containerName,
          serviceName: serviceName,
        });

        expect(metrics).toContain('redis_up');
      }).toPass({
        intervals: [Timeouts.TWO_SECONDS],
        timeout: Timeouts.ONE_MINUTE,
      });
    },
  );

  pmsmTest(
    'PMM-T9993 - Verify Change agent debug, trace and json @node-exporter-integration',
    async ({ cliHelper }) => {
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --debug --trace --json`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorId} --debug --trace --json`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
    },
  );

  pmmTest(
    'PMM-T9994 - Verify Change agent tls @node-exporter-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      const confPath = `/etc/postgresql/${pgVersion}/main/postgresql.conf`;

      cliHelper.createTlsCertificates(containerName);

      let commands = [
        `docker exec ${containerName} cp /easy-rsa/easyrsa3/pki/private/${containerName}.key /certs/${containerName}.key`,
        `docker exec ${containerName} cp /easy-rsa/easyrsa3/pki/issued/${containerName}.crt /certs/${containerName}.crt`,
        `docker exec ${containerName} bash -c "cat /easy-rsa/easyrsa3/pki/private/pmm-test.key > /certs/client.key"`,
        `docker exec ${containerName} bash -c "cat /easy-rsa/easyrsa3/pki/issued/pmm-test.crt > /certs/client.crt"`,
        `docker exec ${containerName} cp /easy-rsa/easyrsa3/pki/ca.crt /certs/ca-certs.pem`,
        `docker exec ${containerName} chmod 600 /certs/${containerName}.key`,
        `docker exec ${containerName} chmod 600 /certs/${containerName}.crt`,
        `docker exec ${containerName} chown -R postgres:postgres /certs`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      fs.writeFileSync(
        '/tmp/ssl.conf',
        `ssl = on\nssl_cert_file = '/certs/${containerName}.crt'\nssl_key_file = '/certs/${containerName}.key'\n`,
      );

      cliHelper.execSilent(`docker cp /tmp/ssl.conf ${containerName}:/tmp/ssl.conf`);
      cliHelper.execSilent(`docker exec ${containerName} bash -c "cat /tmp/ssl.conf >> ${confPath}"`);

      const hbaPath = `/etc/postgresql/${pgVersion}/main/pg_hba.conf`;
      const hbaLines = `hostssl      all             all             127.0.0.1/32    scram-sha-256
        hostssl      all             all             ::1/128         scram-sha-256
        hostssl      all             all             0.0.0.0/0       scram-sha-256
        hostssl      all             all             ::/0            scram-sha-256
      `;

      fs.writeFileSync('/tmp/hba.conf', hbaLines);
      cliHelper.execSilent(`docker cp /tmp/hba.conf ${containerName}:${hbaPath}`);
      cliHelper.execSilent(`docker exec ${containerName} pg_ctlcluster ${pgVersion} main restart`);
      cliHelper.execSilent(
        `docker exec ${containerName} cat /var/log/postgresql/postgresql-${pgVersion}-main.log`,
      );

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceMonitoring(serviceName, 'Failed', Timeouts.ONE_MINUTE);

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --tls-cert-file=/certs/client.crt --tls-key-file=/certs/client.key --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatements-agent ${pgStatMonitorId} --tls-cert-file=/certs/client.crt --tls-key-file=/certs/client.key --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command));
      await servicesPage.waitForServiceMonitoring(serviceName, 'OK', Timeouts.TWO_MINUTES);
    },
  );
*/
  pmmTest(
    'PMM-T9995 - Verify Change agent enable true/false @node-exporter-integration',
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
            `docker exec ${containerName} pmm-admin inventory change agent node-exporter ${nodeExporterId} ${enableCommand.command}`,
          )
          .assertSuccess()
          .outContains(enableCommand.response);

        // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for the agents to be enabled/disabled
        await page.waitForTimeout(Timeouts.TEN_SECONDS);

        await cliHelper
          .execSilent(`docker exec ${containerName} pmm-admin list | grep node_exporter`)
          .outContains(enableCommand.status);
      }
    },
  );
  /*
  pmmTesst(
    'PMM-T9996 - Verify Change agent agent password @node-exporter-integration',
    async ({ cliHelper, page }) => {
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --agent-password=${pgExporterPassword}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorId} --agent-password=${pgExporterPassword}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command));
      // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
      await page.waitForTimeout(Timeouts.TEN_SECONDS);

      const metrics = cliHelper.getMetrics({
        agentPassword: pgExporterPassword,
        dockerContainer: containerName,
        serviceName: serviceName,
      });

      expect(metrics).toContain('pg_up');
    },
  );
  */

  pmmTest(
    'PMM-T9993 - Verify Change agent expose exporter @node-exporter-integration',
    async ({ cliHelper, page }) => {
      nodeExporterPassword = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep ${nodeExporterId} | awk -F' ' '{print $4}'`,
        )
        .stdout.trim();
      nodeExporterPort = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep ${nodeExporterId} | awk -F' ' '{print $5}'`,
        )
        .stdout.trim();
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent node-exporter ${nodeExporterId} --expose-exporter`,
        )
        .assertSuccess()
        .outContains('- enabled expose exporter');
      // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
      await page.waitForTimeout(Timeouts.ONE_MINUTE);
      await cliHelper
        .execSilent(
          `docker exec pmm-server curl -u pmm:${nodeExporterPassword} http://${containerName}:${nodeExporterPort}/metrics`,
        )
        .assertSuccess()
        .outContains('node_exporter_build_info');
    },
  );

  pmmTest(
    'PMM-T9993 - Verify Change agent push metrics @node-exporter-integration',
    async ({ cliHelper, page }) => {
      nodeExporterPort = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep ${nodeExporterId} | awk -F' ' '{print $5}'`,
        )
        .stdout.trim();
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent node-exporter ${nodeExporterId} --push-metrics`,
        )
        .assertSuccess()
        .outContains('- enabled push metrics');

      // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
      await page.waitForTimeout(Timeouts.ONE_MINUTE);
      await cliHelper
        .execSilent(
          `docker exec pmm-server curl -u pmm:${nodeExporterPassword} http://${containerName}:${nodeExporterPort}/metrics`,
        )
        .assertSuccess()
        .outContains('pg_up');
      await cliHelper
        .execSilent(
          `docker exec ${containerName} cat /var/log/pmm-agent.log | grep vmagent | tail -20 | grep error`,
        )
        .outEquals('');
      await cliHelper
        .execSilent(`docker exec ${containerName} pmm-admin list | grep ${nodeExporterId}`)
        .outContains('Running');
    },
  );
  /*
  pmmTesst(
    'PMM-T9993 - Verify Change agent disable collectors @node-exporter-integration',
    async ({ cliHelper }) => {
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --disable-collectors=stat_statements,locks`,
        )
        .assertSuccess()
        .outContains('- updated disabled collectors: [stat_statements locks]');
    },
  );

  pmmTesst(
    'PMM-T9993 - Verify Change agent max exporter connections @node-exporter-integration',
    async ({ cliHelper, page }) => {
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --max-exporter-connections=10`,
        )
        .assertSuccess()
        .outContains('- changed max exporter connections to 10');

      // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
      await page.waitForTimeout(Timeouts.FIVE_SECONDS);
      await cliHelper
        .execSilent(`docker exec ${containerName} ps aux | grep postgres_exporter | grep -v grep`)
        .assertSuccess()
        .outContains('--max-connections=10');
    },
  );

  pmmTesst(
    'PMM-T9993 - Verify Change agent pmm agent listen port @node-exporter-integration',
    async ({ cliHelper }) => {
      let commands = [
        `docker exec ${containerName} sed -i 's/listen-port: 7777/listen-port: 7778/' /usr/local/percona/pmm/config/pmm-agent.yaml`,
        `docker restart ${containerName}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --pmm-agent-listen-port=7778`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorId} --pmm-agent-listen-port=7778`,
      ];
      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
    },
  );*/
});

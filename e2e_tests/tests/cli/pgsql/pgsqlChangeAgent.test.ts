import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';
import * as fs from 'node:fs';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial', retries: 0 });

  const newUsername = 'new_pmmm_username';
  const newPassword = 'new_pmm_user_password';
  let containerName: string;
  let pgVersion: string;
  let serviceName: string;
  let serviceId: string;
  let socketServiceId: string;
  let pgExporterId: string;
  let pgExporterPort: string;
  let pgStatMonitorId: string;
  let pgExporterSocketId: string;
  let pgStatMonitorSocketId: string;

  pmmTest.beforeAll(async ({ cliHelper }) => {
    containerName = cliHelper.execSilent(`docker ps --format '{{.Names}}' | grep pdpgsql`).stdout.trim();
    pgVersion = containerName.match(/\d+/)?.[0] ?? '';
    serviceName = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep pdpgsql_pmm | head -1 | awk -F' ' '{print $2}'`,
      )
      .stdout.trim();
    serviceId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep pdpgsql_pmm | head -1 | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    socketServiceId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep socket_pdpgsql_pmm | head -1 | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    pgExporterId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep postgres_exporter | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    pgStatMonitorId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep postgresql_pgstatmonitor_agent | awk -F' ' '{print $3}'`,
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
      .stdout.trim();
  });

  pmmTest.skip(
    'PMM-T9991 - Verfiy Change agent username and password @pgsm-pmm-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      let commands = [
        `docker exec ${containerName} psql -U postgres -c "CREATE ROLE ${newUsername} WITH LOGIN PASSWORD '${newPassword}-Wrong';"`,
        `docker exec ${containerName} pg_ctlcluster ${pgVersion} main restart`,
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --password=${newPassword} --username=${newUsername}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorId} --password=${newPassword} --username=${newUsername}`,
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterSocketId} --password=${newPassword} --username=${newUsername}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorSocketId} --password=${newPassword} --username=${newUsername}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Down', Timeouts.ONE_MINUTE);

      commands = [
        `docker exec ${containerName} psql -U postgres -c "ALTER USER ${newUsername} WITH PASSWORD '${newPassword}';"`,
        `docker exec ${containerName} pg_ctlcluster ${pgVersion} main restart`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.ONE_MINUTE);
    },
  );

  pmmTest(
    'PMM-T9992 - Verfiy Change agent custom labels @pgsm-pmm-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --custom-labels=env=qa_testing_pgexporter`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorId} --custom-labels=env=qa_testing_pgstatmonitor`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(pgExporterId);
      await expect(agentsPage.builders.property('env=qa_testing_pgexporter')).toBeVisible();
      await agentsPage.hideRowDetails(pgExporterId);
      await agentsPage.showRowDetails(pgStatMonitorId);
      await expect(agentsPage.builders.property('env=qa_testing_pgstatmonitor')).toBeVisible();
    },
  );

  pmmTest(
    'PMM-T9993 - Verify Change agent log level @pgsm-pmm-integration',
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
    },
  );

  pmmTest(
    'PMM-T9993 - Verify Change agent debug, trace and json @pgsm-pmm-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --debug --trace --json`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorId} --debug --trace --json`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
    },
  );

  pmmTest.skip(
    'PMM-T9994 - Verify Change agent tls @pgsm-pmm-integration',
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

      commands.forEach((command) => console.log(command));
      commands.forEach((command) => cliHelper.execSilent(command));
      await servicesPage.waitForServiceMonitoring(serviceName, 'OK', Timeouts.TWO_MINUTES);
    },
  );

  pmmTest(
    'PMM-T9995 - Verify Change agent enable true/false @pgsm-pmm-integration',
    async ({ cliHelper, page }) => {
      const enableCommands = [
        { command: '--enable=false', response: '- disabled agent', status: 'Done (disabled)' },
        { command: '--enable=true', response: '- enabled agent', status: 'Running' },
        { command: '--enable=false', response: '- disabled agent', status: 'Done (disabled)' },
        { command: '--enable', response: '- enabled agent', status: 'Running' },
      ];

      for (const enableCommand of enableCommands) {
        const commands = [
          `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} ${enableCommand.command}`,
          `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorId} ${enableCommand.command}`,
        ];

        for (const command of commands) {
          await cliHelper.execSilent(command).assertSuccess().outContains(enableCommand.response);
        }

        // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for the agents to be enabled/disabled
        await page.waitForTimeout(Timeouts.TEN_SECONDS);

        await cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin list | grep postgres_exporter | grep ${serviceId}`,
          )
          .outContains(enableCommand.status);
        await cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin list | grep postgresql_pgstatmonitor_agent | grep ${serviceId}`,
          )
          .outContains(enableCommand.status);
      }
    },
  );

  pmmTest(
    'PMM-T9996 - Verify Change agent agent password @pgsm-pmm-integration',
    async ({ cliHelper, page }) => {
      const password = 'newAgentPassword';
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --agent-password=${password}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorId} --agent-password=${password}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command));

      await page.waitForTimeout(Timeouts.TEN_SECONDS);

      cliHelper
        .getMetrics({
          agentPassword: password,
          dockerContainer: containerName,
          serviceName: serviceName,
        })
        .includes('pg_up');
    },
  );

  pmmTest('PMM-T9993 - Verify Change agent expose exporter @pgsm-pmm-integration', async ({ cliHelper }) => {
    pgExporterPort = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${pgExporterId} | awk -F' ' '{print $6}'`,
      )
      .stdout.trim();

    console.log(
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --expose-exporter`,
        )
        .assertSuccess()
        .outContains('- enabled expose exporter'),
    );

    await cliHelper
      .execSilent(
        `docker exec pmm-server curl -u pmm:${pgExporterId} http://${containerName}:${pgExporterPort}/metrics`,
      )
      .assertSuccess()
      .outContains('pg_up');
  });

  pmmTest(
    'PMM-T9993 - Verify Change agent disable collectors @pgsm-pmm-integration',
    async ({ cliHelper }) => {
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --disable-collectors=stat_statements,locks`,
        )
        .assertSuccess()
        .outContains('- updated disabled collectors: [stat_statements locks]');
    },
  );

  pmmTest.skip(
    'PMM-T9993 - Verify Change agent pmm agent listen port @pgsm-pmm-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
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
  );
});

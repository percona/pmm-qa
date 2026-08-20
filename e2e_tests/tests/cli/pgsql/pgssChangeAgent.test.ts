import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';
import * as fs from 'node:fs';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  const newUsername = 'new_pmmm_username';
  const newPassword = 'new_pmm_user_password';
  let containerName: string;
  let pgVersion: string;
  let serviceName: string;
  let serviceId: string;
  let pgExporterId: string;
  let pgStatementsId: string;
  const pgExporterPassword = 'newAgentPassword';

  pmmTest.beforeAll(async ({ cliHelper }) => {
    containerName = cliHelper.execSilent(`docker ps --format '{{.Names}}' | grep '^pgsql'`).stdout.trim();
    pgVersion = containerName.match(/\d+/)?.[0] ?? '';
    serviceName = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep pgsql_ | head -1 | awk -F' ' '{print $2}'`,
      )
      .stdout.trim();
    serviceId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep pgsql_ | head -1 | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    pgExporterId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep postgres_exporter | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    pgStatementsId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep postgresql_pgstatements_agent | awk -F' ' '{print $3}'`,
      )
      .stdout.trim();
  });

  pmmTest.afterAll(async ({ cliHelper }) => {
    cliHelper.execSilent(`docker exec ${containerName} psql -U postgres -c "DROP ROLE ${newUsername};"`);
  });

  pmmTest(
    'PMM-T2270 - Verify pmm-admin inventory change agent flags username and password @pgss-pmm-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      let commands = [
        `docker exec ${containerName} psql -U postgres -c "CREATE ROLE ${newUsername} WITH LOGIN PASSWORD '${newPassword}-Wrong';"`,
        `docker exec ${containerName} pg_ctlcluster ${pgVersion} main restart`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      const passwordCommands = [
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --password=${newPassword} --username=${newUsername}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatements-agent ${pgStatementsId} --password=${newPassword} --username=${newUsername}`,
      ];

      passwordCommands.forEach((command) =>
        cliHelper.execSilent(command).outContains('password authentication failed for user'),
      );

      commands = [
        `docker exec ${containerName} psql -U postgres -c "ALTER USER ${newUsername} WITH PASSWORD '${newPassword}';"`,
        `docker exec ${containerName} pg_ctlcluster ${pgVersion} main restart`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
      passwordCommands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.ONE_MINUTE);
      await expect(async () => {
        const metrics = cliHelper.getMetrics({
          agentPassword: pgExporterId,
          dockerContainer: containerName,
          serviceName: serviceName,
        });

        expect(metrics).toContain('pg_up');
      }).toPass({
        intervals: [Timeouts.TWO_SECONDS],
        timeout: Timeouts.ONE_MINUTE,
      });
    },
  );

  pmmTest(
    'PMM-T2271 - Verify pmm-admin inventory change agent flag custom labels @pgss-pmm-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --custom-labels=env=qa_testing_pgexporter`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatements-agent ${pgStatementsId} --custom-labels=env=qa_testing_pgstatements`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(pgExporterId);
      await expect(agentsPage.builders.property('env=qa_testing_pgexporter')).toBeVisible();
      await agentsPage.hideRowDetails(pgExporterId);
      await agentsPage.showRowDetails(pgStatementsId);
      await expect(agentsPage.builders.property('env=qa_testing_pgstatements')).toBeVisible();
    },
  );

  pmmTest(
    'PMM-T2272 - Verify pmm-admin inventory change agent flag log-level, debug, trace and json @pgss-pmm-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      let commands = [
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --log-level=debug`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatements-agent ${pgStatementsId} --log-level=debug`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(pgExporterId);
      await expect(agentsPage.builders.property('log_level=LOG_LEVEL_DEBUG')).toBeVisible();
      await agentsPage.hideRowDetails(pgExporterId);
      await agentsPage.showRowDetails(pgStatementsId);
      await expect(agentsPage.builders.property('log_level=LOG_LEVEL_DEBUG')).toBeVisible();

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --debug --trace --json`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatements-agent ${pgStatementsId} --debug --trace --json`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
    },
  );

  pmmTest(
    'PMM-T2273 - Verify pmm-admin inventory change agent flags for tls @pgss-pmm-integration',
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

      cliHelper.execSilent(`docker cp /tmp/ssl.conf ${containerName}:/tmp/ssl.conf`).assertSuccess();
      cliHelper.execSilent(`docker exec ${containerName} bash -c "cat /tmp/ssl.conf >> ${confPath}"`).assertSuccess();

      const hbaPath = `/etc/postgresql/${pgVersion}/main/pg_hba.conf`;
      const hbaLines = `hostssl      all             all             127.0.0.1/32    scram-sha-256
        hostssl      all             all             ::1/128         scram-sha-256
        hostssl      all             all             0.0.0.0/0       scram-sha-256
        hostssl      all             all             ::/0            scram-sha-256
      `;

      fs.writeFileSync('/tmp/hba.conf', hbaLines);
      cliHelper.execSilent(`docker cp /tmp/hba.conf ${containerName}:${hbaPath}`).assertSuccess();
      cliHelper.execSilent(`docker exec ${containerName} pg_ctlcluster ${pgVersion} main restart`).assertSuccess();

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceMonitoring(serviceName, 'Failed', Timeouts.ONE_MINUTE);

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --tls-cert-file=/certs/client.crt --tls-key-file=/certs/client.key --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatements-agent ${pgStatementsId} --tls-cert-file=/certs/client.crt --tls-key-file=/certs/client.key --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
      await servicesPage.waitForServiceMonitoring(serviceName, 'OK', Timeouts.TWO_MINUTES);
      await expect(async () => {
        const metrics = cliHelper.getMetrics({
          agentPassword: pgExporterId,
          dockerContainer: containerName,
          serviceName: serviceName,
        });

        expect(metrics).toContain('pg_up');
      }).toPass({
        intervals: [Timeouts.TWO_SECONDS],
        timeout: Timeouts.ONE_MINUTE,
      });
    },
  );

  pmmTest(
    'PMM-T2274 - Verify pmm-admin inventory change agent flag enable @pgss-pmm-integration',
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
          `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatements-agent ${pgStatementsId} ${enableCommand.command}`,
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
            `docker exec ${containerName} pmm-admin list | grep postgresql_pgstatements_agent | grep ${serviceId}`,
          )
          .outContains(enableCommand.status);
      }
    },
  );

  pmmTest(
    'PMM-T2275 - Verify pmm-admin inventory change agent flag agent password @pgss-pmm-integration',
    async ({ cliHelper }) => {
      // const tlsFlags = '--tls-cert-file=/certs/client.crt --tls-key-file=/certs/client.key --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify';

      cliHelper.execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --agent-password=${pgExporterPassword}`,// ${tlsFlags}`,
      ).assertSuccess();

      await expect(async () => {
        const metrics = cliHelper.getMetrics({
          agentPassword: pgExporterPassword,
          dockerContainer: containerName,
          serviceName: serviceName,
        });

        expect(metrics).toContain('pg_up');
      }).toPass({
        intervals: [Timeouts.TWO_SECONDS],
        timeout: Timeouts.ONE_MINUTE,
      });
    },
  );

  pmmTest(
    'PMM-T2276 - Verify pmm-admin inventory change agent flag expose exporter @pgss-pmm-integration',
    async ({ cliHelper }) => {

      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --expose-exporter`,
        )
        .assertSuccess()
        .outContains('- enabled expose exporter');
      await expect(async () => {
        const metrics = cliHelper.getMetrics({
          agentPassword: pgExporterPassword,
          dockerContainer: containerName,
          serviceName: serviceName,
        });

        expect(metrics).toContain('pg_up');
      }).toPass({
        intervals: [Timeouts.TWO_SECONDS],
        timeout: Timeouts.ONE_MINUTE,
      });
    },
  );

  pmmTest(
    'PMM-T2277 - Verify pmm-admin inventory change agent flag push metrics @pgss-pmm-integration',
    async ({ cliHelper }) => {
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --push-metrics`,
        )
        .assertSuccess()
        .outContains('- enabled push metrics');

      await expect(async () => {
        const metrics = cliHelper.getMetrics({
          agentPassword: pgExporterPassword,
          dockerContainer: containerName,
          serviceName: serviceName,
        });

        expect(metrics).toContain('pg_up');
      }).toPass({
        intervals: [Timeouts.TWO_SECONDS],
        timeout: Timeouts.ONE_MINUTE,
      });
      await cliHelper
        .execSilent(
          `docker exec ${containerName} cat /var/log/pmm-agent.log | grep vmagent | tail -20 | grep error`,
        )
        .outEquals('');
      await cliHelper
        .execSilent(`docker exec ${containerName} pmm-admin list | grep ${pgExporterId}`)
        .outContains('Running');
    },
  );

  pmmTest(
    'PMM-T2278 - Verify pmm-admin inventory change agent flag disable collectors @pgss-pmm-integration',
    async ({ cliHelper }) => {
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --disable-collectors=stat_statements,locks`,
        )
        .assertSuccess()
        .outContains('- updated disabled collectors: [stat_statements locks]');
    },
  );

  pmmTest(
    'PMM-T2279 - Verify pmm-admin inventory change agent flag max exporter connections @pgss-pmm-integration',
    async ({ cliHelper }) => {
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --max-exporter-connections=10`,
        )
        .assertSuccess()
        .outContains('- changed max exporter connections to 10');

      await expect(async () => {
        await cliHelper
          .execSilent(`docker exec ${containerName} ps aux | grep postgres_exporter | grep -v grep`)
          .assertSuccess()
          .outContains('--max-connections=10');
      }).toPass({
        intervals: [Timeouts.TWO_SECONDS],
        timeout: Timeouts.ONE_MINUTE,
      });
    },
  );

  pmmTest(
    'PMM-T2280 - Verify pmm-admin inventory change agent flag listen port @pgss-pmm-integration',
    async ({ cliHelper }) => {
      cliHelper
        .execSilent(
          `docker exec ${containerName} sed -i 's/listen-port: [0-9]\\+/listen-port: 7778/' /usr/local/percona/pmm/config/pmm-agent.yaml`,
        )
        .assertSuccess();
      cliHelper.execSilent(`docker restart ${containerName}`).assertSuccess();

      await expect(async () => {
        cliHelper
          .execSilent(
            `docker exec ${containerName} bash -c 'nohup pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml >> /var/log/pmm-agent.log 2>&1 &'`,
          )
          .assertSuccess();
      }).toPass({
        intervals: [Timeouts.TWO_SECONDS],
        timeout: Timeouts.THIRTY_SECONDS,
      });

      await expect(async () => {
        cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --pmm-agent-listen-port=7778`,
          )
          .assertSuccess();
      }).toPass({
        intervals: [Timeouts.TWO_SECONDS],
        timeout: Timeouts.ONE_MINUTE,
      });

      await expect(async () => {
        cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatements-agent ${pgStatementsId} --pmm-agent-listen-port=7778`,
          )
          .assertSuccess();
      }).toPass({
        intervals: [Timeouts.TWO_SECONDS],
        timeout: Timeouts.ONE_MINUTE,
      });
    },
  );
});
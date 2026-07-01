import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { ServiceStatus } from '@pages/inventory/services.page';
import { expect } from '@playwright/test';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial', retries: 0 });

  const newUsername = 'new_pmmm_username';
  const newPassword = 'new_pmm_user_password';
  let containerName: string;
  let pgVersion: string;
  let serviceName: string;
  let serviceId: string;
  let pgExporterId: string;
  let pgStatMonitorId: string;

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
  });

  pmmTest(
    'PMM-T9991 - Verfiy Change agent username and password @pgsm-pmm-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      const user = cliHelper.execSilent(
        `docker exec ${containerName} psql -U postgres -c "CREATE ROLE ${newUsername} WITH LOGIN PASSWORD '${newPassword}-Wrong';"`,
      );

      console.log(user.stdout);
      cliHelper.execSilent(`docker exec ${containerName} pg_ctlcluster ${pgVersion} main restart`);

      const changeUser = cliHelper.execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --password=${newPassword} --username=${newUsername}`,
      );

      console.log(changeUser.stdout);
      cliHelper.execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorId} --password=${newPassword} --username=${newUsername}`,
      );

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, ServiceStatus.DOWN, Timeouts.ONE_MINUTE);

      cliHelper.execSilent(
        `docker exec ${containerName} psql -U postgres -c "ALTER USER ${newUsername} WITH PASSWORD '${newPassword}';"`,
      );
      cliHelper.execSilent(`docker exec ${containerName} pg_ctlcluster ${pgVersion} main restart`);

      await servicesPage.waitForServiceStatus(serviceName, ServiceStatus.UP, Timeouts.ONE_MINUTE);
    },
  );

  pmmTest(
    'PMM-T9992 - Verfiy Change agent custom labels @pgsm-pmm-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      cliHelper.execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --custom-labels=env=qa_testing_pgexporter`,
      );
      cliHelper.execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorId} --custom-labels=env=qa_testing_pgstatmonitor`,
      );

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
      cliHelper.execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --log-level=debug`,
      );
      cliHelper.execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorId} --log-level=debug`,
      );

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
    'PMM-T9994 - Verify Change agent tls @pgsm-pmm-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      cliHelper.createTlsCertificates(containerName);
      console.log('Pki folder content is:');
      console.log(cliHelper.execSilent(`docker exec ${containerName} ls /easy-rsa/easyrsa3/pki`));

      cliHelper.execSilent(
        `docker exec ${containerName} cp /easy-rsa/easyrsa3/pki/private/${containerName}.key /certs/${containerName}.key`,
      );
      cliHelper.execSilent(
        `docker exec ${containerName} cp /easy-rsa/easyrsa3/pki/issued/${containerName}.crt /certs/${containerName}.crt`,
      );
      cliHelper.execSilent(
        `docker exec ${containerName} cat /easy-rsa/easyrsa3/pki/private/pmm-test.key > /certs/client.key`,
      );
      cliHelper.execSilent(
        `docker exec ${containerName} cat /easy-rsa/easyrsa3/pki/issued/pmm-test.crt > /certs/client.crt`,
      );
      cliHelper.execSilent(
        `docker exec ${containerName} cp /easy-rsa/easyrsa3/pki/ca.crt /certs/ca-certs.pem`,
      );
      cliHelper.execSilent(`docker exec ${containerName} chmod 600 /certs/ ${containerName}.key`);
      cliHelper.execSilent(`docker exec ${containerName} chmod 600 /certs/ ${containerName}.crt`);
      cliHelper.execSilent(`docker exec ${containerName} chown -R postgres:postgres /certs`);
      cliHelper.execSilent(
        `docker exec ${containerName} bash -c "printf 'ssl = on\\nssl_cert_file = \\'/certs/pgsql_pgss_pmm_17.crt\\'\\nssl_key_file = \\'/certs/pgsql_pgss_pmm_17.key\\'\\n' >> /etc/postgresql/${pgVersion}/main/postgresql.conf"`,
      );
      console.log(
        cliHelper.execSilent(
          `docker exec ${containerName} cat /etc/postgresql/${pgVersion}/main/postgresql.conf`,
        ),
      );
      // cliHelper.execSilent(`docker exec ${containerName}`);
      // cliHelper.execSilent(`docker exec ${containerName}`);
      // cliHelper.execSilent(`docker exec ${containerName}`);
      // cliHelper.execSilent(`docker exec ${containerName}`);
      // cliHelper.execSilent(`docker exec ${containerName}`);
      // cliHelper.execSilent(`docker exec ${containerName}`);
      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(pgExporterId);
      await expect(agentsPage.builders.property('log_level=LOG_LEVEL_DEBUG')).toBeVisible();
      await agentsPage.hideRowDetails(pgExporterId);
      await agentsPage.showRowDetails(pgStatMonitorId);
      await expect(agentsPage.builders.property('log_level=LOG_LEVEL_DEBUG')).toBeVisible();
    },
  );
});

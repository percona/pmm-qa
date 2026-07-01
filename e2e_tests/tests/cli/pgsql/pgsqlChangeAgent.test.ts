import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { ServiceStatus } from '@pages/inventory/services.page';
import { expect } from '@playwright/test';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ retries: 0 });

  pmmTest.afterEach(async ({ cliHelper }) => {
    const containerName = cliHelper
      .execSilent(`docker ps --format '{{.Names}}' | grep pdpgsql`)
      .stdout.trim();

    cliHelper.execSilent(
      `docker exec ${containerName} psql -U postgres -c "ALTER USER pmm WITH PASSWORD 'GRgrO9301RuF';"`,
    );
  });

  pmmTest(
    'PMM-T9991 @pgsm-pmm-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page, servicesPage }) => {
      const newPassword = 'new_password_change_agent';
      const containerName = cliHelper
        .execSilent(`docker ps --format '{{.Names}}' | grep pdpgsql`)
        .stdout.trim();
      const pgVersion: string = containerName.match(/\d+/)?.[0] ?? '';
      const serviceName = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep pdpgsql_pmm | head -1 | awk -F' ' '{print $2}'`,
        )
        .stdout.trim();
      const serviceId = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep pdpgsql_pmm | head -1 | awk -F' ' '{print $4}'`,
        )
        .stdout.trim();
      const pgExporterId = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep postgres_exporter | awk -F' ' '{print $4}'`,
        )
        .stdout.trim();
      const pgStatMonitorId = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep postgresql_pgstatmonitor_agent | awk -F' ' '{print $3}'`,
        )
        .stdout.trim();

      cliHelper.execSilent(
        `docker exec ${containerName} psql -U postgres -c "ALTER USER pmm WITH PASSWORD '${newPassword}';"`,
      );
      cliHelper.execSilent(`docker exec ${containerName} pg_ctlcluster ${pgVersion} main restart`);

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, ServiceStatus.DOWN, Timeouts.ONE_MINUTE);

      cliHelper.execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${pgExporterId} --password=${newPassword} --custom-labels=env=qa_testing_pgexporter`,
      );
      cliHelper.execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent qan-postgresql-pgstatmonitor-agent ${pgStatMonitorId} --password=${newPassword} --custom-labels=env=qa_testing_pgstatmonitor`,
      );

      await servicesPage.waitForServiceStatus(serviceName, ServiceStatus.UP, Timeouts.ONE_MINUTE);
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(pgExporterId);
      await expect(agentsPage.builders.property('env=qa_testing_pgexporter')).toBeVisible();
      await agentsPage.hideRowDetails(pgExporterId);
      await agentsPage.showRowDetails(pgStatMonitorId);
      await expect(agentsPage.builders.property('env=qa_testing_pgstatmonitor')).toBeVisible();
    },
  );
});

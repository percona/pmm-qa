import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { ServiceStatus } from '@pages/inventory/services.page';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest('PMM-T9991 @pgsm-pmm-integration', async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
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

    console.log(cliHelper.execSilent(`docker exec ${containerName} pmm-admin list'`).stdout);
    console.log(`Container name is: ${containerName}`);
    console.log(`Service name is: ${serviceName}`);
    console.log(`Service ID is: ${serviceId}`);
    cliHelper.execSilent(
      `docker exec ${containerName} psql -U postgres -c "ALTER USER pmm WITH PASSWORD '${newPassword}';"`,
    );

    const restart = cliHelper.execSilent(
      `docker exec ${containerName} pg_ctlcluster ${pgVersion} main restart`,
    );

    console.log(`Restart response: ${restart.stdout}`);
    await grafanaHelper.authorize();
    await page.goto(servicesPage.url);
    await servicesPage.waitForServiceStatus(serviceName, ServiceStatus.DOWN, Timeouts.ONE_MINUTE);
  });
});

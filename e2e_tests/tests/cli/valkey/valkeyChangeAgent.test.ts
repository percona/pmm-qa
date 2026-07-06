import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  const valkeyPort = '6379';
  const valkeyPassword = 'VKvl41568AsE';
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
  const pgExporterPassword = 'newAgentPassword';

  pmmTest.beforeAll(async ({ cliHelper }) => {
    containerName = cliHelper
      .execSilent(`docker ps --format '{{.Names}}' | grep valkey-primary-1`)
      .stdout.trim();
    console.log(`Container name is: ${containerName}`);
    // pgVersion = containerName.match(/\d+/)?.[0] ?? '';
    serviceName = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep valkey-primary | head -1 | awk -F' ' '{print $2}'`,
      )
      .stdout.trim();
    console.log(`Service name is: ${serviceName}`);
    serviceId = cliHelper.execSilent(
      `docker exec ${containerName} pmm-admin list | grep valkey | head -1 | awk -F' ' '{print $4}'`,
    ).stdout.trim();
    console.log(`Service ID is: ${serviceId}`);
    pgExporterId = cliHelper.execSilent(
      `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep valkey_exporter | awk -F' ' '{print $4}'`,
    ).stdout.trim();
    console.log(`Valkey exporter id is: ${pgExporterId}`);
    // pgStatMonitorId = cliHelper
    //   .execSilent(
    //     `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep postgresql_pgstatmonitor_agent | awk -F' ' '{print $3}'`,
    //   )
    //   .stdout.trim();
    // pgExporterSocketId = cliHelper
    //   .execSilent(
    //     `docker exec ${containerName} pmm-admin list | grep ${socketServiceId} | grep postgres_exporter | awk -F' ' '{print $4}'`,
    //   )
    //   .stdout.trim();
    // pgStatMonitorSocketId = cliHelper
    //   .execSilent(
    //     `docker exec ${containerName} pmm-admin list | grep ${socketServiceId} | grep postgresql_pgstatmonitor_agent | awk -F' ' '{print $3}'`,
    //   )
    //   .stdout.trim();
  });

  pmmTest(
    'PMM-T9991 - Verfiy Change agent username and password @valkey-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      let commands = [
        `docker exec ${containerName} valkey-cli -h 127.0.0.1 -p ${valkeyPort} -a ${valkeyPassword} ACL SETUSER ${newUsername} on '${newPassword}-wrong' '~*' '&*' +@all`,
        `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${pgExporterId} --password=${newPassword} --username=${newUsername}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Down', Timeouts.TWO_MINUTES);

      commands = [
        `docker exec ${containerName} valkey-cli -h 127.0.0.1 -p ${valkeyPort} -a ${valkeyPassword} ACL SETUSER ${newUsername} '${newPassword}'`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.TWO_MINUTES);
    },
  );
});

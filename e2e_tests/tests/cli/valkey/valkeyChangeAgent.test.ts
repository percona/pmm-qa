import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

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
  let valkeyExporterId: string;
  let pgExporterPort: string;
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
    valkeyExporterId = cliHelper.execSilent(
      `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep valkey_exporter | awk -F' ' '{print $4}'`,
    ).stdout.trim();
    console.log(`Valkey exporter id is: ${valkeyExporterId}`);
  });

  pmmTest(
    'PMM-T9991 - Verfiy Change agent username and password @valkey-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      let commands = [
        `docker exec ${containerName} valkey-cli -h 127.0.0.1 -p ${valkeyPort} -a ${valkeyPassword} ACL SETUSER ${newUsername} on '${newPassword}-wrong' '~*' '&*' +@all`,
        `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --password=${newPassword} --username=${newUsername}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Down', Timeouts.TWO_MINUTES);

      commands = [
        `docker exec ${containerName} valkey-cli -h 127.0.0.1 -p ${valkeyPort} -a ${valkeyPassword} ACL SETUSER ${newUsername} on '>${newPassword}' '~*' '&*' +@all`,
      ];

      commands.forEach((command) => console.log(cliHelper.execSilent(command)));

      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.TWO_MINUTES);
    },
  );

  pmmTest(
    'PMM-T99922 - Verfiy Change agent custom labels @valkey-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const customLabel = 'env=qa_testing_valkey_exporter';

      console.log(cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --custom-labels=${customLabel}`,
        )
        .assertSuccess());
      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(valkeyExporterId);
      await expect(agentsPage.builders.property(customLabel)).toBeVisible();
      await agentsPage.hideRowDetails(valkeyExporterId);
    },
  );

  pmmTest(
    'PMM-T9993 - Verify Change agent log level @valkey-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --log-level=debug`,
        )
        .assertSuccess();
      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(valkeyExporterId);
      await expect(agentsPage.builders.property('log_level=LOG_LEVEL_DEBUG')).toBeVisible();
      await agentsPage.hideRowDetails(valkeyExporterId);
    },
  );

  pmmTest(
    'PMM-T9993 - Verify Change agent debug, trace and json @valkey-integration',
    async ({ cliHelper }) => {
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --debug --trace --json`,
        )
        .assertSuccess();
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
        await cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin inventory change agent postgres-exporter ${valkeyExporterId} ${enableCommand.command}`,
          )
          .assertSuccess()
          .outContains(enableCommand.response);

        // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for the agents to be enabled/disabled
        await page.waitForTimeout(Timeouts.TEN_SECONDS);

        await cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin list | grep postgres_exporter | grep ${serviceId}`,
          )
          .outContains(enableCommand.status);
      }
    },
  );
});

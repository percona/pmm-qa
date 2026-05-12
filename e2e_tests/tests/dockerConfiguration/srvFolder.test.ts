import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.describe('Test for SRV folder in pmm server.', () => {
  pmmTest.describe.configure({ retries: 0 });

  const newUser = 'newuser';
  const newPassword = 'newpass';
  const basePmmUrl = 'http://127.0.0.1:81/';
  const folderConfiguration = [
    {
      command: `sudo mkdir -p $HOME/srv && sudo chown -R 1000:0 $HOME/srv && docker run --detach --restart always --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 -e GF_SECURITY_ADMIN_USER=${newUser} -e GF_SECURITY_ADMIN_PASSWORD=${newPassword} --publish 81:8080 --publish 444:8443 --volume "$HOME/srv":/srv --name pmm-server-srv perconalab/pmm-server-fb:PR-4295-ff823af`,
      testName: 'local folder',
    },
    {
      command: `docker run --detach --restart always --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 -e GF_SECURITY_ADMIN_USER=${newUser} -e GF_SECURITY_ADMIN_PASSWORD=${newPassword} --publish 81:8080 --publish 444:8443' --volume pmm-volume:/srv --name pmm-server-srv perconalab/pmm-server-fb:PR-4295-ff823af`,
      testName: 'docker volume',
    },
  ];

  pmmTest.afterEach(({ cliHelper }) => {
    cliHelper.execSilent(`docker stop pmm-server-srv && docker rm -fr pmm-server-srv`);
  });

  for (const configuration of folderConfiguration) {
    pmmTest(
      `PMM-T1255 + PMM-T1279 - Verify GF_SECURITY_ADMIN_PASSWORD environment variable also with changed admin credentials using ${configuration.testName} @docker-configuration`,
      async ({ cliHelper, dashboard, grafanaHelper, page, urlHelper }) => {
        const runServer = cliHelper.execSilent(configuration.command);

        console.log(runServer.stdout);

        // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for server to start
        await page.waitForTimeout(Timeouts.TWENTY_SECONDS);

        const logs = cliHelper.execSilent('docker logs pmm-server-srv').stdout;

        console.log(logs);

        expect(logs).not.toContain(
          'Configuration warning: unknown environment variable "GF_SECURITY_ADMIN_PASSWORD=newpass"',
        );

        await grafanaHelper.authorize('admin', 'admin', basePmmUrl);
        await page.goto(urlHelper.buildUrlWithParameters(dashboard.home.url, {}));
        await page
          .locator('//h1[text()="Percona Monitoring and Management"]')
          .waitFor({ state: 'visible', timeout: Timeouts.TEN_SECONDS });
        await grafanaHelper.unAuthorize();

        // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for un-authorization
        await page.waitForTimeout(Timeouts.FIVE_SECONDS);

        await grafanaHelper.authorize(newUser, newPassword, basePmmUrl);
        await page.goto(urlHelper.buildUrlWithParameters(dashboard.home.url, {}));
        await dashboard.home.elements.headerLocator.waitFor({
          state: 'visible',
          timeout: Timeouts.TEN_SECONDS,
        });

        await grafanaHelper.unAuthorize();
        cliHelper.execSilent('docker exec pmm-server-srv change-admin-password anotherpass');

        // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for password change
        await page.waitForTimeout(Timeouts.TEN_SECONDS);
        await grafanaHelper.authorize(newUser, 'anotherpass', basePmmUrl);
        await page.goto(urlHelper.buildUrlWithParameters(dashboard.home.url, {}));
        await dashboard.home.elements.headerLocator.waitFor({
          state: 'visible',
          timeout: Timeouts.TEN_SECONDS,
        });
      },
    );
  }
});

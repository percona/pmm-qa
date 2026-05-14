import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import data from '@fixtures/dataTest';

pmmTest.describe('Test for SRV folder in pmm server.', () => {
  // pmmTest.describe.configure({ retries: 0 });
  // This suite spins up a separate PMM server on port 81, so override the
  // global baseURL only for the tests in this describe block.
  pmmTest.use({ baseURL: 'http://127.0.0.1:81/' });

  const newUser = 'newuser';
  const newPassword = 'newpass';
  const folderConfiguration = [
    {
      command: `sudo mkdir -p $HOME/srv && sudo chown -R 1000:0 $HOME/srv && docker run --detach --restart always --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 -e GF_SECURITY_ADMIN_USER=${newUser} -e GF_SECURITY_ADMIN_PASSWORD=${newPassword} --publish 81:8080 --publish 444:8443 --volume "$HOME/srv":/srv --name pmm-server-srv perconalab/pmm-server-fb:PR-4295-ff823af`,
      testName: 'local folder',
    },
    {
      command: `docker run --detach --restart always --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 -e GF_SECURITY_ADMIN_USER=${newUser} -e GF_SECURITY_ADMIN_PASSWORD=${newPassword} --publish 81:8080 --publish 444:8443 --volume pmm-volume:/srv --name pmm-server-srv perconalab/pmm-server-fb:PR-4295-ff823af`,
      testName: 'docker volume',
    },
  ];

  pmmTest.afterEach(({ cliHelper }) => {
    cliHelper.execSilent(`docker stop pmm-server-srv && docker rm -fr pmm-server-srv`);
  });

  data(folderConfiguration).pmmTest(
    `PMM-T1255 + PMM-T1279 - Verify GF_SECURITY_ADMIN_PASSWORD environment variable also with changed admin credentials using srv folder or docker volume @docker-configuration`,
    async (data, { cliHelper, dashboard, grafanaHelper, page, urlHelper }) => {
      cliHelper.execSilent(data.command);

      // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for server to start
      await page.waitForTimeout(Timeouts.TWENTY_SECONDS);

      const logs = cliHelper.execSilent('docker logs pmm-server-srv').stdout;

      expect(logs).not.toContain(
        'Configuration warning: unknown environment variable "GF_SECURITY_ADMIN_PASSWORD=newpass"',
      );

      await grafanaHelper.authorize('admin', 'admin');
      await page.goto(urlHelper.buildUrlWithParameters(dashboard.home.url, {}));
      await page
        .locator('//h1[text()="Percona Monitoring and Management"]')
        .waitFor({ state: 'visible', timeout: Timeouts.TEN_SECONDS });
      await grafanaHelper.unAuthorize();

      // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for un-authorization
      await page.waitForTimeout(Timeouts.FIVE_SECONDS);

      await grafanaHelper.authorize(newUser, newPassword);

      // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for authorization
      await page.waitForTimeout(Timeouts.TWENTY_SECONDS);
      await page.goto(urlHelper.buildUrlWithParameters(dashboard.home.url, {}));
      await dashboard.home.elements.headerLocator.waitFor({
        state: 'visible',
        timeout: Timeouts.TEN_SECONDS,
      });

      await grafanaHelper.unAuthorize();
      cliHelper.execSilent('docker exec pmm-server-srv change-admin-password anotherpass');

      // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for password change
      await page.waitForTimeout(Timeouts.FIVE_SECONDS);
      await grafanaHelper.authorize(newUser, 'anotherpass');
      // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for auth
      await page.waitForTimeout(Timeouts.FIVE_SECONDS);

      const newLogs = cliHelper.execSilent('docker logs pmm-server-srv');

      console.log(newLogs.stdout);
      await page.goto(urlHelper.buildUrlWithParameters(dashboard.home.url, {}));
      await dashboard.home.elements.headerLocator.waitFor({
        state: 'visible',
        timeout: Timeouts.TWENTY_SECONDS,
      });
    },
  );
});

import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import dataTest from '@fixtures/dataTest';

pmmTest.describe('Test for SRV folder in pmm server.', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  const newUser = 'newuser';
  const newPassword = 'newpass';
  const dockerVolumeName = 'pmm-volume-srv';
  const dockerContainerName = 'pmm-server-srv';
  const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
  const srvConfiguration = [
    {
      command: `sudo mkdir -p $HOME/srv && sudo chown -R 1000:0 $HOME/srv && docker run --detach --restart always --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 -e GF_SECURITY_ADMIN_USER=${newUser} -e GF_SECURITY_ADMIN_PASSWORD=${newPassword} --publish 81:8080 --publish 444:8443 --volume "$HOME/srv":/srv --name ${dockerContainerName} ${dockerVersion}`,
      port: 444,
      testName: 'local folder',
    },
    {
      command: `docker volume create ${dockerVolumeName} && docker run --detach --restart always --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 -e GF_SECURITY_ADMIN_USER=${newUser} -e GF_SECURITY_ADMIN_PASSWORD=${newPassword} --publish 82:8080 --publish 445:8443 --volume ${dockerVolumeName}:/srv --name ${dockerContainerName} ${dockerVersion}`,
      port: 445,
      testName: 'docker volume',
    },
  ];

  pmmTest.beforeEach(async ({ cliHelper }) => {
    cliHelper.execSilent(`docker volume rm ${dockerVolumeName} || true`);
    cliHelper.execSilent(`sudo rm -fr $HOME/srv || true`);
  });

  pmmTest.afterEach(async ({ cliHelper }) => {
    console.log('Stoping and removing pmm server');
    console.log(cliHelper.execSilent(`docker stop ${dockerContainerName}`));
    console.log(cliHelper.execSilent(`docker rm -f ${dockerContainerName}`));
  });

  dataTest(srvConfiguration).pmmTest(
    'PMM-T9999 PMM-T1255 + PMM-T1279 - Verify GF_SECURITY_ADMIN_PASSWORD environment variable also with changed admin credentials @docker-configuration ',
    async (data, { cliHelper, dashboard, grafanaHelper, page, urlHelper }) => {
      const baseUrl = `https://65.108.48.166:${data.port}/`;
      const runner = cliHelper.execSilent(data.command);

      console.log(runner);
      // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for server to start
      await page.waitForTimeout(Timeouts.TWENTY_SECONDS);

      const logs = cliHelper.execSilent('docker logs pmm-server-srv').stdout;

      expect(logs).not.toContain(
        'Configuration warning: unknown environment variable "GF_SECURITY_ADMIN_PASSWORD=newpass"',
      );

      console.log(baseUrl);
      console.log(cliHelper.execute('docker ps -a'));
      console.log(cliHelper.execSilent('docker logs pmm-server-srv'));

      await grafanaHelper.authorize('admin', 'admin', baseUrl);
      await page.goto(urlHelper.buildUrlWithParameters(baseUrl + dashboard.home.url, {}), {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await page
        .locator('//h1[text()="Percona Monitoring and Management"]')
        .waitFor({ state: 'visible', timeout: Timeouts.TEN_SECONDS });

      await grafanaHelper.unAuthorize();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for un-authorization
      await page.waitForTimeout(Timeouts.FIVE_SECONDS);
      await grafanaHelper.authorize(newUser, newPassword, baseUrl);

      // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for authorization
      await page.waitForTimeout(Timeouts.FIVE_SECONDS);
      await page.goto(urlHelper.buildUrlWithParameters(baseUrl + dashboard.home.url, {}));
      await dashboard.home.elements.homeDashboardLocator.waitFor({
        state: 'visible',
        timeout: Timeouts.TWENTY_SECONDS,
      });

      await grafanaHelper.unAuthorize();
      cliHelper.execSilent('docker exec pmm-server-srv change-admin-password anotherpass');
      // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for password change
      await page.waitForTimeout(Timeouts.FIVE_SECONDS);
      await grafanaHelper.authorize(newUser, 'anotherpass', baseUrl);
      // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for auth
      await page.waitForTimeout(Timeouts.FIVE_SECONDS);
      await page.goto(urlHelper.buildUrlWithParameters(baseUrl + dashboard.home.url, {}));
      await dashboard.home.elements.homeDashboardLocator.waitFor({
        state: 'visible',
        timeout: Timeouts.TWENTY_SECONDS,
      });
    },
  );
});

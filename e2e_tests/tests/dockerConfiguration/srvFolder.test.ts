import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const newUser = 'newuser';
const newPassword = 'newpass';
const dockerVolumeName = 'pmm-volume-srv';
const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
const srvConfigurations = [
  {
    command: `sudo mkdir -p $HOME/srv && sudo chown -R 1000:0 $HOME/srv && docker run --detach --restart always --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 -e GF_SECURITY_ADMIN_USER=${newUser} -e GF_SECURITY_ADMIN_PASSWORD=${newPassword} -e PMM_ENABLE_INTERNAL_PG_QAN=1 --publish 444:8443 --volume "$HOME/srv":/srv --name pmm-server-srv-local-folder ${dockerVersion}`,
    containerName: 'pmm-server-srv-local-folder',
    port: 444,
    testName: 'local folder',
  },
  {
    command: `docker volume create ${dockerVolumeName} && docker run --detach --restart always --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 -e GF_SECURITY_ADMIN_USER=${newUser} -e GF_SECURITY_ADMIN_PASSWORD=${newPassword} -e PMM_ENABLE_INTERNAL_PG_QAN=1 --publish 445:8443 --volume ${dockerVolumeName}:/srv --name pmm-server-srv-docker-volume ${dockerVersion}`,
    containerName: 'pmm-server-srv-docker-volume',
    port: 445,
    testName: 'docker volume',
  },
];

for (const configuration of srvConfigurations) {
  pmmTest.describe('Test for SRV folder in pmm server.', () => {
    const baseUrl = `https://127.0.0.1:${configuration.port}/`;

    pmmTest.use({ baseURL: baseUrl });

    pmmTest.beforeEach(async ({ cliHelper }) => {
      cliHelper.execSilent(`docker volume rm ${dockerVolumeName} || true`);
      cliHelper.execSilent(`sudo rm -fr $HOME/srv || true`);
    });

    pmmTest.afterEach(async ({ cliHelper }) => {
      cliHelper.execSilent(`docker stop ${configuration.containerName}`);
      cliHelper.execSilent(`docker rm -f ${configuration.containerName}`);
    });

    pmmTest(
      `PMM-T1255 + PMM-T1279 - Verify GF_SECURITY_ADMIN_PASSWORD environment variable also with changed admin credentials ${configuration.testName} @docker-configuration`,
      async ({ api, cliHelper, dashboard, grafanaHelper, page, qanStoredMetrics, urlHelper }) => {
        cliHelper.execSilent(configuration.command);
        console.log(cliHelper.execSilent(`docker logs ${configuration.containerName} 2>&1`).stdout);
        await api.serverApi.waitForReady(Timeouts.TWO_MINUTES);

        // pmm-managed-init logs its configuration warnings to stderr.
        const logs = cliHelper.execSilent(`docker logs ${configuration.containerName} 2>&1`).stdout;

        expect(logs, 'PMM Server container logs should have been read').toContain("spawned: 'pmm-managed'");
        expect(logs).not.toContain('unknown environment variable GF_SECURITY_ADMIN_PASSWORD');

        expect(logs).not.toContain(
          'Error: The directory named as part of the path /srv/logs/supervisord.log does not exist',
        );

        await grafanaHelper.authorize('admin', 'admin', baseUrl);
        await page.goto(urlHelper.buildUrlWithParameters(baseUrl + dashboard.home.url, {}));
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
          timeout: Timeouts.THIRTY_SECONDS,
        });

        await grafanaHelper.unAuthorize();
        cliHelper.execSilent(`docker exec ${configuration.containerName} change-admin-password anotherpass`);
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

        await page.goto(urlHelper.buildUrlWithParameters(baseUrl + qanStoredMetrics.url, { refresh: '10s' }));
        await qanStoredMetrics.waitForQanStoredMetricsToHaveData(Timeouts.TWO_MINUTES);

        await page.goto(
          urlHelper.buildUrlWithParameters(baseUrl + dashboard.os.nodeSummary.url, { from: 'now-1h' }),
        );

        await dashboard.verifyMetricsPresent(dashboard.os.nodeSummary.metrics);
        await dashboard.verifyAllPanelsHaveData([
          ...dashboard.os.nodeSummary.noDataMetrics,
          'System Uptime',
          'Virtual CPUs',
          'Disk Space',
          'RAM',
          'Virtual Memory',
        ]);
        await dashboard.verifyPanelValues(dashboard.os.nodeSummary.metricsWithData);
      },
    );
  });
}

import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import CliHelper from '@helpers/cli.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
const containerName = 'pmm-server-update-check-offline';
const port = 456;
const baseUrl = `https://127.0.0.1:${port}/`;
// TEST-NET-1 is never routed, so a connection to the version service hangs as it does without Internet access.
const versionServiceHosts = ['check.percona.com', 'check-dev.percona.com']
  .map((host) => `--add-host ${host}:192.0.2.1`)
  .join(' ');

pmmTest.use({ baseURL: baseUrl });

pmmTest.beforeEach(async ({ api, cliHelper, context, grafanaHelper, page }) => {
  // pmmTest mocks the updates endpoint; this test needs the server's real answer.
  await page.unroute(apiEndpoints.server.updates);
  await context.unroute(apiEndpoints.server.updates);
  cliHelper
    .execSilent(
      `docker run --detach --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 -e GF_SECURITY_ADMIN_PASSWORD=${CliHelper.shellQuote(adminPassword)} ${versionServiceHosts} --publish ${port}:8443 --name ${containerName} ${dockerVersion}`,
    )
    .assertSuccess();
  await api.serverApi.waitForReady(Timeouts.FIVE_MINUTES);
  await grafanaHelper.authorize('admin', adminPassword, baseUrl);
});

pmmTest.afterEach(({ cliHelper }) => {
  cliHelper.removeContainer(containerName);
});

pmmTest(
  'PMM-T2862 - Verify Home dashboard loads promptly when PMM Server cannot reach the Percona version service @docker-configuration',
  async ({ dashboard, page, updatesPage }) => {
    await pmmTest.step('Open the Home dashboard once and wait for the Monitored DB Services panel', async () => {
      await page.goto(dashboard.home.url);
      await expect(dashboard.home.elements.monitoredServicesPanel).toBeVisible({
        timeout: Timeouts.TWO_MINUTES,
      });
    });

    // The iframe's body carries the Home dashboard class before Grafana renders any route, so wait for a panel.
    // A fixed server renders it in 4-6 s; an unfixed one holds every route until the update check fails, 30 s or more.
    await pmmTest.step('Reload the Home dashboard: it renders before the update check gives up', async () => {
      const deadline = Date.now() + Timeouts.FIFTEEN_SECONDS;

      await page.reload();
      await expect(dashboard.home.elements.monitoredServicesPanel).toBeVisible({
        timeout: Math.max(deadline - Date.now(), 1),
      });
    });

    await pmmTest.step('The failed update check is reported without an internal server error', async () => {
      await expect(updatesPage.messages.updateCheckFailed).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(updatesPage.messages.internalServerError).toBeHidden();
    });
  },
);

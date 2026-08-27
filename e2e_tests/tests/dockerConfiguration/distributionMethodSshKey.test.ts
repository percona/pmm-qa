import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';

const sshKey =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEtU7ftdqg3rdRcv06kPAOnKX+WRmHlnG2UBpUNKw65h pmm-qa@distribution-method-test';
const amiContainerName = 'pmm-server-distribution-ami';
const amiPort = 450;
const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
// Stamped on the AMI container at creation so it matches what the suite authenticates with.
const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

pmmTest.describe('SSH key settings follow the PMM Server distribution method.', () => {
  pmmTest.beforeEach(async ({ grafanaHelper, page }) => {
    await page.goto('');
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T2282 - Verify the SSH key tab is hidden and its URL redirects on a non-AMI deployment @docker-configuration',
    async ({ api, page, settingsPage }) => {
      await pmmTest.step('Distribution method is reported as Docker', async () => {
        expect(await api.serverApi.getDistributionMethod()).toEqual('DISTRIBUTION_METHOD_DOCKER');
      });

      await pmmTest.step('Settings page offers no SSH key tab', async () => {
        await page.goto(settingsPage.url);

        await expect(settingsPage.tabs.metrics).toHaveAttribute('aria-selected', 'true');
        await expect(settingsPage.tabs.ssh).toHaveCount(0);
      });

      await pmmTest.step('The SSH key URL redirects to the default tab', async () => {
        await page.goto(settingsPage.urls.ssh);

        await expect(settingsPage.tabs.metrics).toHaveAttribute('aria-selected', 'true');
        await expect(page).toHaveURL(new RegExp(`${settingsPage.url}$`));
      });

      await pmmTest.step('The server refuses an SSH key', async () => {
        const settingsBefore = await api.settingsApi.getSettings();
        const response = await page.request.put(apiEndpoints.server.settings, {
          data: { ssh_key: sshKey },
          headers: GrafanaHelper.getAuthHeader(),
        });

        expect(response.status()).toEqual(500);

        const body = (await response.json()) as { message: string };

        expect(body.message).toContain('SSH key can be set only on AMI distribution');

        const settingsAfter = await api.settingsApi.getSettings();

        expect(settingsBefore.settings.ssh_key).toBeUndefined();
        expect(settingsAfter.settings.ssh_key).toBeUndefined();
      });
    },
  );
});

pmmTest.describe('SSH key settings on an AMI deployment.', () => {
  const baseUrl = `https://127.0.0.1:${amiPort}/`;

  pmmTest.use({ baseURL: baseUrl });

  pmmTest.afterEach(async ({ cliHelper }) => {
    cliHelper.execSilent(`docker rm -f ${amiContainerName}`);
  });

  pmmTest(
    'PMM-T2283 - Verify the SSH key tab is available on an AMI deployment @docker-configuration',
    async ({ api, cliHelper, grafanaHelper, page, settingsPage }) => {
      await pmmTest.step('Start a PMM Server that reports the AMI distribution method', async () => {
        cliHelper
          .execSilent(
            `docker run --detach --restart always --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 -e PMM_DISTRIBUTION_METHOD=ami -e GF_SECURITY_ADMIN_PASSWORD=${adminPassword} --publish ${amiPort}:8443 --name ${amiContainerName} ${dockerVersion}`,
          )
          .assertSuccess();
        await api.serverApi.waitForReady(Timeouts.FIVE_MINUTES);

        expect(await api.serverApi.getDistributionMethod()).toEqual('DISTRIBUTION_METHOD_AMI');
      });

      await pmmTest.step('Authorize against the AMI server', async () => {
        await grafanaHelper.authorize('admin', adminPassword, baseUrl);
      });

      await pmmTest.step('Settings page offers the SSH key tab', async () => {
        await page.goto(settingsPage.url);

        await expect(settingsPage.tabs.metrics).toHaveAttribute('aria-selected', 'true');
        await expect(settingsPage.tabs.ssh).toBeVisible();
      });

      await pmmTest.step('The SSH key URL opens the tab instead of redirecting', async () => {
        await page.goto(settingsPage.urls.ssh);

        await expect(settingsPage.tabs.ssh).toHaveAttribute('aria-selected', 'true');
        await expect(page).toHaveURL(new RegExp(`${settingsPage.urls.ssh}$`));
      });
    },
  );
});

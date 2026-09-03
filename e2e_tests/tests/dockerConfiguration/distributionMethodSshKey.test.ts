import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';

pmmTest.describe('SSH key settings are unavailable off an AMI deployment.', () => {
  pmmTest.beforeEach(async ({ grafanaHelper, page }) => {
    await page.goto('');
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T2282 - Verify the SSH key tab is hidden and its URL redirects on a non-AMI deployment @docker-configuration',
    async ({ api, page, settingsPage }) => {
      expect(await api.serverApi.getDistributionMethod()).toEqual('DISTRIBUTION_METHOD_DOCKER');

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
          data: {
            ssh_key:
              'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEtU7ftdqg3rdRcv06kPAOnKX+WRmHlnG2UBpUNKw65h pmm-qa@distribution-method-test',
          },
          headers: GrafanaHelper.getAuthHeader(),
        });

        expect(response.status()).toEqual(500);

        const body = (await response.json()) as { message: string };

        expect(body.message).toContain('SSH key can be set only on AMI distribution');

        const settingsAfter = await api.settingsApi.getSettings();

        expect(settingsBefore.settings.ssh_key).toEqual('');
        expect(settingsAfter.settings.ssh_key).toEqual('');
      });
    },
  );
});

import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const versionServiceHosts = 'check.percona.com check-dev.percona.com';
const hostsBackup = '/tmp/hosts.update-check-offline';
// TEST-NET-1 is never routed, so a connection to it hangs the way it does on a server without Internet access.
const unroutableAddress = '192.0.2.1';

pmmTest.beforeEach(async ({ context, grafanaHelper, page }) => {
  // pmmTest mocks the updates endpoint; this test needs the server's real answer.
  await page.unroute(apiEndpoints.server.updates);
  await context.unroute(apiEndpoints.server.updates);
  await grafanaHelper.authorize();
});

pmmTest.afterEach(({ cliHelper }) => {
  cliHelper
    .execute(
      `docker exec --user root pmm-server sh -c 'test ! -f ${hostsBackup} || { cat ${hostsBackup} > /etc/hosts && rm ${hostsBackup}; }'`,
    )
    .assertSuccess();
});

pmmTest(
  'PMM-TXXXX - Verify Home dashboard loads without waiting for the update check when the Percona version service is unreachable @fb-settings',
  async ({ cliHelper, dashboard, page, updatesPage }) => {
    await pmmTest.step('Open the Home dashboard while the version service is reachable', async () => {
      await page.goto(dashboard.home.url);
      await expect(dashboard.home.elements.homeDashboardLocator).toBeVisible({
        timeout: Timeouts.ONE_MINUTE,
      });
    });

    await pmmTest.step('Make the Percona version service unreachable from PMM Server', () => {
      // /etc/hosts is a bind mount, so it is rewritten in place rather than replaced; Go rereads it at most every 5 s.
      cliHelper
        .execute(
          `docker exec --user root pmm-server sh -c 'cp /etc/hosts ${hostsBackup} && echo "${unroutableAddress} ${versionServiceHosts}" >> /etc/hosts && sleep 6'`,
        )
        .assertSuccess();
    });

    await pmmTest.step('Reload the Home dashboard: it renders before the update check gives up', async () => {
      await page.reload();
      await expect(dashboard.home.elements.homeDashboardLocator).toBeVisible({
        timeout: Timeouts.FIVE_SECONDS,
      });
    });

    await pmmTest.step('The failed update check is reported without an internal server error', async () => {
      await expect(updatesPage.messages.updateCheckFailed).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(updatesPage.messages.internalServerError).toBeHidden();
    });
  },
);

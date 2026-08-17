import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const containerName = 'pmm-server-anonymous-access';
const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
const port = 450;

pmmTest.describe('Tests for Grafana anonymous access in pmm server.', () => {
  const baseUrl = `https://127.0.0.1:${port}/`;

  pmmTest.describe.configure({ retries: 0 });
  pmmTest.use({ baseURL: baseUrl });

  pmmTest.beforeAll(async ({ cliHelper }) => {
    cliHelper.execSilent(`docker rm -f ${containerName} || true`);
    cliHelper.execSilent(
      `docker run --detach --restart always --network="pmm-qa"
        -e PMM_ENABLE_TELEMETRY=0
        -e GF_AUTH_ANONYMOUS_ENABLED=true
        -e GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
        --publish ${port}:8443
        --name ${containerName}
        ${dockerVersion}`,
    );
  });

  pmmTest.afterEach(async ({ cliHelper }) => {
    cliHelper.execSilent(`docker stop ${containerName}`);
    cliHelper.execSilent(`docker rm -f ${containerName}`);
  });

  pmmTest(
    'PMM-15067 - Verify anonymous users see read-only Grafana alerting in the left navigation @docker-configuration',
    async ({ api, leftNavigation, page }) => {
      await api.serverApi.waitForReady(Timeouts.FIVE_MINUTES);

      await pmmTest.step('open PMM as an anonymous visitor', async () => {
        await page.goto('pmm-ui/');
        await leftNavigation
          .menuItemLocator('home')
          .waitFor({ state: 'visible', timeout: Timeouts.ONE_MINUTE });
      });

      await pmmTest.step('anonymous visitor is offered sign in instead of an account menu', async () => {
        await expect(page.getByTestId('navitem-sign-in')).toBeVisible();
        await expect(leftNavigation.menuItemLocator('accounts')).toBeHidden();
      });

      await pmmTest.step('Alerts is discoverable in the left navigation', async () => {
        await expect(leftNavigation.menuItemLocator('alerts')).toBeVisible();
        await leftNavigation.selectMenuItem('alerts');
      });

      await pmmTest.step('only the Grafana alerting entries are offered', async () => {
        for (const path of [
          'alerts.alertRules',
          'alerts.silences',
          'alerts.contactPoints',
          'alerts.notificationPolicies',
        ]) {
          await expect(leftNavigation.menuItemLocator(path), `${path} should be visible`).toBeVisible();
        }

        // Percona Alerting entries stay hidden: anonymous visitors get no PMM
        // settings, so alerting is off for them, and alert groups / settings are
        // gated on a non-anonymous account.
        for (const path of [
          'alerts.alertStatus',
          'alerts.perconaAlertTemplates',
          'alerts.alertGroups',
          'alerts.alertSettings',
        ]) {
          await expect(leftNavigation.menuItemLocator(path), `${path} should be hidden`).toBeHidden();
        }
      });

      await pmmTest.step('alerting is read-only for an anonymous visitor', async () => {
        const response = await page.request.post(`${baseUrl}graph/api/v1/provisioning/contact-points`, {
          data: { name: 'anonymous-probe', settings: { addresses: 'qa@example.com' }, type: 'email' },
          ignoreHTTPSErrors: true,
        });

        expect(response.status(), 'creating a contact point anonymously must be forbidden').toBe(403);
      });
    },
  );
});

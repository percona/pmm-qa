import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import { accessControlScenarios, dashboardTimeRange, qanUrl } from './accessControl.constants';

pmmTest.beforeEach(async ({ api, context, grafanaHelper, page }) => {
  await page.unroute(apiEndpoints.users.me);
  await context.unroute(apiEndpoints.users.me);

  await grafanaHelper.authorize();
  await api.settingsApi.enableAccessControl();

  for (const scenario of accessControlScenarios) {
    const ensuredRole = await api.accessControlApi.ensureRole(scenario.role);

    await grafanaHelper.createUser(scenario.username, scenario.password);

    const ensuredUser = await grafanaHelper.findUserByUsername(scenario.username);

    if (!ensuredUser) {
      throw new Error(`User ${scenario.username} was not found after creation`);
    }

    await api.accessControlApi.assignRole(ensuredUser.id, ensuredRole.role_id);
  }
});

pmmTest(
  'PMM-T2041 - Verify LBAC for QAN and dashboards @LBAC',
  async ({ dashboard, grafanaHelper, leftNavigation, page, qanStoredMetrics, urlHelper }) => {
    for (const scenario of accessControlScenarios) {
      await pmmTest.step('Authorize as role', async () => {
        await grafanaHelper.unAuthorize();
        await grafanaHelper.authorize(scenario.username, scenario.password);
      });

      await pmmTest.step('verify QAN stored metrics service type visibility', async () => {
        await page.goto(
          urlHelper.buildUrlWithParameters(qanUrl, {
            from: dashboardTimeRange,
          }),
        );
        await qanStoredMetrics.verifyOnlyServiceTypeVisible(scenario.serviceType);
      });

      await pmmTest.step('verify allowed dashboard panels', async () => {
        await leftNavigation.selectMenuItem(scenario.serviceType);
        await dashboard.verifyPanelValues(scenario.allowedPanels);
      });

      for (const disallowedDashboard of scenario.disallowedDashboards) {
        await pmmTest.step('verify panels show empty-state markers', async () => {
          await leftNavigation.selectMenuItem(disallowedDashboard.menuItem);
          await dashboard.verifyPanelsShowNoRealDataMarkers(disallowedDashboard.panels);
        });
      }
    }
  },
);

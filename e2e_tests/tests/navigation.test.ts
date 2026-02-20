import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { type NestedLocators } from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper, page }) => {
  await page.goto('');
  await grafanaHelper.authorize();
});

pmmTest('verify left menu sidebar collapse and expand @new-navigation', async ({ leftNavigation, page }) => {
  await pmmTest.step('verify left menu sidebar collapse and expand', async () => {
    await expect(leftNavigation.elements.closeLeftNavigationButton).toBeVisible();
    await expect(leftNavigation.elements.openLeftNavigationButton).toBeHidden();
  });

  await pmmTest.step('collapse left menu sidebar and verify collapsed', async () => {
    await leftNavigation.elements.closeLeftNavigationButton.click();
    await expect(leftNavigation.elements.openLeftNavigationButton).toBeVisible();
    await expect(leftNavigation.elements.closeLeftNavigationButton).toBeHidden();
    await page.reload();
    await expect(leftNavigation.elements.openLeftNavigationButton).toBeVisible();
    await expect(leftNavigation.elements.closeLeftNavigationButton).toBeHidden();
  });

  await pmmTest.step('expand left menu sidebar and verify expanded', async () => {
    await leftNavigation.mouseHoverOnPmmLogo();
    await leftNavigation.elements.openLeftNavigationButton.click();
    await expect(leftNavigation.elements.closeLeftNavigationButton).toBeVisible();
    await expect(leftNavigation.elements.openLeftNavigationButton).toBeHidden();
  });
});

pmmTest('RBAC/permissions @new-navigation', async ({ grafanaHelper, leftNavigation }) => {
  await pmmTest.step('Create non-admin user', async () => {
    await grafanaHelper.createUser('nonadmin', 'nonadmin');
  });

  await pmmTest.step('Sign out as admin and login as non-admin', async () => {
    await leftNavigation.selectMenuItem('accounts');
    await leftNavigation.selectMenuItem('accounts.signOut');
    await grafanaHelper.authorize('nonadmin', 'nonadmin');
  });

  await pmmTest.step('verify permissions', async () => {
    const configurationLocator = (leftNavigation.buttons.configuration as NestedLocators).locator;

    if (!configurationLocator) {
      throw new Error('Expected configuration locator to be defined');
    }

    await expect(configurationLocator).toBeHidden();
    await leftNavigation.selectMenuItem('help');
    await expect(leftNavigation.elements.dumpLogs).toBeHidden();
  });
});

pmmTest(
  'verify custom time range persists on any dashboard @new-navigation',
  async ({ leftNavigation, page }) => {
    const selectedTimeRange = 'Last 15 minutes';

    await pmmTest.step('Select time range @new-navigation', async () => {
      await leftNavigation.selectMenuItem('home');
      await leftNavigation.elements.timePickerOpenButton.click();
      await leftNavigation.selectTimeRange(selectedTimeRange);
      await page.reload();
      await expect(leftNavigation.elements.timePickerOpenButton).toContainText(selectedTimeRange, {
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await pmmTest.step('Verify time range persistence', async () => {
      const dashboards = leftNavigation.dashboardsToVerifyTimeRange();

      console.log(`Dashboards to verify time range: ${dashboards.join(', ')}`);

      for (const dashboard of dashboards) {
        await leftNavigation.selectMenuItem(dashboard);
        await expect(leftNavigation.elements.timePickerOpenButton).toContainText(selectedTimeRange, {
          timeout: Timeouts.TEN_SECONDS,
        });
      }
    });

    await pmmTest.step('Verify new tab persistence', async () => {
      await leftNavigation.newTab();
      await expect(leftNavigation.elements.timePickerOpenButton).toContainText(selectedTimeRange, {
        timeout: Timeouts.TEN_SECONDS,
      });
    });
  },
);

pmmTest('Grafana embedding @new-navigation', async ({ leftNavigation }) => {
  await pmmTest.step('Verify old menu hidden', async () => {
    await expect(leftNavigation.elements.oldLeftMenu).toBeHidden();
  });

  await pmmTest.step('Verify iframe hidden on Help page', async () => {
    await expect(leftNavigation.elements.iframe).toBeHidden();
  });

  await pmmTest.step('Verify iframe visible on Home page and hidden on Help page', async () => {
    await leftNavigation.selectMenuItem('home');
    await leftNavigation.elements.refreshButton.click();
    await expect(leftNavigation.elements.iframe).toBeVisible();
    await leftNavigation.selectMenuItem('help');
    await expect(leftNavigation.elements.iframe).toBeAttached();
  });
});

pmmTest('verify service persistence @new-navigation', async ({ leftNavigation, page }) => {
  await pmmTest.step('verify service persistence in overview and summary dashboards', async () => {
    await leftNavigation.selectMenuItem('mysql');

    const selectedService = await leftNavigation.selectVariableValue('Service Name');

    await expect(leftNavigation.variableContext(selectedService)).toBeVisible();
    await leftNavigation.selectMenuItem('mysql.summary');
    await expect(leftNavigation.variableContext(selectedService)).toBeVisible();

    const newPage = await leftNavigation.newTab();

    await expect(leftNavigation.variableContext(selectedService)).toBeVisible();
    await newPage.close();
    leftNavigation.switchPage(page);
  });
});

pmmTest('verify node persistence @new-navigation', async ({ leftNavigation, page }) => {
  await pmmTest.step('verify node persistence in system and postgre dashboards @new-navigation', async () => {
    await leftNavigation.selectMenuItem('operatingsystem');

    const selectedNode = await leftNavigation.selectVariableValue('Node Name');

    await expect(leftNavigation.variableContext(selectedNode)).toBeVisible();
    await leftNavigation.selectMenuItem('postgresql');
    await expect(leftNavigation.variableContext(selectedNode)).toBeHidden();
  });

  await pmmTest.step('Verify node persistence in node overview', async () => {
    await leftNavigation.selectMenuItem('mysql');

    const selectedNode = await leftNavigation.selectVariableValue('Node Name');

    await expect(leftNavigation.variableContext(selectedNode)).toBeVisible();
    await leftNavigation.selectMenuItem('operatingsystem');
    await expect(leftNavigation.variableContext(selectedNode)).toBeVisible();

    const newPage = await leftNavigation.newTab();

    await expect(leftNavigation.variableContext(selectedNode)).toBeVisible();
    await newPage.close();
    leftNavigation.switchPage(page);
  });
});

pmmTest(
  'Traverse all the menu items in left menu sidebar @new-navigation',
  async ({ leftNavigation, page }) => {
    pmmTest.slow();

    await pmmTest.step('Traverse menu items', async () => {
      await leftNavigation.traverseAllMenuItems(async () => {
        await expect(page).not.toHaveURL(/404|error|not-found/i);
      });
    });
  },
);

import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2196 verify left menu sidebar collapse and expand @new-navigation',
  async ({ leftNavigation, page }) => {
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
  },
);

pmmTest('PMM-T2197 RBAC/permissions @new-navigation', async ({ grafanaHelper, leftNavigation }) => {
  await pmmTest.step('Create non-admin user', async () => {
    await grafanaHelper.createUser('nonadmin', 'nonadmin');
  });

  await pmmTest.step('Sign out as admin and login as non-admin', async () => {
    await leftNavigation.selectMenuItem('accounts');
    await leftNavigation.selectMenuItem('accounts.signOut');
    await grafanaHelper.authorize('nonadmin', 'nonadmin');
  });

  await pmmTest.step('verify permissions', async () => {
    await expect(leftNavigation.menuItemLocator('configuration')).toBeHidden();
    await leftNavigation.selectMenuItem('help');
    await expect(leftNavigation.elements.dumpLogs).toBeHidden();
  });
});

pmmTest(
  'PMM-T2198 verify custom time range persists on any dashboard @new-navigation',
  async ({ dashboard, leftNavigation }, testInfo) => {
    const selectedTimeRange = 'Last 30 minutes';

    const assertSelectedTimeRange = async () => {
      await expect(leftNavigation.elements.loadingBar).toHaveCount(0, {
        timeout: Timeouts.TEN_SECONDS,
      });
      await expect(leftNavigation.elements.refreshButton).not.toHaveAttribute('aria-label', 'Cancel', {
        timeout: Timeouts.TEN_SECONDS,
      });
      await expect(leftNavigation.elements.timePickerOpenButton).toContainText(selectedTimeRange, {
        timeout: Timeouts.TEN_SECONDS,
      });
    };

    await pmmTest.step('Select time range @new-navigation', async () => {
      await leftNavigation.selectMenuItem('home');
      await leftNavigation.selectTimeRange(selectedTimeRange);
      await dashboard.waitForDashboardToLoad();
      await assertSelectedTimeRange();
    });

    await pmmTest.step('Verify selected time range on dashboards', async () => {
      const dashboards = leftNavigation.dashboardsToVerifyTimeRange();

      expect(dashboards.length).toBeGreaterThan(0);

      testInfo.annotations.push({
        description: dashboards.join(', '),
        type: 'Dashboards to verify time range',
      });

      for (const dashboardPath of dashboards) {
        await leftNavigation.selectMenuItem(dashboardPath);
        await dashboard.waitForDashboardToLoad();
        await assertSelectedTimeRange();
      }
    });
  },
);

pmmTest('PMM-T2199 Grafana embedding @new-navigation', async ({ helpPage, leftNavigation, page }) => {
  await pmmTest.step('Verify old menu hidden', async () => {
    await expect(leftNavigation.elements.oldLeftMenu).toBeHidden();
  });

  await pmmTest.step('Verify iframe hidden on Help page', async () => {
    await expect(page).toHaveURL(/\/pmm-ui\/help$/);
    await expect(helpPage.buttons.viewDocs).toBeVisible();
    await expect(leftNavigation.elements.iframe).toBeHidden();
  });

  await pmmTest.step('Verify iframe visible on Home page and hidden on Help page', async () => {
    await leftNavigation.selectMenuItem('home');
    await expect(page).toHaveURL(/\/pmm-ui\/graph\//);
    await leftNavigation.elements.refreshButton.click();
    await expect(leftNavigation.elements.iframe).toBeVisible();
    await leftNavigation.selectMenuItem('help');
    await expect(helpPage.buttons.viewDocs).toBeVisible();
    await expect(leftNavigation.elements.iframe).toBeHidden();
  });
});

pmmTest('PMM-T2200 verify service persistence @new-navigation', async ({ leftNavigation, page }) => {
  await pmmTest.step('verify service persistence in overview and summary dashboards', async () => {
    await leftNavigation.selectMenuItem('mysql');

    const selectedService = await leftNavigation.selectVariableValue('Service Name');

    await expect
      .poll(() => decodeURIComponent(page.url()), {
        timeout: Timeouts.ONE_MINUTE,
      })
      .toContain(selectedService);

    await expect(leftNavigation.variableContext(selectedService)).toBeVisible();
    await leftNavigation.selectMenuItem('mysql.summary');
    await expect(leftNavigation.variableContext(selectedService)).toBeVisible();

    const newPage = await leftNavigation.duplicateCurrentPage();

    await expect
      .poll(() => decodeURIComponent(newPage.url()), {
        timeout: Timeouts.ONE_MINUTE,
      })
      .toContain(selectedService);

    await expect(leftNavigation.variableContext(selectedService)).toBeVisible();
    await newPage.close();
    leftNavigation.switchPage(page);
  });
});

pmmTest('PMM-T2201 verify node persistence @new-navigation', async ({ leftNavigation, page }) => {
  await pmmTest.step('verify node persistence in system and postgre dashboards @new-navigation', async () => {
    await leftNavigation.selectMenuItem('operatingsystem');

    const selectedNode = await leftNavigation.selectVariableValue('Node Name');

    await expect
      .poll(() => decodeURIComponent(page.url()), {
        timeout: Timeouts.ONE_MINUTE,
      })
      .toContain(selectedNode);

    await expect(leftNavigation.variableContext(selectedNode)).toBeVisible();
    await leftNavigation.selectMenuItem('postgresql');
    await expect(leftNavigation.variableContext(selectedNode)).toBeHidden();
  });

  await pmmTest.step('Verify node persistence in node overview', async () => {
    await leftNavigation.selectMenuItem('mysql');

    const selectedNode = await leftNavigation.selectVariableValue('Node Name');

    await expect
      .poll(() => decodeURIComponent(page.url()), {
        timeout: Timeouts.ONE_MINUTE,
      })
      .toContain(selectedNode);

    await expect(leftNavigation.variableContext(selectedNode)).toBeVisible();
    await leftNavigation.selectMenuItem('operatingsystem');
    await expect(leftNavigation.variableContext(selectedNode)).toBeVisible();

    const newPage = await leftNavigation.duplicateCurrentPage();

    await expect
      .poll(() => decodeURIComponent(newPage.url()), {
        timeout: Timeouts.ONE_MINUTE,
      })
      .toContain(selectedNode);

    await expect(leftNavigation.variableContext(selectedNode)).toBeVisible();
    await newPage.close();
    leftNavigation.switchPage(page);
  });
});

pmmTest(
  'PMM-T2202 Traverse all the menu items in left menu sidebar @new-navigation',
  async ({ leftNavigation }) => {
    await pmmTest.step('Traverse menu items', async () => {
      await leftNavigation.verifyAllMenuItems();
    });
  },
);

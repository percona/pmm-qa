import pmmTest from '@fixtures/pmmTest';
import { expect, Locator, Response } from '@playwright/test';
import LeftNavigation, { MenuItem } from '../pages/navigation.page';

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
  await page.goto('');
  await grafanaHelper.authorize();
});

pmmTest('verify left menu sidebar collapse and expand @new-navigation', async ({ page, leftNavigation }) => {

  await pmmTest.step('verify left menu sidebar collapse and expand', async () => {
    await expect(leftNavigation.elements.closeLeftNavigationButton()).toBeVisible();
    await expect(leftNavigation.elements.openLeftNavigationButton()).toBeHidden();
  });

  await pmmTest.step('collapse left menu sidebar and verify collapsed', async () => {
    await leftNavigation.elements.closeLeftNavigationButton().click();
    await expect(leftNavigation.elements.openLeftNavigationButton()).toBeVisible();
    await expect(leftNavigation.elements.closeLeftNavigationButton()).toBeHidden();
    await page.reload();
    await expect(leftNavigation.elements.openLeftNavigationButton()).toBeVisible();
    await expect(leftNavigation.elements.closeLeftNavigationButton()).toBeHidden();
  });

  await pmmTest.step('expand left menu sidebar and verify expanded', async () => {
    await leftNavigation.mouseHoverOnPmmLogo();
    await leftNavigation.elements.openLeftNavigationButton().click();
    await expect(leftNavigation.elements.closeLeftNavigationButton()).toBeVisible();
    await expect(leftNavigation.elements.openLeftNavigationButton()).toBeHidden();
  });
});


pmmTest('Traverse all the menu items in left menu sidebar @new-navigation', async ({ page, leftNavigation }) => {

  pmmTest.slow();

  const ignore404 = (url: string) => (
    url.includes('/settings') ||
    url.includes('/admin_config')
  );

  const responseAfterClick = async (locator: Locator, name: string) => {
    const response = page.waitForResponse(
      (res: Response) => !ignore404(res.url()), { timeout: 1000 }
    ).catch(() => null);

    await locator.click();
    const res = await response;

    if (res) {
      expect(res.status()).not.toBe(404);
    }

    await expect(page).not.toHaveURL(/404|error|not-found/i);
  };

  await leftNavigation.traverseAllMenuItems(responseAfterClick);
});

pmmTest('RBAC/permissions @new-navigation', async ({ leftNavigation, grafanaHelper }) => {

  await pmmTest.step('Create non-admin user', async () => {
    await leftNavigation.selectMenuItem('usersAndAccess');
    await grafanaHelper.createUser('nonadmin', 'nonadmin');
  });

  await pmmTest.step('Sign out as admin and login as non-admin', async () => {
    await leftNavigation.selectMenuItem('accounts');
    await leftNavigation.elements.accountsMenu.signOut().click();
    await grafanaHelper.authorize('nonadmin', 'nonadmin');
  });

  await pmmTest.step('verify permissions', async () => {
    await expect(leftNavigation.elements.configuration()).toBeHidden();
    await leftNavigation.selectMenuItem('help');
    await expect(leftNavigation.elements.dumpLogs()).toBeHidden();
  });
});

pmmTest('verify custom time range persists on any dashboard @new-navigation', async ({ leftNavigation }) => {
  const selectedTimeRange = 'Last 15 minutes';

  const verifyTimeRangeOnDashboards = async (leftNavigation: LeftNavigation, selectedTimeRange: string) => {
    const dashboards = leftNavigation.dashboardsToVerifyTimeRange;
    for (const dashboard of dashboards) {
      await pmmTest.step(`Verify time range`, async () => {
        await leftNavigation.selectMenuItem(dashboard);
        await expect(leftNavigation.elements.timePickerOpenButton()).toContainText(selectedTimeRange, { timeout: 10000 });
      });
    }
  };

  await pmmTest.step('Select time range @new-navigation', async () => {
    await leftNavigation.selectMenuItem('home');
    await leftNavigation.elements.timePickerOpenButton().click();
    await leftNavigation.selectTimeRange(selectedTimeRange);
    await expect(leftNavigation.elements.timePickerOpenButton()).toContainText(selectedTimeRange);
  });

  await pmmTest.step('Verify time range persistence', async () => {
    await verifyTimeRangeOnDashboards(leftNavigation, selectedTimeRange);
  });

  await pmmTest.step('Verify new tab persistence', async () => {
    const newPage = await leftNavigation.newTab();
    await expect(leftNavigation.elements.timePickerOpenButton()).toContainText(selectedTimeRange);
  });
});

pmmTest('Grafana embedding @new-navigation', async ({ leftNavigation }) => {
  await pmmTest.step('Verify old menu hidden', async () => {
    await expect(leftNavigation.elements.oldLeftMenu()).toBeHidden();
  });

  await pmmTest.step('Verify iframe hidden on Help page', async () => {
    // await leftNavigation.selectMenuItem('help');
    await expect(leftNavigation.elements.iframe()).toBeHidden();
  });

  await pmmTest.step('Verify iframe visible on Home page and hidden on Help page', async () => {
    await leftNavigation.selectMenuItem('home');
    await leftNavigation.elements.refreshButton().click();
    await expect(leftNavigation.elements.iframe()).toBeVisible();
    await leftNavigation.selectMenuItem('help');
    await expect(leftNavigation.elements.iframe()).toBeHidden();
  });
});

pmmTest('verify node/service persistence @new-navigation', async ({ page, leftNavigation }) => {
  await pmmTest.step('verify service persistence in overview and summary dashboards', async () => {
    await leftNavigation.selectMenuItem('mysql');
    const selectedService = await leftNavigation.selectService(5, /ps-single-\d+/);
    await expect(leftNavigation.grafanaIframe().getByText(selectedService)).toBeVisible();
    await leftNavigation.selectMenuItem('mysqlMenu.summary');
    await expect(leftNavigation.grafanaIframe().getByText(selectedService)).toBeVisible();
    // check persistence in new tab
    const newPage = await leftNavigation.newTab();
    await expect(leftNavigation.grafanaIframe().getByText(selectedService)).toBeVisible();
    await newPage.close();
    leftNavigation.switchPage(page);
  });

  await pmmTest.step('verify node persistence in system and postgre dashboards @new-navigation', async () => {
    await leftNavigation.selectMenuItem('operatingsystem');
    const selectedNode = await leftNavigation.selectNode(3, /pmm-server/);
    await leftNavigation.grafanaIframe().getByText(selectedNode).waitFor({ state: 'visible', timeout: 10000 });
    await expect(leftNavigation.grafanaIframe().getByText(selectedNode)).toBeVisible();
    await leftNavigation.selectMenuItem('postgresql');
    await expect(leftNavigation.grafanaIframe().getByText(selectedNode)).toBeHidden();
  });

  await pmmTest.step('Verify node persistence in node overview', async () => {
    await leftNavigation.selectMenuItem('mysql');
    const selectedNode = await leftNavigation.selectNode(4, /client_container_\d+/);
    await leftNavigation.grafanaIframe().getByText(selectedNode).waitFor({ state: 'visible', timeout: 10000 });
    await expect(leftNavigation.grafanaIframe().getByText(selectedNode)).toBeVisible();
    await leftNavigation.selectMenuItem('operatingsystem');
    await expect(leftNavigation.grafanaIframe().getByText(selectedNode)).toBeVisible();
    // check persistence in new tab
    const newPage = await leftNavigation.newTab();
    await expect(leftNavigation.grafanaIframe().getByText(selectedNode)).toBeVisible();
    await newPage.close();
    leftNavigation.switchPage(page);
  });
});

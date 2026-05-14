import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper, page }) => {
  await grafanaHelper.authorize();
  await page.goto('pmm-ui/help');
});

pmmTest('PMM-T2098 - Verify view docs button @new-navigation', async ({ helpPage }) => {
  await pmmTest.step('Verify navigation to external URL', async () => {
    await expect(helpPage.buttons.viewDocs).toBeVisible();

    const { href, newTab } = await helpPage.clickExternalLink(helpPage.buttons.viewDocs);

    expect(href).toBeTruthy();
    expect(newTab.url()).toContain('/docs.percona.com/');
  });
});

pmmTest('PMM-T2116 - Verify Get Percona Support button @new-navigation', async ({ helpPage }) => {
  await pmmTest.step('Verify navigation to external URL', async () => {
    await expect(helpPage.buttons.contactSupport).toBeVisible();

    const { href, newTab } = await helpPage.clickExternalLink(helpPage.buttons.contactSupport);

    expect(href).toBeTruthy();
    expect(newTab.url()).toContain('www.percona.com/contact-us');
  });
});

pmmTest('PMM-T2117 - Verify view forum button @new-navigation', async ({ helpPage }) => {
  await pmmTest.step('Verify navigation to external URL', async () => {
    await expect(helpPage.buttons.viewForum).toBeVisible();

    const { href, newTab } = await helpPage.clickExternalLink(helpPage.buttons.viewForum);

    expect(href).toBeTruthy();
    expect(newTab.url()).toContain('/forums.percona.com/');
  });
});

pmmTest('PMM-T2118 - Verify manage datasets button @new-navigation', async ({ helpPage, page }) => {
  await pmmTest.step('Verify navigation to internal URL', async () => {
    await expect(helpPage.buttons.manageDatasets).toBeVisible();

    const href = helpPage.buttons.manageDatasets;

    await expect(href).toHaveAttribute('href');
    await helpPage.buttons.manageDatasets.click();
    expect(page.url()).toContain('/graph/pmm-dump');
  });
});

pmmTest('PMM-T2119 - Verify export logs button @new-navigation', async ({ helpPage }) => {
  await pmmTest.step('Verify log download', async () => {
    await expect(helpPage.buttons.exportLogs).toBeVisible();

    const href = helpPage.buttons.exportLogs;

    await expect(href).toHaveAttribute('href');

    const download = await helpPage.exportLogs();

    expect(download).toBeTruthy();
  });
});

pmmTest('PMM-T2120 - Verify start pmm tour button @new-navigation', async ({ helpPage }) => {
  await pmmTest.step('Verify starting PMM tour', async () => {
    await expect(helpPage.buttons.startPmmTour).toBeVisible();
    await helpPage.buttons.startPmmTour.click();
    await expect(helpPage.buttons.nextTip).toBeVisible();
  });
});

pmmTest('PMM-T2121 - Verify share your thoughts button @new-navigation', async ({ helpPage }) => {
  await pmmTest.step('Verify navigation to external URL', async () => {
    await expect(helpPage.buttons.shareYourThoughts).toBeVisible();
    await expect(helpPage.buttons.shareYourThoughts).toHaveAttribute(
      'href',
      'https://per.co.na/pmm3_feedback',
    );
  });
});

pmmTest(
  'PMM-T2132 Verify welcome Card appears on fresh install @new-navigation',
  async ({ helpPage, mocks }) => {
    await pmmTest.step('Mock fresh install and no services', async () => {
      await mocks.mockFreshInstall();
      await mocks.mockNoServices();
    });

    await pmmTest.step('Verify welcome card and its buttons are visible', async () => {
      await expect(helpPage.elements.welcomeCard).toBeVisible();
      await expect(helpPage.buttons.addServiceButton).toBeVisible();
      await expect(helpPage.buttons.dismissButton).toBeVisible();
      await expect(helpPage.buttons.startTourButton).toBeVisible();
    });
  },
);

pmmTest(
  'PMM-T2101 verify dismiss button on welcome card @new-navigation',
  async ({ helpPage, mocks, page }) => {
    await pmmTest.step('Mock fresh install', async () => {
      await mocks.mockFreshInstall();
    });

    await pmmTest.step('Verify welcome card visibility and click dismiss', async () => {
      await expect(helpPage.elements.welcomeCard).toBeVisible();
      await helpPage.buttons.dismissButton.click();
    });

    await pmmTest.step('Reload page and verify welcome card is not visible', async () => {
      await page.reload();
      await expect(helpPage.elements.welcomeCard).toBeHidden();
    });
  },
);

pmmTest('PMM-T2133 Verify Welcome Card start tour @new-navigation', async ({ helpPage, mocks, page }) => {
  await pmmTest.step('Mock fresh install', async () => {
    await mocks.mockFreshInstall();
  });

  await pmmTest.step('Verify welcome card and start tour', async () => {
    await expect(helpPage.elements.welcomeCard).toBeVisible();
    await helpPage.buttons.startTourButton.click();
  });

  await pmmTest.step('Verify tour popover and close tour', async () => {
    await expect(helpPage.elements.tourPopover).toBeVisible();
    await helpPage.buttons.tourCloseButton.click();
  });

  await pmmTest.step('Reload page and verify welcome card is not visible', async () => {
    await page.reload();
    await expect(helpPage.elements.welcomeCard).toBeHidden();
  });
});

pmmTest('PMM-T2134 Verify Update check @new-navigation', async ({ helpPage, mocks, page }) => {
  const cases = helpPage.cases;

  for (const c of cases) {
    await pmmTest.step('Verify update check', async () => {
      await mocks.mockUpdateAvailable(c.updateAvailable);
      await page.reload();

      /* eslint-disable playwright/no-conditional-expect -- TODO: Refactor test case to avoid conditional expect */
      if (c.updateAvailable) {
        await expect(helpPage.buttons.updates).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      } else {
        await expect(helpPage.buttons.updates).toBeHidden({ timeout: Timeouts.TEN_SECONDS });
      }
      /* eslint-enable playwright/no-conditional-expect */
    });
  }
});

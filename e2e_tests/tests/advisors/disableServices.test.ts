import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.describe('Advisors disable for services', () => {
  const createdChecks: string[] = [];

  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest.afterEach(async ({ api }) => {
    for (const name of createdChecks.splice(0)) await api.advisorsApi.deleteCheck(name);
  });

  pmmTest(
    'PMM-Txxxx - Verify disabling and re-enabling a check for a service @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const service = await api.advisorsApi.getMysqlService();
      const check = await api.advisorsApi.createCustomCheck();
      const drawer = advisorsCatalogPage.servicesDrawer;

      createdChecks.push(check.name);
      await page.goto(advisorsCatalogPage.url);
      await advisorsCatalogPage.inputs.search.fill(check.summary);

      await pmmTest.step('Open the drawer of a check enabled everywhere', async () => {
        await advisorsCatalogPage.builders.servicesButton(check.name).click();
        await expect(drawer.messages.title(check.summary)).toBeVisible();
        await expect(drawer.elements.noDisabledServices).toBeVisible();
        await expect(drawer.buttons.disable).toBeDisabled();
      });

      await pmmTest.step('Disable the check for a service', async () => {
        await drawer.disableFor([service.service_id]);
        await expect(advisorsCatalogPage.messages.checkDisabledForServices(1)).toBeVisible();
        await expect(drawer.builders.disabledService(service.service_name)).toBeVisible();
        await expect
          .poll(async () => (await api.advisorsApi.findCheck(check.name))?.disabled_service_ids)
          .toEqual([service.service_id]);
        await drawer.buttons.close.click();
        await expect(advisorsCatalogPage.builders.servicesBadge(check.name)).toContainText('1');
      });

      await pmmTest.step('A run skips the disabled service', async () => {
        const run = await api.advisorsApi.runChecksAndWait([check.name]);
        const insights = await api.advisorsApi.listInsights({ run_id: run.id });

        expect(insights.map(({ service_id }) => service_id)).not.toContain(service.service_id);
      });

      await pmmTest.step('Re-enable the check for the service', async () => {
        await advisorsCatalogPage.builders.servicesButton(check.name).click();
        await drawer.builders.enableButton(service.service_id).click();
        await expect(
          advisorsCatalogPage.messages.checkReEnabledForService(service.service_name),
        ).toBeVisible();
        await expect(drawer.elements.noDisabledServices).toBeVisible();
        await expect
          .poll(async () => (await api.advisorsApi.findCheck(check.name))?.disabled_service_ids ?? [])
          .toEqual([]);
      });
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify a globally disabled check cannot be disabled for services @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const check = await api.advisorsApi.createCustomCheck();
      const drawer = advisorsCatalogPage.servicesDrawer;

      createdChecks.push(check.name);
      await api.advisorsApi.changeCheck(check.name, { enable: false });
      await page.goto(advisorsCatalogPage.url);
      await advisorsCatalogPage.inputs.search.fill(check.summary);
      await advisorsCatalogPage.builders.servicesButton(check.name).click();

      await expect(drawer.elements.globallyDisabledNotice).toBeVisible();
      await expect(drawer.inputs.services).toBeDisabled();
      await expect(drawer.buttons.disable).toBeDisabled();
    },
  );
});

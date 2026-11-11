import pmmTest from '@fixtures/pmmTest';
import AdvisorsApi from '@api/advisors.api';
import { AdvisorCheckTechnology } from '@interfaces/advisors';
import { expect } from '@playwright/test';

pmmTest.describe('Advisors catalog', () => {
  const createdChecks: string[] = [];

  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest.afterEach(async ({ api }) => {
    for (const name of createdChecks.splice(0)) await api.advisorsApi.deleteCheck(name);
  });

  pmmTest(
    'PMM-T2553 - Verify the advisor checks catalog lists every check @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const checks = await api.advisorsApi.listChecks();
      const builtinCheck = await api.advisorsApi.getBuiltinCheck();

      await page.goto(advisorsCatalogPage.url);

      await pmmTest.step('Verify the page header and toolbar', async () => {
        await expect(advisorsCatalogPage.elements.title).toBeVisible();

        for (const button of [
          advisorsCatalogPage.buttons.addAdvisor,
          advisorsCatalogPage.buttons.clearFilters,
          advisorsCatalogPage.buttons.refresh,
          advisorsCatalogPage.buttons.runAll,
          advisorsCatalogPage.buttons.runSelected,
        ]) {
          await expect(button).toBeVisible();
        }
      });

      await expect(advisorsCatalogPage.elements.pagination).toHaveText(new RegExp(`of ${checks.length}$`));

      await pmmTest.step('Verify a built-in check row shows its controls', async () => {
        await advisorsCatalogPage.inputs.search.fill(builtinCheck.summary);
        await expect(advisorsCatalogPage.builders.row(builtinCheck.name)).toContainText('Builtin');
        await expect(advisorsCatalogPage.builders.statusSwitch(builtinCheck.name)).toBeChecked({
          checked: builtinCheck.enabled,
        });
        await expect(advisorsCatalogPage.builders.runButton(builtinCheck.name)).toBeVisible();
        await expect(advisorsCatalogPage.builders.servicesButton(builtinCheck.name)).toBeVisible();
        await expect(advisorsCatalogPage.builders.editButton(builtinCheck.name)).toBeHidden();
        await expect(advisorsCatalogPage.builders.deleteButton(builtinCheck.name)).toBeHidden();
      });
    },
  );

  pmmTest(
    'PMM-T2554 - Verify searching and filtering advisor checks @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const checks = await api.advisorsApi.listChecks();
      const mongoChecks = checks.filter((check) => check.technology === AdvisorCheckTechnology.mongodb);
      const target = mongoChecks[0];
      const allChecks = new RegExp(`of ${checks.length}$`);

      await page.goto(advisorsCatalogPage.url);
      // The target is the first row of the full list too, so only the count shows the search applied.
      await expect(advisorsCatalogPage.elements.pagination).toHaveText(allChecks);

      await pmmTest.step('Search narrows the list to the matching check', async () => {
        await advisorsCatalogPage.inputs.search.fill(target.summary);
        await expect(advisorsCatalogPage.builders.row(target.name)).toBeVisible();
        await expect(advisorsCatalogPage.elements.pagination).not.toHaveText(allChecks);
      });

      await pmmTest.step('Technology filter shows only MongoDB checks', async () => {
        await advisorsCatalogPage.buttons.clearFilters.click();
        await expect(advisorsCatalogPage.inputs.search).toHaveValue('');
        await expect(advisorsCatalogPage.elements.pagination).toHaveText(allChecks);
        await advisorsCatalogPage.selectFilter('technology', 'MongoDB');
        await expect(advisorsCatalogPage.elements.pagination).toHaveText(
          new RegExp(`of ${mongoChecks.length}$`),
        );
      });

      await pmmTest.step('Clearing filters restores the full list', async () => {
        await advisorsCatalogPage.buttons.clearFilters.click();
        await expect(advisorsCatalogPage.elements.pagination).toHaveText(allChecks);
      });
    },
  );

  pmmTest(
    'PMM-T2555 - Verify the details pane of a built-in advisor check @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const builtinCheck = await api.advisorsApi.getBuiltinCheck();

      await pmmTest.step('Open the details pane with a double click', async () => {
        await page.goto(advisorsCatalogPage.url);
        await advisorsCatalogPage.inputs.search.fill(builtinCheck.summary);
        await advisorsCatalogPage.builders.row(builtinCheck.name).dblclick();
        await expect(page).toHaveURL(new RegExp(`details=${builtinCheck.name}`));
      });

      await pmmTest.step('Verify the details of a built-in check', async () => {
        await expect(advisorsCatalogPage.builders.detailsField('check-name')).toContainText(
          builtinCheck.name,
        );
        await expect(advisorsCatalogPage.builders.detailsField('source')).toContainText('Builtin');
        await expect(advisorsCatalogPage.elements.detailsPane).toContainText('def check_context');
        await expect(advisorsCatalogPage.buttons.editCheck).toBeDisabled();
        await expect(advisorsCatalogPage.buttons.cloneCheck).toBeEnabled();
      });

      await pmmTest.step('Close the details pane', async () => {
        await advisorsCatalogPage.buttons.closeDetails.click();
        await expect(advisorsCatalogPage.elements.detailsPane).toBeHidden();
        await expect(page).not.toHaveURL(/details=/);
      });

      await pmmTest.step('The details pane opens from a deep link', async () => {
        await page.goto(advisorsCatalogPage.detailsUrl(builtinCheck.name));
        await expect(advisorsCatalogPage.builders.detailsField('check-name')).toContainText(
          builtinCheck.name,
        );
      });
    },
  );

  pmmTest(
    'PMM-T2556 - Verify creating a custom advisor check @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const name = AdvisorsApi.customCheckName();
      const summary = `QA UI check ${name}`;

      createdChecks.push(name);
      await page.goto(advisorsCatalogPage.url);

      await pmmTest.step('Fill and save the Add advisor form', async () => {
        await advisorsCatalogPage.buttons.addAdvisor.click();
        await expect(advisorsCatalogPage.checkForm.messages.addTitle).toBeVisible();
        await expect(advisorsCatalogPage.checkForm.inputs.name).toHaveValue('custom_');
        await advisorsCatalogPage.checkForm.fill({
          category: 'QA',
          description: 'Created by a UI test.',
          name,
          query: { text: 'vector(1)', type: 'METRICS_INSTANT' },
          script: api.advisorsApi.customCheckScript,
          summary,
          technology: 'MySQL',
        });
        await advisorsCatalogPage.checkForm.buttons.save.click();
        await expect(advisorsCatalogPage.builders.checkCreated(name)).toBeVisible();
        await expect(advisorsCatalogPage.checkForm.elements.form).toBeHidden();
      });

      await pmmTest.step('Verify the new check in the catalog', async () => {
        await advisorsCatalogPage.inputs.search.fill(summary);
        await expect(advisorsCatalogPage.builders.row(name)).toContainText('Custom');
        await expect(advisorsCatalogPage.builders.editButton(name)).toBeVisible();
        await expect(advisorsCatalogPage.builders.deleteButton(name)).toBeVisible();
      });

      await pmmTest.step('Verify the check is stored as defined', async () => {
        const check = await api.advisorsApi.findCheck(name);

        expect(check).toMatchObject({
          category: 'QA',
          summary,
          technology: AdvisorCheckTechnology.mysql,
          user_defined: true,
        });
      });
    },
  );

  pmmTest(
    'PMM-T2557 - Verify a custom check name requires the custom_ prefix @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const name = `qa_${Date.now()}`;

      await page.goto(advisorsCatalogPage.url);
      await advisorsCatalogPage.buttons.addAdvisor.click();
      await advisorsCatalogPage.checkForm.inputs.name.fill(name);
      await advisorsCatalogPage.checkForm.buttons.save.click();

      await expect(advisorsCatalogPage.checkForm.messages.nameWithoutPrefix).toBeVisible();
      await expect(advisorsCatalogPage.checkForm.elements.form).toBeVisible();
      expect(await api.advisorsApi.findCheck(name)).toBeUndefined();
    },
  );

  pmmTest(
    'PMM-T2558 - Verify disabling and enabling a check from the catalog @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);
      await page.goto(advisorsCatalogPage.url);
      await advisorsCatalogPage.inputs.search.fill(check.summary);

      await pmmTest.step('Disable the check', async () => {
        await advisorsCatalogPage.builders.statusSwitch(check.name).click();
        await expect(advisorsCatalogPage.builders.checkDisabled(check.summary)).toBeVisible();
        await expect(advisorsCatalogPage.builders.statusSwitch(check.name)).not.toBeChecked();
        await expect.poll(async () => (await api.advisorsApi.findCheck(check.name))?.enabled).toBe(false);
        await expect(advisorsCatalogPage.builders.runButton(check.name)).toBeDisabled();
      });

      await pmmTest.step('Enable the check again', async () => {
        await advisorsCatalogPage.builders.statusSwitch(check.name).click();
        await expect(advisorsCatalogPage.builders.checkEnabled(check.summary)).toBeVisible();
        await expect(advisorsCatalogPage.builders.statusSwitch(check.name)).toBeChecked();
        await expect.poll(async () => (await api.advisorsApi.findCheck(check.name))?.enabled).toBe(true);
      });
    },
  );

  pmmTest(
    'PMM-T2559 - Verify deleting a custom advisor check @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);
      await page.goto(advisorsCatalogPage.url);
      await advisorsCatalogPage.inputs.search.fill(check.summary);

      await pmmTest.step('Cancel the delete dialog', async () => {
        await advisorsCatalogPage.builders.deleteButton(check.name).click();
        await expect(advisorsCatalogPage.elements.deleteDialog).toContainText(check.summary);
        await advisorsCatalogPage.buttons.cancelDelete.click();
        await expect(advisorsCatalogPage.builders.row(check.name)).toBeVisible();
      });

      await pmmTest.step('Confirm the delete dialog', async () => {
        await advisorsCatalogPage.deleteCheck(check.name);
        await expect(advisorsCatalogPage.builders.checkDeleted(check.summary)).toBeVisible();
        await expect(advisorsCatalogPage.builders.row(check.name)).toBeHidden();
        expect(await api.advisorsApi.findCheck(check.name)).toBeUndefined();
      });
    },
  );

  pmmTest(
    'PMM-T2596 - Verify the ten risk categories of the built-in checks @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const builtinChecks = (await api.advisorsApi.listChecks()).filter(({ user_defined }) => !user_defined);
      const countOf = (category: string) =>
        builtinChecks.filter((check) => check.category === category).length;

      expect([...new Set(builtinChecks.map(({ category }) => category))].sort()).toEqual(
        advisorsCatalogPage.riskCategories,
      );

      await page.goto(advisorsCatalogPage.url);

      for (const category of ['Security', 'Schema & indexes', 'Logging']) {
        await pmmTest.step(`The Category filter shows the ${category} checks`, async () => {
          await advisorsCatalogPage.selectFilter('category', category);
          await expect(advisorsCatalogPage.elements.pagination).toHaveText(
            new RegExp(`of ${countOf(category)}$`),
          );
        });
      }
    },
  );

  pmmTest(
    'PMM-T2598 - Verify Run selected and Run all @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const category = `QA run ${Date.now()}`;
      const enabled = await api.advisorsApi.createCustomCheck({ category });
      const disabled = await api.advisorsApi.createCustomCheck({ category });
      const otherCategory = await api.advisorsApi.createCustomCheck();

      createdChecks.push(enabled.name, disabled.name, otherCategory.name);
      await api.advisorsApi.changeCheck(disabled.name, { enable: false });
      await page.goto(advisorsCatalogPage.url);

      await pmmTest.step('Without filters only Run all is offered', async () => {
        await expect(advisorsCatalogPage.buttons.runAll).toBeEnabled();
        await expect(advisorsCatalogPage.buttons.runSelected).toBeDisabled();
      });

      await pmmTest.step('Run selected runs only the enabled checks of the filtered category', async () => {
        await advisorsCatalogPage.selectFilter('category', category);
        await expect(advisorsCatalogPage.buttons.runAll).toBeDisabled();

        const { names, runId } = await advisorsCatalogPage.startRun(advisorsCatalogPage.buttons.runSelected);

        await expect(advisorsCatalogPage.messages.checksStarted).toBeVisible();

        expect(names).toEqual([enabled.name]);
        expect((await api.advisorsApi.waitForRun(runId)).check_names).toEqual([enabled.name]);
      });

      await pmmTest.step('Run all runs every enabled check', async () => {
        await page.goto(advisorsCatalogPage.url);
        // Opened without a query string, the Catalog brings back the filters it was left with.
        await expect(advisorsCatalogPage.builders.filter('category')).toHaveText(category);
        await advisorsCatalogPage.buttons.clearFilters.click();

        const { names, runId } = await advisorsCatalogPage.startRun(advisorsCatalogPage.buttons.runAll);

        await expect(advisorsCatalogPage.messages.checksStarted).toBeVisible();

        const run = await api.advisorsApi.waitForRun(runId);
        const checkNames = (await api.advisorsApi.listInsights({ page_size: '500', run_id: run.id })).map(
          ({ check_name }) => check_name,
        );

        expect(names).toEqual([]);
        expect(checkNames).toContain(enabled.name);
        expect(checkNames).toContain(otherCategory.name);
        expect(checkNames).not.toContain(disabled.name);
      });
    },
  );
});

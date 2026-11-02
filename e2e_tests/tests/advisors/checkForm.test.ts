import pmmTest from '@fixtures/pmmTest';
import AdvisorsApi from '@api/advisors.api';
import { Timeouts } from '@helpers/timeouts';
import { AdvisorCheckTechnology } from '@interfaces/advisors';
import { expect } from '@playwright/test';

pmmTest.describe('Advisor check form', () => {
  const createdChecks: string[] = [];
  const failingScript = 'def check_context(docs, context):\n    fail("broken check")\n';

  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest.afterEach(async ({ api }) => {
    for (const name of createdChecks.splice(0)) await api.advisorsApi.deleteCheck(name);
  });

  pmmTest(
    'PMM-Txxxx - Verify editing a custom advisor check @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const check = await api.advisorsApi.createCustomCheck();
      const form = advisorsCatalogPage.checkForm;
      const summary = `${check.summary} edited`;
      const category = 'QA edited';

      createdChecks.push(check.name);
      await page.goto(advisorsCatalogPage.url);
      await advisorsCatalogPage.inputs.search.fill(check.summary);

      await pmmTest.step('The edit form loads the check', async () => {
        await advisorsCatalogPage.builders.editButton(check.name).click();
        await expect(form.messages.editTitle).toBeVisible();
        await expect(form.inputs.name).toHaveValue(check.name);
        await expect(form.inputs.name).toBeDisabled();
        await expect(form.inputs.summary).toHaveValue(check.summary);
        await expect(form.builders.queryText(0)).toHaveValue('vector(1)');
      });

      await pmmTest.step('Save the changed summary and category', async () => {
        await form.inputs.summary.fill(summary);
        await form.inputs.category.fill(category);
        await form.inputs.category.press('Tab');
        await form.buttons.save.click();
        await expect(advisorsCatalogPage.messages.checkUpdated(check.name)).toBeVisible();
        await expect(form.elements.form).toBeHidden();
      });

      await pmmTest.step('Verify the check is updated', async () => {
        await advisorsCatalogPage.inputs.search.fill(summary);
        await expect(advisorsCatalogPage.builders.row(check.name)).toContainText(category);
        expect(await api.advisorsApi.findCheck(check.name)).toMatchObject({ category, summary });
      });

      await pmmTest.step('The API ignores a new name in the body', async () => {
        const newName = AdvisorsApi.customCheckName();

        createdChecks.push(newName);

        const update = await api.advisorsApi.requestUpdateCheck(check.name, {
          category,
          description: check.description,
          name: newName,
          queries: check.queries,
          script: check.script,
          summary,
          technology: check.technology,
        });

        expect(update.status(), await update.text()).toEqual(200);
        expect(await api.advisorsApi.findCheck(check.name)).toMatchObject({ name: check.name, summary });
        expect(await api.advisorsApi.findCheck(newName)).toBeUndefined();
      });
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify cloning a built-in advisor check @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const builtinCheck = await api.advisorsApi.getBuiltinCheck();
      const form = advisorsCatalogPage.checkForm;
      const name = AdvisorsApi.customCheckName();

      createdChecks.push(name);
      await page.goto(advisorsCatalogPage.detailsUrl(builtinCheck.name));

      await pmmTest.step('The clone form is prefilled from the built-in check', async () => {
        await advisorsCatalogPage.buttons.cloneCheck.click();
        await expect(form.messages.cloneTitle).toBeVisible();
        await expect(form.inputs.name).toHaveValue(`custom_${builtinCheck.name}`);
        await expect(form.inputs.name).toBeEnabled();
        await expect(form.inputs.summary).toHaveValue(builtinCheck.summary);
        await expect(form.inputs.category).toHaveValue(builtinCheck.category);
      });

      await pmmTest.step('Save the clone under a new name', async () => {
        await form.inputs.name.fill(name);
        await form.buttons.save.click();
        await expect(advisorsCatalogPage.messages.checkCreated(name)).toBeVisible();
        expect(await api.advisorsApi.findCheck(name)).toMatchObject({
          category: builtinCheck.category,
          summary: builtinCheck.summary,
          technology: builtinCheck.technology,
          user_defined: true,
        });
      });
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify advisor check form validation @advisors',
    async ({ advisorsCatalogPage, page }) => {
      const form = advisorsCatalogPage.checkForm;

      await page.goto(advisorsCatalogPage.url);
      await advisorsCatalogPage.buttons.addAdvisor.click();

      await pmmTest.step('Required fields are reported on save', async () => {
        await form.buttons.save.click();
        await expect(form.messages.requiredField).toHaveCount(4);
        await expect(form.builders.queryRemove(0)).toBeDisabled();
      });

      await pmmTest.step('The name accepts only letters, digits and underscores', async () => {
        await form.inputs.name.fill('custom_bad-name');
        await expect(form.messages.invalidName).toBeVisible();
        await form.inputs.name.fill(`custom_${'a'.repeat(128)}`);
        await expect(form.messages.nameTooLong).toBeVisible();
      });

      await pmmTest.step('A query parameter can be set only once', async () => {
        await form.selectOption(form.builders.queryType(0), 'METRICS_INSTANT');

        for (const index of [0, 1]) {
          await form.builders.parameterAdd(0).click();
          await form.builders.parameterName(0, index).fill('lookback');
          await form.builders.parameterName(0, index).press('Enter');
        }

        await expect(form.messages.duplicateParameter).toBeVisible();
      });
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify query types follow the check technology @advisors',
    async ({ advisorsCatalogPage, page }) => {
      const form = advisorsCatalogPage.checkForm;
      const queryTypes = {
        MongoDB: { absent: 'MYSQL_SHOW', present: 'MONGODB_GETPARAMETER' },
        MySQL: { absent: 'POSTGRESQL_SHOW', present: 'MYSQL_SHOW' },
        PostgreSQL: { absent: 'MONGODB_BUILDINFO', present: 'POSTGRESQL_SELECT' },
      } as const;

      await page.goto(advisorsCatalogPage.url);
      await advisorsCatalogPage.buttons.addAdvisor.click();

      for (const [technology, { absent, present }] of Object.entries(queryTypes)) {
        await pmmTest.step(`${technology} query types`, async () => {
          await form.selectOption(form.inputs.technology, technology);
          await form.builders.queryType(0).click();
          await expect(form.builders.option(present)).toBeVisible();
          await expect(form.builders.option('METRICS_INSTANT')).toBeVisible();
          await expect(form.builders.option(absent)).toBeHidden();
          await page.keyboard.press('Escape');
        });
      }
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify the server rejects a duplicate check name @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const existing = await api.advisorsApi.createCustomCheck();
      const form = advisorsCatalogPage.checkForm;

      createdChecks.push(existing.name);
      await page.goto(advisorsCatalogPage.url);
      await advisorsCatalogPage.buttons.addAdvisor.click();
      await form.fill({
        category: 'QA',
        description: 'Created by a UI test.',
        name: existing.name,
        query: { text: 'vector(1)', type: 'METRICS_INSTANT' },
        script: api.advisorsApi.customCheckScript,
        summary: `${existing.summary} duplicate`,
      });
      await form.buttons.save.click();

      await expect(advisorsCatalogPage.messages.duplicateCheckName(existing.name)).toBeVisible();
      await expect(form.elements.form).toBeVisible();
      expect(await api.advisorsApi.findCheck(existing.name)).toMatchObject({ summary: existing.summary });
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify the server rejects a script indented with tabs @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const form = advisorsCatalogPage.checkForm;
      const name = AdvisorsApi.customCheckName();

      createdChecks.push(name);
      await page.goto(advisorsCatalogPage.url);
      await advisorsCatalogPage.buttons.addAdvisor.click();
      await form.fill({
        category: 'QA',
        description: 'Created by a UI test.',
        name,
        query: { text: 'vector(1)', type: 'METRICS_INSTANT' },
        script: 'def check_context(docs, context):\n\treturn []\n',
        summary: `QA UI check ${name}`,
      });
      await form.buttons.save.click();

      await expect(advisorsCatalogPage.messages.scriptIndentedWithTabs).toBeVisible();
      await expect(form.elements.form).toBeVisible();
      expect(await api.advisorsApi.findCheck(name)).toBeUndefined();
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify testing a check on a service from the form @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const service = await api.advisorsApi.getMysqlService();
      const form = advisorsCatalogPage.checkForm;
      const name = AdvisorsApi.customCheckName();

      await page.goto(advisorsCatalogPage.url);
      await advisorsCatalogPage.buttons.addAdvisor.click();
      await form.fill({
        category: 'QA',
        description: 'Created by a UI test.',
        name,
        query: { text: 'vector(1)', type: 'METRICS_INSTANT' },
        script: api.advisorsApi.customCheckScript,
        summary: `QA UI check ${name}`,
      });

      await pmmTest.step('A passing script reports its findings', async () => {
        await form.testOnService(service.service_name);
        await expect(form.messages.testSucceeded).toBeVisible();
        await expect(form.messages.testFindings(3)).toBeVisible();
        await expect(form.elements.testOutput).toContainText('Finding 0');
      });

      await pmmTest.step('A failing script reports the error', async () => {
        await form.inputs.script.fill(failingScript);
        await form.buttons.test.click();
        await expect(form.messages.testFailed).toBeVisible();
        await expect(form.elements.testError).toContainText('broken check');
      });

      // The CPU limit ends the script before the 5 s timeout, so the message reads
      // "failed: signal: killed" rather than "timed out".
      await pmmTest.step('A script that never ends is stopped', async () => {
        await form.inputs.script.fill(api.advisorsApi.endlessCheckScript);
        await form.buttons.test.click();
        await expect(form.messages.testFailed).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
        await expect(form.elements.testError).toContainText('check script execution');
      });

      await pmmTest.step('Testing does not save the check', async () => {
        await form.buttons.cancel.click();
        await expect(form.elements.form).toBeHidden();
        expect(await api.advisorsApi.findCheck(name)).toBeUndefined();
      });
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify copying the code of a check from the details pane @advisors',
    async ({ advisorsCatalogPage, api, context, page }) => {
      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto(advisorsCatalogPage.detailsUrl(check.name));
      await advisorsCatalogPage.buttons.copyCheckCode.click();

      await expect(advisorsCatalogPage.messages.checkCodeCopied).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('def check_context');
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify testing a check from its details pane and the services it can target @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const check = await api.advisorsApi.createCustomCheck({
        script:
          'def check_context(docs, context):\n    print("QA print output")\n' +
          '    return [{"summary": "Finding", "description": "D", "severity": "warning"}]\n',
      });
      // The details pane has the same test controls as the form.
      const tester = advisorsCatalogPage.checkForm;

      createdChecks.push(check.name);

      await pmmTest.step('PMM Server PostgreSQL is not a target and testing on it says why', async () => {
        const pmmPostgresql = await api.inventoryApi.getServiceDetailsByPartialName('pmm-server-postgresql');
        const targets = await api.advisorsApi.listTestTargets(AdvisorCheckTechnology.postgresql);
        const response = await api.advisorsApi.requestTestCheck(pmmPostgresql.service_id, {
          ...check,
          technology: AdvisorCheckTechnology.postgresql,
        });

        expect(targets.map(({ service_id }) => service_id)).not.toContain(pmmPostgresql.service_id);
        expect(response.status()).toEqual(400);
        expect(await response.text()).toContain(
          "PMM Server's internal PostgreSQL database cannot be targeted by advisor checks",
        );
      });

      await pmmTest.step('The pane offers the test targets of the check technology', async () => {
        const targets = await api.advisorsApi.listTestTargets(check.technology);

        await page.goto(advisorsCatalogPage.detailsUrl(check.name));
        await tester.inputs.testService.click();
        await expect(tester.elements.testServiceOptions).toHaveText(
          targets.map(({ service_name }) => service_name),
        );
        await page.keyboard.press('Escape');
      });

      await pmmTest.step('Test runs the saved check and shows its print output', async () => {
        await tester.testOnService((await api.advisorsApi.getMysqlService()).service_name);
        await expect(tester.messages.testSucceeded).toBeVisible();
        await expect(tester.messages.testFindings(1)).toBeVisible();
        await expect(tester.elements.testScriptOutput).toContainText('QA print output');
      });
    },
  );

  pmmTest('PMM-Txxxx - Verify built-in checks cannot be changed or deleted @advisors', async ({ api }) => {
    const builtinCheck = await api.advisorsApi.getBuiltinCheck();
    const update = await api.advisorsApi.requestUpdateCheck(builtinCheck.name, {
      category: builtinCheck.category,
      description: builtinCheck.description,
      queries: [{ query: 'vector(1)', type: 'METRICS_INSTANT' }],
      script: api.advisorsApi.customCheckScript,
      summary: `${builtinCheck.summary} edited`,
      technology: builtinCheck.technology,
    });

    expect(update.status()).toEqual(400);
    expect(await update.text()).toContain('cannot be modified');
    expect((await api.advisorsApi.requestDeleteCheck(builtinCheck.name)).status()).toEqual(400);
    expect(await api.advisorsApi.findCheck(builtinCheck.name)).toMatchObject({
      summary: builtinCheck.summary,
    });
  });

  pmmTest(
    'PMM-Txxxx - Verify testing a check rejects retired severities @advisors',
    async ({ advisorsCatalogPage, api, page }) => {
      const service = await api.advisorsApi.getMysqlService();
      const form = advisorsCatalogPage.checkForm;
      const name = AdvisorsApi.customCheckName();
      const scriptFor = (severity: string) =>
        'def check_context(docs, context):\n' +
        `    return [{"summary": "S", "description": "D", "severity": "${severity}"}]\n`;

      await page.goto(advisorsCatalogPage.url);
      await advisorsCatalogPage.buttons.addAdvisor.click();
      await form.fill({
        category: 'QA',
        description: 'Created by a UI test.',
        name,
        query: { text: 'vector(1)', type: 'METRICS_INSTANT' },
        script: scriptFor('notice'),
        summary: `QA UI check ${name}`,
      });
      await form.selectOption(form.inputs.testService, service.service_name);

      for (const severity of ['notice', 'emergency']) {
        await pmmTest.step(`A ${severity} finding fails the test`, async () => {
          await form.inputs.script.fill(scriptFor(severity));
          await form.buttons.test.click();
          await expect(form.messages.testFailed).toBeVisible();
          await expect(form.elements.testError).toContainText(
            `result severity '${severity}' is not supported by advisors; use one of: critical, error, warning, info`,
          );
        });
      }

      await pmmTest.step('An info finding passes the test', async () => {
        await form.inputs.script.fill(scriptFor('info'));
        await form.buttons.test.click();
        await expect(form.messages.testSucceeded).toBeVisible();
        await expect(form.messages.testFindings(1)).toBeVisible();
        await form.buttons.cancel.click();
      });
    },
  );
});

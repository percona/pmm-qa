# Contributing To PMM Playwright E2E Tests

Use this guide when adding or changing tests, page objects, fixtures, helpers, or shared test data under `e2e_tests/`.

## Adding A Page Object

1. Create the page object under `pages/` or the closest feature folder with the `*.page.ts` suffix.
2. Extend `BasePage` and group reusable locators in `buttons`, `elements`, `inputs`, `messages`, or `builders`.
3. Add workflow methods using arrow functions only for repeated page actions. Never define a method inside a method, and never pass a method as an argument.
4. Keep assertions in tests unless the assertion is a reusable page-level verification.
5. Register commonly used page objects in `fixtures/pmmTest.ts`.

Page object template:

```ts
import BasePage from '@pages/base.page';

export default class FeaturePage extends BasePage {
  url = '/replace-with-feature-url';
  builders = {};
  buttons = {
    primaryAction: this.page.getByRole('button', { name: 'Replace action name' }),
  };
  elements = {
    featureTitle: this.page.getByRole('heading', { name: 'Replace page title' }),
  };
  inputs = {
    search: this.page.getByRole('textbox', { name: 'Replace input name' }),
  };
  messages = {};

  performPrimaryAction = async () => {
    await this.buttons.primaryAction.click();
  };
}
```

Fixture registration template for `fixtures/pmmTest.ts`:

```ts
import FeaturePage from '@pages/feature.page';

const pmmTest = base.extend<{
  featurePage: FeaturePage;
}>({
  featurePage: async ({ page }, use) => await use(new FeaturePage(page)),
});
```

## Adding A Test

1. Create the tests under `tests/` or the closest feature folder with the `*.test.ts` suffix.
2. Reuse `pmmTest` from `@fixtures/pmmTest`.
3. Add or update a page object first when the test needs reusable page behavior.
4. Put generic shared behavior in `helpers/`.
5. Prefer playwright `getBy` methods (e.g. `getByTestId`, `getByRole`, `getByLabel`, `getByText`).
6. Add the appropriate tag (e.g. @dashboard).

Test template:

```ts
import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ featurePage, grafanaHelper, page }) => {
  await grafanaHelper.authorize();
  await page.goto(featurePage.url);
});

pmmTest('PMM-Txxxx - Verify feature behavior @tag', async ({ featurePage }) => {
  await pmmTest.step('Verify initial state', async () => {
    await expect(featurePage.elements.featureTitle).toBeVisible();
  });

  await pmmTest.step('Perform action and verify result', async () => {
    await featurePage.performPrimaryAction();
    await expect(featurePage.buttons.primaryAction).toBeVisible();
  });
});
```

Run the changed test directly:

```bash
npx playwright test tests/<folder>/<feature>.test.ts
```

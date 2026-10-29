# Contributing To PMM Playwright E2E Tests

Use this guide when adding or changing tests, page objects, fixtures, helpers, or shared test data under `e2e_tests/`.

## Adding A Page Object

1. Create the page object under `pages/` or the closest feature folder with the `*.page.ts` suffix.
2. Extend `BasePage` and group reusable locators in `buttons`, `elements`, `inputs`, `messages`, or `builders`.
3. Add workflow methods as arrow functions when a run of actions reads as one named step, even if only one test calls it. Never define a method inside a method, and never pass a method as an argument.
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

  searchAndApply = async (text: string) => {
    await this.inputs.search.fill(text);
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
  await expect(featurePage.elements.featureTitle).toBeVisible();

  await pmmTest.step('Search and verify the result', async () => {
    await featurePage.searchAndApply('replace-search-text');
    await expect(featurePage.elements.featureTitle).toHaveText('Replace expected title');
  });
});
```

## Page Object Rules

- Check `pages/base.page.ts` and the target folder's siblings before adding a method or locator; reuse what exists.
- The one-caller rule applies to helpers, API methods, constants and types: inline those when only one place uses them. Page-object methods that group a page's actions are exempt (rule 3 above).
- Skip methods that wrap a single click or only forward one call; use the locator directly.
- Locators are class properties. A locator that takes a value goes under `builders`; a test never chains `.getBy*()`, `.locator()` or `.filter()` off a page-object locator, so give the builder a parameter instead.
- Expected literals the test compares (titles, tab names, messages) live in the page object.
- Components stay independent of pages, and get `grafanaIframe()` from `BasePage` rather than subclassing a component for it.
- A dashboard gets its own page object implementing `DashboardInterface` (`interfaces/dashboard.ts`), with `metrics` (`name`, `type`) and `noDataMetrics` inline. Tests reach it through the `dashboard` fixture, never `new XDashboard()`.

## Test Rules

- Titles follow [AGENTS.md "Test titles and Zephyr keys"](../AGENTS.md#test-titles-and-zephyr-keys). A data-driven title appends only the one value that varies: `PMM-Txxxx - Description @tag | ${row.name}`, never `JSON.stringify(row)`.
- Reuse an existing tag that a CI job already selects (`npx playwright test --list --grep @tag`). A new tag must not contain an existing one, since `--grep` matches substrings.
- Add a test to the feature's file, not to a separate regression file.
- Set state through the API, not with an `if` in the test.
- Check everything one loaded page shows in one test; call `loadAllPanels()` once per test, not per row.
- Loop over tests (`for (const row of rows) pmmTest(...)`) when rows need their own navigation or state, so one failure does not hide the rest.
- Keep existing assertions unless the change's purpose is to remove them.

## Assertions And Waits

- Every test has an assertion that can fail where it stands. After navigation, assert an element only the destination has.
- Use web-first matchers (`toBeVisible`, `toHaveText`, `toHaveCount`), `expect.poll` for one computed value and `expect(...).toPass()` for a block, instead of reading a value into a variable or writing a polling loop.
- Match text exactly (`exact: true` or an anchored regex) wherever another element, panel or service name contains the same text.
- Assert that a list read from the environment (rows, pods, services) is non-empty before looping over it; an empty list passes every check.
- Assertion helpers are named `verify…` and registered in `assertFunctionNames` in `eslint.config.mjs`; other helpers return values and the test asserts them.
- A `pmmTest.step` wraps two or more actions, or one action with the assertion that checks it, never a single `expect`. A nested step does not repeat its parent's wording.
- Size a wait at about twice the measured time; take it from the `Timeouts` enum (`helpers/timeouts.ts`).
- Gate a version-dependent test through `helpers/versionGates.ts` and the `versionGate` fixture, keyed by its `PMM-T` id.

## Cleanup

- Undo every change in `afterEach`: restore the values captured before the test, delete only the ids this test collected, and let a failed restore fail the test (no `.catch(() => undefined)`).
- Remove a service registered with `add_node` through `inventoryApi.deleteNode(nodeId, true)`, which also removes its node and agents.
- Make every name a test creates (user, database, service, setting value) unique across `e2e_tests`.

Run the changed test directly:

```bash
npx playwright test tests/<folder>/<feature>.test.ts
```

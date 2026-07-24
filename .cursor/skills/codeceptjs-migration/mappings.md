# MappingsAI

## Helpers

DoNotMigrateHelpers;MapToExistingPlaywrightHelpers.
`grafana_helper.js`->`@helpers/grafana.helper.ts`;fixture:`grafanaHelper`.
`mongoDB.js`->`@helpers/mongodb.helper.ts`;fixture:`mongoDbHelper`.
`PostgresqlDBHelper`->`@helpers/cli.helper.ts`;RunPsqlViaDockerExec.
`Mailosaur`->npm`mailosaur`.
`apiHelper.js`/`REST`->`@api/api.ts`(e.g.`api.settingsApi.getSettings()`).
`LocalStorageHelper`->`await page.evaluate(() => window.localStorage.setItem(...))`.
`FileHelper`/`FileSystem`->Node`fs`/`path`.
`ChaiWrapper`(`assert`)->`expect()`.
`linksHelper.js`->Inline/POM/`@helpers/apiEndpoints.ts`.
`I.verifyCommand()`->`@helpers/cli.helper.ts`;fixture:`cliHelper`.
`testdata/`->`e2e_tests/testdata/`;LoadVia`fs`Or`cliHelper`.

SafeOmission: `parseInt(versionPart, 10)`->`parseInt(versionPart)` for normal decimal version segments.

`codeceptjs-e2e/tests/**/pages/api/*API.js` -> existing `e2e_tests/api/*.api.ts` via `api.*Api` fixture, or `new *Api(request)` in `beforeAll` when `page` is unavailable. When exposing a formerly private method, follow `SKILL.md` section Minimal reuse diffs.

## CodeceptSyntax

`I.amOnPage(path)`->`await page.goto(path)`.
`I.click(locator)`->`await locator.click()`.
`I.fillField(locator,value)`->`await locator.fill(value)`.
`I.clearField(locator)`->`await locator.clear()`.
`I.attachFile(locator,path)`->`await locator.setInputFiles(path)`.
`I.see(text,locator)`->`await expect(locator).toContainText(text)`.
`I.seeTextEquals(text,locator)`->`await expect(locator).toHaveText(text)`.
`I.dontSeeElement(locator)`->`await expect(locator).toBeHidden()`.
`I.waitForVisible(locator,seconds)`->`await expect(locator).toBeVisible({ timeout })`.
`I.waitForText(text,seconds,locator)`->`await expect(locator).toContainText(text,{ timeout })`.
`I.seeNumberOfElements(locator,n)`->`await expect(locator).toHaveCount(n)`.
`I.grabTextFrom(locator)`->`await locator.textContent()`.
`I.grabTextFromAll(locator)`->`await locator.allTextContents()`.
`I.grabAttributeFrom(locator,attr)`->`await locator.getAttribute(attr)`.
`I.seeAttributesOnElements(locator,{ attr: val })`->`await expect(locator).toHaveAttribute(attr,val)`.
`I.seeCssPropertiesOnElements(locator,{ color: val })`->`const c=await locator.evaluate(el => getComputedStyle(el).color); expect(c).toBe(val)`.
`I.waitForFile(path,t)`/`I.seeFile(path)`->`expect(fs.existsSync(path)).toBe(true)`.
`I.seeInThisFile(text)`->`expect(fs.readFileSync(path,'utf-8')).toContain(text)`.
`tryTo(...)`->ExplicitConditionalLogicOr`try/catch`OnlyWhenIgnoringFailure.
`I.Authorize()`/auth->`grafanaHelper.authorize()`inside`pmmTest.beforeEach`.
`signOut()`->`await page.goto('graph/logout')`.
`useDataQA(sel)`->`getByTestId(sel)`.
`seeElementsDisabled/seeElementsEnabled(locator)`->`expect(locator).toHaveAttribute('disabled', ...)`/`toBeEnabled()`.

## Custom Steps

`verifyPopUpMessage(message, t=30)` / `verifyWarning(message, t=10)` / `getPopUpLocator` / `getSuccessPopUpLocator` / `getClosePopUpButtonLocator` -> POM `messages` locator first; create `@components/notification.component.ts` only when reused across pages.

- If a component is created, keep it **dumb**: it exposes the locator (`[role="alert"],[role="status"]`) and a `close()` method (click `[aria-label="Close alert"]`). It does NOT assert.
- The `expect(pom.messages.successPopUp).toContainText(message)` or `expect(component.message).toContainText(message)` call MUST be written inline in the test body - never hidden inside the POM/component. This is a `NoExpectsInHelpers` case (see `SKILL.md` section Helpers).
- `verifyWarning` asserts on `[data-testid="data-testid Alert warning"]` instead of the generic alert locator.

`verifyInvisible(sel, t)` -> `await expect(locator).toBeHidden({ timeout })`.
`asyncWaitFor(fn, t)` -> `await expect.poll(async () => ..., { timeout })`.

`downloadZipFile` -> Do NOT port as a helper. Use Playwright's `const res = await request.get(url); const buffer = await res.body();` and pass the buffer directly to `AdmZip(buffer)` rather than writing to disk.

`readZipArchive` / `getFileLineCount` -> `@helpers/archive.helper.ts` (create if missing; uses `adm-zip`). These two ARE reusable utilities and belong in the helper.
`readZipArchive` returns entry names only. `getFileLineCount` may instantiate `AdmZip` directly. Do NOT expose `AdmZip` through a `getZip` flag or a `string[] | AdmZip` return type.
`seeEntriesInZip` / `dontSeeEntriesInZip` -> thin `expect()` wrappers. Do NOT put them in the helper - write the assertion loop inline in the test using `readZipArchive` directly, e.g.:

```ts
const entries = readZipArchive(pathOrBuffer);
expect(entries).toContain("file.log");
```

Hiding `expect` inside a helper violates `NoExpectsInHelpers` and triggers the `playwright/expect-expect` lint error - never suppress with `eslint-disable`; refactor instead.

`buildUrlWithParams(url, params)` -> `@helpers/url.helper.ts` (maps `env`/`node_name`/`cluster`/`service_name`/`application_name`/`database`/`columns`/`from`/`to`/`search`/`page_number`/`page_size`/`refresh`/`metric` to `var-*`/query params; defaults `from=now-5m`, `to=now`).

`cleanupClickhouse()` -> `@helpers/cli.helper.ts`: `docker exec pmm-server clickhouse-client --database pmm --password clickhouse --query "TRUNCATE TABLE metrics"`.

Any custom step not listed above: read `codeceptjs-e2e/tests/custom_steps.js` to determine the logic before migrating (do not inline it into the test - map it to `@helpers` or `@components`).

## Skip policy

`xScenario(...)` -> established repo precedent is `pmmTest.skip(title, fn)` (see `e2e_tests/tests/ha/advancedSettings.test.ts`). Required pattern when migrating an explicitly skipped active scenario:

```ts
// TODO: <reactivation condition>
// eslint-disable-next-line playwright/no-skipped-test -- <ticket> is intentionally skipped for <reason>.
pmmTest.skip(
  '<title>',
  async ({ ... }) => { ... },
);
```

This is the only recognized Playwright skip policy in this repo. If the source `xScenario` reason does not fit this pattern, stop and report the gap instead of inventing a different mechanism.

## ESLintSuppressions

NoESLintSuppressionCommentsInMigratedTests:`*.test.ts`MustContainZeroComments;RefactorOrMoveBehaviorToHelper/POM/Component/APIClient.
OutsideMigratedTests:DisableCommentsRequire`-- reason`;UseOnlyTargeted`eslint-disable-next-line`.
Timeout:`// eslint-disable-next-line playwright/no-wait-for-timeout -- <reason>`OutsideMigratedTestsOnly.
POMAssert:`// eslint-disable-next-line playwright/expect-expect -- inside <method> POM`OutsideMigratedTestsOnly.
Locator:`// eslint-disable-next-line playwright/prefer-locator -- via builder`OutsideMigratedTestsOnly.
Conditional:For`playwright/no-conditional-expect`,Use`// eslint-disable-next-line playwright/no-conditional-expect -- <reason>`OutsideMigratedTestsOnly.
NeverUse`eslint-disable`For`playwright/expect-expect`ToSilenceAMisplacedExpect(SeeCustomStepsAbove)-RefactorInstead.
NeverUseBlockLevel`/* eslint-disable */`...`/* eslint-enable */`InMigrationRelatedCode.

## Audit checklist & confidence gate

Canonical, single copy: see `audit-checklist.md`. Do not restate the criteria here - this file is for call-level mappings only.

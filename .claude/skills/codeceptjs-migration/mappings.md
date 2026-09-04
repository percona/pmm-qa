# MappingsAI

Call-level translation only. `playwright-practices.md` governs the idiom a mapping lands in; where
a row below could be written more than one way, that file decides. Section PreferModernApi lists
the cases where the obvious transliteration is no longer the right target.

## Helpers

DoNotMigrateHelpers;MapToExistingPlaywrightHelpers.
`grafana_helper.js`->`@helpers/grafana.helper.ts`;fixture:`grafanaHelper`.
`mongoDB.js`->`@helpers/mongodb.helper.ts`;fixture:`mongoDbHelper`.
`PostgresqlDBHelper`->`@helpers/cli.helper.ts`;RunPsqlViaDockerExec.
`Mailosaur`->npm`mailosaur`.
`apiHelper.js`/`REST`->`@api/api.ts`(e.g.`api.settingsApi.getSettings()`).
`LocalStorageHelper`->`page.localStorage`/`page.sessionStorage`(1.61);not`evaluate`.
`FileHelper`/`FileSystem`->Node`fs`/`path`.
`ChaiWrapper`(`assert`)->`expect()`.
`linksHelper.js`->Inline/POM/`@helpers/apiEndpoints.ts`.
`I.verifyCommand()`->`@helpers/cli.helper.ts`;fixture:`cliHelper`. Preserve all four source semantics: a normal command uses `cliHelper.execute(command).assertSuccess()`; read `stdout.trim()` when the source consumes its return value; assert the requested output substring when supplied; for `result='fail'`, assert a nonzero exit code and use `stderr.trim()` when `returnErrorPipe=true`.
When a source test with `setupClient=true` runs a bare or `sudo`-prefixed `pmm-admin` command on the standalone client host, preserve its arguments and the assertions above but execute it in the locally provisioned client: `cliHelper.execute('docker exec client_container pmm-admin ...').assertSuccess()`. Never assume `pmm-admin` is installed on the workstation.
`testdata/`->`e2e_tests/testdata/`;LoadVia`fs`Or`cliHelper`.

SafeOmission: `parseInt(versionPart, 10)`->`parseInt(versionPart)` for normal decimal version segments.

`codeceptjs-e2e/tests/**/pages/api/*API.js` -> existing `e2e_tests/api/*.api.ts` via `api.*Api` fixture, or `new *Api(request)` in `beforeAll` when `page` is unavailable. When exposing a formerly private method, follow `SKILL.md` section Minimal reuse diffs.

## CodeceptSyntax

Legacy remote-instance tests route from `client_container` to a database through `192.168.0.1`, `host_server_port`, and credentials created by the old environment. Local provisioning puts both containers on `pmm-qa`, so preserve the selected PMM node as `client_container` but derive the database container DNS name, internal service port, username, and password together from the exact `provisioning/` engine/topology selected for the test. Confirm the account accepts connections from `client_container`; when the provisioner only creates a loopback account, create a dedicated network-accessible test account through the database container during test setup and remove it during teardown. Do not copy the legacy gateway, host-published port, or credentials, and do not guess a container name.

`I.amOnPage(path)`->`await page.goto(path)`.
`I.click(locator)`->`await locator.click()`.
`I.fillField(locator,value)`->`await locator.fill(value)`.
`I.clearField(locator)`->`await locator.clear()`.
`I.attachFile(locator,path)`->`await locator.setInputFiles(path)`.
`I.see(text,locator)`->`await expect(locator).toContainText(text)`.
`I.seeTextEquals(text,locator)`->`await expect(locator).toHaveText(text)`.
`I.dontSeeElement(locator)`->`await expect(locator).toBeHidden()`.
`I.waitForVisible(locator,seconds)`->`await expect(locator).toBeVisible({ timeout })`.
`I.waitForElement(locator,seconds)`->`await expect(locator).toBeVisible({ timeout })`;OmitEntirelyWhenTheSameStepAlreadyActedOnThatLocator-AWaitAfter`clear()`/`fill()`CanNeverWait.
`I.wait(N)`->FindTheRealCompletionSignalFirst:ANetworkResponse(`page.waitForResponse`,see`e2e_tests/tests/ha/advancedSettings.test.ts:21-27`),AStateChange,OrALabelChange.OnlyWhenNoSignalExistsKeepAFixedPauseInAPOM/HelperWithThe`no-wait-for-timeout`SuppressionAndNameTheSignalsRuledOut.TwoTrapsThatLookLikeSignalsAndAreNot:AfterASaveTheInputStillHoldsTheTypedValue,SoAssertingItProvesNothing;AndASubmitButtonIsDisabledBothWhileSavingAndWhenTheFormIsPristineAfterASuccessfulSave,So`toBeEnabled`IsNotASettleSignal-TheLabelReturningFrom'Applying...'Is.
`I.waitForText(text,seconds,locator)`->`await expect(locator).toContainText(text,{ timeout })`.
`I.seeNumberOfElements(locator,n)`->`await expect(locator).toHaveCount(n)`.
`I.grabTextFrom(locator)`->`await locator.textContent()`;WhenTheGrabbedValueFeedsAnAssertion,LandItOn`toHaveText`/`toHaveAttribute`/`toHaveJSProperty`Instead-AGrabbedVariableDoesNotRetry.
`I.grabTextFromAll(locator)`->`await locator.allTextContents()`.
`I.grabAttributeFrom(locator,attr)`->`await locator.getAttribute(attr)`.
`I.seeAttributesOnElements(locator,{ attr: val })`->`await expect(locator).toHaveAttribute(attr,val)`.
`I.seeCssPropertiesOnElements(locator,{ color: val })`->`await expect(locator).toHaveCSS('color',val)`;`{ pseudo: '::before' }`ForPseudoElements.
`I.waitForFile(path,t)`/`I.seeFile(path)`->`expect(fs.existsSync(path)).toBe(true)`.
`I.seeInThisFile(text)`->`expect(fs.readFileSync(path,'utf-8')).toContain(text)`.
`tryTo(...)`->ExplicitConditionalLogicOr`try/catch`OnlyWhenIgnoringFailure.
`I.Authorize()`/auth->`grafanaHelper.authorize()`inside`pmmTest.beforeEach`.
`signOut()`->`await page.goto('graph/logout')`.
`useDataQA(sel)`->`getByTestId(sel)`.
`seeElementsDisabled/seeElementsEnabled(locator)`->`expect(locator).toHaveAttribute('disabled', ...)`/`toBeEnabled()`.
`locate('$testid').find('<tag>')`(labelLocator)->`getByTestId('testid')`assertedWith`toContainText`, notA`.locator('<tag>')`chainPlus`first()`. Under MUI the child tag is routinely multi-match, so the literal translation is a strict-mode violation on `toBeVisible`/`toContainText`, while the wrapper's innerText is the union of those children. Narrow to a child testid only when MCP shows the wrapper itself is multi-match.
`BeforeSuite`/`AfterSuite` -> `beforeAll`/`afterAll`, but the scope is not equivalent: CodeceptJS runs `BeforeSuite` once per suite, while Playwright runs `beforeAll` **once per worker**, and `playwright.config.ts` sets `fullyParallel: true`. A ported `BeforeSuite` whose body is expensive or mutates shared server state therefore runs once per worker that picks up a test from the file - three times for a three-scenario file at `WORKERS=3`. Preserve once-per-file semantics explicitly with a top-level `pmmTest.describe.configure({ mode: 'default' })` (applies file-wide, so no describe block and no re-indentation of the scenarios) or a worker-scoped fixture. `Before`/`After` -> `beforeEach`/`afterEach`, which do correspond directly.

## Custom Steps

`verifyPopUpMessage(message, t=30)` / `verifyWarning(message, t=10)` / `getPopUpLocator` / `getSuccessPopUpLocator` / `getClosePopUpButtonLocator` -> POM `messages` locator first; create `@components/notification.component.ts` only when reused across pages.

- If a component is created, keep it **dumb**: it exposes the locator (`[role="alert"],[role="status"]`) and a `close()` method (click `[aria-label="Close alert"]`). It does NOT assert.
- The `expect(pom.messages.successPopUp).toContainText(message)` or `expect(component.message).toContainText(message)` call MUST be written inline in the test body - never hidden inside the POM/component. This is a `NoExpectsInHelpers` case (see `SKILL.md` section Native Playwright rules and `playwright-practices.md` section Web-first assertions).
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

## PreferModernApi

The CodeceptJS source predates most of these. When a mapping above would produce the left column,
write the right column instead. Full table and versions in `playwright-practices.md`.

`getComputedStyle`Via`evaluate`->`toHaveCSS`.
`toHaveClass(/partial/)`Or`[class*="..."]`Selector->`toContainClass`.
`evaluate`On`localStorage`/`sessionStorage`->`page.localStorage`/`page.sessionStorage`.
ManualConsole/RequestListeners->`page.consoleMessages()`/`page.pageErrors()`/`page.requests()`.
LongStructuralDOMAssertionChain->`toMatchAriaSnapshot()`.
ManualTruthinessWaitLoop->`locator.waitForFunction()`Or`expect.poll`.
NeverIntroduce:`page.accessibility`,`backgroundPages()`,`?`/`[]`GlobsIn`page.route()`,`-gv`.

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

The TODO is required only for this unconditional form, where it names the ticket that would reactivate the test. `check-migration-conventions.sh` enforces that pairing and additionally requires the TODO to reference a ticket - free text does not satisfy it.

### A source scenario that returns early

A scenario guarded by a runtime early `return` is not a skip in the source, but it reports a **pass** while asserting nothing, and no check in this skill can see it: `playwright/expect-expect` is satisfied by a test that merely contains an `expect` lexically, whether or not execution reaches it.

Do not translate it to an inline conditional `pmmTest.skip(condition, reason)`. `e2e_tests/eslint.config.mjs` sets `playwright/no-skipped-test` to `error` for `**/*.test.ts` with `allowConditional` left at `false`, and there are zero `pmmTest.skip` calls anywhere under `e2e_tests/tests/` - so the inline form only lints by suppressing the rule.

The established mechanism is the fixture layer: an auto fixture calling `testInfo.skip(condition, reason)`, as `versionGate` does at `e2e_tests/fixtures/pmmTest.ts:184`. Port a source guard by extending that fixture, or adding one beside it when the condition is not a version. Only if that is genuinely impossible does a suppressed inline skip apply, and then say in the handoff why the fixture route was ruled out.

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

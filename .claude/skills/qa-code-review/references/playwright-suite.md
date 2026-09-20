# `e2e_tests/` — Playwright UI suite

The active suite. Conventions live in [e2e_tests/CONTRIBUTING.md](../../../../e2e_tests/CONTRIBUTING.md) and [.agents/workflows/pomRules.md](../../../../.agents/workflows/pomRules.md); this file is only what reviewers keep having to say.

## Version-aware review

Playwright best practice moves. Before accepting hand-rolled machinery — or recommending an API — check the pin.

1. Pin: `e2e_tests/package.json`, `cli/package.json`, `codeceptjs-e2e/package.json`. All three are on `^1.62.1` today; confirm, do not assume.
2. Installed: `npx playwright --version`.
3. Read [release notes](https://playwright.dev/docs/release-notes) for the range between the pin and latest.
4. Recommending an API newer than the pin is fine, but say the upgrade is a prerequisite — the finding is "upgrade first", not "use X".

Patterns already dead at `1.62`:

| Hand-rolled | Native since | Live example |
|---|---|---|
| null guard around `download.path()` | 1.62 — never null | `tests/helpCenter.test.ts` PMM-T1830 |
| `page.on('console')` + array + `page.off` cleanup | 1.56 `page.consoleMessages()`, `page.pageErrors()`, `page.requests()` | — |
| `page.evaluate(() => localStorage.setItem(...))` | 1.61 `page.localStorage` / `page.sessionStorage` | `tests/helpCenter.test.ts:171` |
| filtering visible nodes by hand | 1.51 `locator.filter({ visible: true })` | — |
| class-string matching | 1.52 `expect(locator).toContainClass()` | — |
| sleeping to advance time | `page.clock` | — |
| per-test tour/modal suppression | `page.addLocatorHandler()` | `helpers/grafana.helper.ts` |
| frame ↔ element juggling | 1.43 `locator.contentFrame()`, `frameLocator.owner()` | `pages/base.page.ts:58` |

## Assertions

| Rule | Why |
|---|---|
| Assertions live in the test, not in the page object or helper | a test whose expects are hidden reads as testing nothing; `playwright/expect-expect` is `error` on `*.test.ts`. If a verification genuinely belongs to a page method, name it `verify…` **and** register it in `assertFunctionNames` in `eslint.config.mjs`. That lint only fires when a test body contains **no** recognised assertion at all, so an assertion hidden in a page method alongside test-body `expect`s is raised as a structure finding — never as a lint failure, which CI is not reporting and the author will correct you on |
| `toBeTruthy()` is not an assertion | assert the value. 4 live cases in `tests/helpCenter.test.ts` (lines 17, 28, 39, 66) |
| `toBeHidden()`, not `not.toBeVisible()` | reads better and fails better. Exception: a locator matching N nodes — `toBeHidden` is strict-mode single-node, so assert a count instead |
| Web-first assertions, never `waitForLoadState` | load states are flaky by construction — [best practices](https://playwright.dev/docs/best-practices#use-web-first-assertions) |
| `expect().toPass()` for retryable blocks | replaces hand-rolled poll loops |
| `expect().toHaveText()` beats `textContent()` + `equal` | auto-retries |
| A green test must be able to fail | mutate the expected **value** and re-run. Inverting a matcher is not a mutation: anything satisfies it |
| Whole-string equality against UI text cites where the string was measured | `=== ` / `toHaveText` on text that may carry a suffix silently never matches. A migrated test compared an annotation tooltip to its title; measured on a live box, the API-created form reads `title (Service Name: … Node Name: …)` and only the CLI-created form is bare — 2 cases passed, 5 could never pass. Prefer a boundary match, and treat tightening a ported substring match into equality as a coverage change that needs evidence |
| A ported assertion's strength is set by its CodeceptJS source — matcher **and** guards | making a migrated test stricter than its source is a coverage change needing evidence, not a tightening. `dontSeeElement` passes on a hidden element, so `filter({ visible: true })` before `toHaveCount(0)` is the faithful port and dropping it asserts more than the source did. The same holds for the conditions *around* an assertion: where the source asserts only inside two AND-ed guards, lifting one into an independent assertion can fail nightly where the source passes |
| A migrated DataTable title keeps its literal suffix **only while the byte-identity gate is still being spent** | `JSON.stringify(row)` cannot reproduce it — `perfectionist/sort-objects` alphabetises the migrated object literal while CodeceptJS keys the JSON in `new DataTable([...])` column order, and a renamed destination POM key diverges too (7 of 8 titles measured wrong). Once those gates have passed the title carries the one value that varies: a reviewer rejected the verbatim suffix as a "big test name that can't be rendered on artifacts" and asked for `panelName` only, which is what merged. Interpolating a **single field** of the row is not the `JSON.stringify(row)` failure this row warns about |
| An expectation widened to accept a **union** of values is a coverage loss, 🟡 | an alias array, an OR matcher or a `waitForAny…` helper that lets the test pass under more than one version or environment stops verifying which value is right for the configuration under test. Three AI reviews passed `waitForAnyMetric([data, replicaStatusAliases[data]])`; the author removed it because "accepting either metric name weakened what PMM-T2028 asserts" and asserted the 8.4 names outright. Ask for the value correct for the configuration the tag actually provisions, or a `versionGate` keyed by the `PMM-T` id |
| An attached-versus-visible claim carries the measured pair for the dashboard under review | a 🟡 faulting `.count()` for counting attached matches where the source's `grabNumberOfVisibleElements` kept visible ones — "it reds a run the source would have passed" — did not survive measurement: attached and visible were identical in every state that test reaches (60/60 unlabelled, 2/2 once the label lands, no unmounting between scrolls). Without the pair the finding is 🔵 on the failure message alone, and no suggestion block rewrites a passing assertion on it |
| `collectTextsAcrossScroll` dedupes by text | its `Set` drops genuinely duplicate panel titles, so it must not be recommended over a raw `allTextContents()` wherever the count feeds a threshold — it shrinks the count toward the budget it was meant to protect. After `loadAllPanels()` every grid item stays mounted, so the raw call does not undercount a Grafana dashboard (measured: 81 vs 79, 38 vs 38, 31 vs 31) |

## Page objects

| Rule | Why |
|---|---|
| Check `pages/base.page.ts` **and `pages/dashboards/dashboards.page.ts`** before adding a method — or writing an assertion inline | `selectTimeRange`, `selectVariableValue`, `getVariableValues`, `grafanaIframe`, `duplicateCurrentPage`, `haEnableCheck` already exist. "Already in base page, remove" is the single most repeated review comment in this repo. The rule fires on a diff that **adds a page method**, which is why three AI reviews argued the semantics of an inline `.count()`-against-a-budget assertion and none said it should not exist; the maintainer did ("I believe we have methods in place that does this same validation"), and the merged test calls `dashboard.verifyAllPanelsHaveData(…)` — `dashboards.page.ts:210`, 17 call sites. Read an inline test assertion against those files too; where the existing method would change what the test covers, the finding is that choice, stated for the author |
| A new page object is read against a **sibling in the same folder** | it declares the same members in the same shape. Three new OS page objects built `metrics` from a local `panelNames` const plus `.map()` where every existing dashboard in that folder declares it as an inline literal; the reviewer raised the same comment on all three — "There is no real gain to have this, why not inline it as we have done with others dashboards?" — and the merged files declare it inline. A construction no sibling uses is a finding even when the result is correct |
| A dashboard page object implements `DashboardInterface` and owns its `GrafanaPanel[]` | a panel array declared in a test, or a raw Playwright call in a dashboard test file, is a finding — the maintainer asked for both to move into a page object per dashboard, citing `pages/dashboards/valkey/*.ts`, and later rejected a locator fix that reshaped the agreed panel contract |
| No wrapper method around one click | use the locator directly in the test — settled team agreement |
| No method used exactly once | inline it |
| Waits and one-off actions belong in the test | not in the page object |
| No raw locator inside a method or a test | locators are class properties, in `buttons` / `elements` / `inputs` / `messages` / `builders` |
| One `frameLocator` for the Grafana iframe | `pages/base.page.ts:58` owns it; `components/dashboards/panels/panel.component.ts:8` duplicates it |
| No method inside a method; no method passed as an argument | want a variant? add a parameter or a second method |
| `string` parameter that has a closed set of values → union or interface | `DropdownName` in `base.page.ts` is the pattern |
| Name says what and where | `RtaMain` says neither |

## Locators

- Priority `getByTestId` > `getByRole` > `getByLabel` > `getByPlaceholder`. No CSS classes for Grafana elements — they change per version.
- `first()` / `last()` / `nth()`: allowed when the DOM genuinely has N equivalent nodes and the test does not care which, and the diff says so in one line. Not allowed as a patch for a locator that should have been unique — that is the case `pomRules.md` bans, and there are 31 live uses, so judge the intent, not the call.
- Any count offered as proof that a **Grafana panel** locator is unique must be measured after `loadAllPanels()`. A default load renders 19 `section[data-testid]` panels of 89 grid items; after `loadAllPanels()` 81 render and four asserted titles resolve to 2 each — so a green strict-mode test on a default viewport proves nothing about uniqueness. A correct duplicate-locator finding was refuted twice on the 19-panel count and withdrawn before being reinstated.
- Caller text interpolated into an XPath or CSS string is 🟡: the fix is `getByText` / `getByTestId` / `filter({ hasText })`, which take the value as data (Playwright quotes it) and return the innermost match, so the XPath's element-type scoping isn't lost either. A **new quoting or escaping helper for selectors is itself the finding** — one PR answered a bot's "an apostrophe breaks `//div[contains(text(), '${title}')]`" by adding an XPath-literal `concat()` helper, for values that were all test-file constants.
- In a loop scanning candidate elements, the interaction goes **inside** the guard with its own bounded timeout, so an unactionable candidate is skipped rather than ending the search; give the loop an overall budget and a failure message naming what it looked for. A scan that hovered outside its try/catch died at the project's 10s `actionTimeout` on the first of 24 markers whose neighbour intercepted pointer events.

## Steps and waits

- `pmmTest.step` around anything worth reading in the report — but `expect` is already a step, so wrapping a bare `expect` produces two. Nested steps that repeat the parent's wording are a defect.
- A page method that already wraps itself in a step must not be wrapped again by the caller — `pages/helpCenter.page.ts:41` wraps `exportLogs`.
- An explicit timeout is bad practice: prefer auto-waiting and web-first assertions. When one is genuinely needed, take it from the `Timeouts` enum (`helpers/timeouts.ts`) — never a bare number.
- `page.waitForTimeout` is `error` in eslint. A new `eslint-disable-next-line` for it needs a real invariant as the reason; 5 of the 15 live suppressions say `TODO`.
- Do not scroll by hand: `click()` scrolls into view. For lazy-loaded lists, `scrollIntoViewIfNeeded()` on the last element.

## Structure

- `pmmTest` from `@fixtures/pmmTest`, never raw `test`. Settled — do not reopen.
- Register a reused page object as a fixture in `fixtures/pmmTest.ts`.
- Version gate a test through `helpers/versionGates.ts` + the `versionGate` fixture (`fixtures/pmmTest.ts:176`), keyed by the `PMM-T` id. Never an inline `if (version…)`.
- API URLs in `helpers/apiEndpoints.ts`; API calls through `api/*.api.ts`.
- One mock helper (`helpers/mocks.helper.ts`), not one per case.
- A helper or const with one caller belongs in its caller. In a `*.test.ts` that has a checkable shape: a declaration at **module scope** read by exactly one test belongs inside that test's body. A maintainer moved a module-level `const environment = 'dev'` into the single test that read it — "no reason to make it a top-level configuration that other tests in future might want to use" — on a line every AI review passed. Judge the shape, not the reuse intent.
- Loop over tests, not inside one: `for (const case of cases) pmmTest(...)`. A loop inside a single test hides which iteration failed and stops at the first — `tests/helpCenter.test.ts:146` is the live violation (🟡, pre-existing). **This governs independent cases and `Data(...)` rows only.** N checks against one already-loaded page stay in a single test: two maintainers rejected the split in one week — "there is no need to start a new page, navigation, fixtures, for repeating tests on same page", and "can't the for loop live under a single test that checks all expands? Don't see the reason to close and reopen the same page multiple times" — because the per-test isolation buys nothing there and the reloads dominate the runtime. The remedy for "which iteration failed" is an assertion message naming the element, not a test per element.
- Cleanup in `afterEach`, not `try/finally`. Shared setup in `beforeAll` when it is genuinely once. The cleanup must **assert its own success** — restore, then call something whose failure surfaces (a `getDataSourceByName()` after a password restore) — or a swallowed failure leaks corrupted state into the next test instead of failing this one.
- `test.describe.serial` is a symptom: fix the shared resource — usually a colliding container name — instead.
- Comments only for the non-obvious, one line. A workaround comment carries its Jira link.

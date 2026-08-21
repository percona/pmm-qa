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
| Assertions live in the test, not in the page object or helper | a test whose expects are hidden reads as testing nothing; `playwright/expect-expect` is `error` on `*.test.ts`. If a verification genuinely belongs to a page method, name it `verify…` **and** register it in `assertFunctionNames` in `eslint.config.mjs` |
| `toBeTruthy()` is not an assertion | assert the value. 4 live cases in `tests/helpCenter.test.ts` (lines 17, 28, 39, 66) |
| `toBeHidden()`, not `not.toBeVisible()` | reads better and fails better. Exception: a locator matching N nodes — `toBeHidden` is strict-mode single-node, so assert a count instead |
| Web-first assertions, never `waitForLoadState` | load states are flaky by construction — [best practices](https://playwright.dev/docs/best-practices#use-web-first-assertions) |
| `expect().toPass()` for retryable blocks | replaces hand-rolled poll loops |
| `expect().toHaveText()` beats `textContent()` + `equal` | auto-retries |
| A green test must be able to fail | mutate the expected **value** and re-run. Inverting a matcher is not a mutation: anything satisfies it |

## Page objects

| Rule | Why |
|---|---|
| Check `pages/base.page.ts` before adding a method | `selectTimeRange`, `selectVariableValue`, `getVariableValues`, `grafanaIframe`, `duplicateCurrentPage`, `haEnableCheck` already exist. "Already in base page, remove" is the single most repeated review comment in this repo |
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
- A helper or const with one caller belongs in its caller.
- Loop over tests, not inside one: `for (const case of cases) pmmTest(...)`. A loop inside a single test hides which iteration failed and stops at the first — `tests/helpCenter.test.ts:146` is the live violation (🟡, pre-existing).
- Cleanup in `afterEach`, not `try/finally`. Shared setup in `beforeAll` when it is genuinely once.
- `test.describe.serial` is a symptom: fix the shared resource — usually a colliding container name — instead.
- Comments only for the non-obvious, one line. A workaround comment carries its Jira link.

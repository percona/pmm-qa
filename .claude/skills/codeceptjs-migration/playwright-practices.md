# Playwright Authoring Practices

```text
verifiedAgainst: 1.62.1
source: https://playwright.dev/docs/best-practices plus release notes 1.52-1.62
```

How migrated code is written. `SKILL.md` decides whether behaviour is preserved; this file decides how it is expressed. `verifiedAgainst` must match `@playwright/test` in `e2e_tests/package.json`; `orchestration.md` step 1 checks it, and on drift this file is refreshed against the release notes before migrating. A migration never upgrades Playwright and never edits `playwright.config.ts`.

## Locators

Ladder, highest first:

1. `getByTestId`
2. `getByRole`
3. `getByLabel`
4. `getByPlaceholder`
5. `getByText` / `getByTitle`

Test id outranks role here because Grafana ships its own `data-testid` values and the config sets no `testIdAttribute`, so they match by literal value including the prefix: `getByTestId('data-testid Panel header <name>')`.

- `getByRole(role, { name, description })`: `description` (1.60) matches the accessible description when several controls share a name.
- CSS only for MUI and Grafana internals with no stable test id or role (`[class*="MuiListItemText-secondary"]`, `.reactour__popover`). XPath only for positional table cells and the Grafana iframe (`frameLocator`).
- Every POM entry is a `Locator`, never a selector string. Chain and scope rather than writing one long selector; `locator.describe('...')` on an otherwise opaque locator.
- Resolve a strict-mode violation by narrowing the locator (`.locator()` to scope, `.filter({ hasText })` to select), not with `nth()`, `first()` or `last()`. Those remain legitimate for deliberate indexed iteration and positional table cells, justified in one line; the convention script reports them as advisories.
- An existing POM entry with no consumers is unproven. When it disagrees with a currently-green source selector, verify both through MCP and rewrite it in place; keep the existing form only when a second source attests it.

## Web-first assertions

Assertions auto-wait and retry; manual predicates do not.

- `await expect(x).toBeVisible()`, never `expect(await x.isVisible()).toBe(true)`. `await expect(x).toHaveCount(n)`, never `expect(await x.count()).toBe(n)`.
- A locator-derived value awaited into a variable and asserted once never retries; use the web-first matcher, `expect.poll(fn, { message, timeout })` for one computed value, or `expect(async () => { ... }).toPass({ intervals: [Timeouts.X], timeout })` for a block of assertions. Never a hand-rolled polling loop.
- `toBeHidden()` when absence is meant; `not.toBeVisible()` only when the distinction matters.
- Every non-locator assertion carries a message: `expect(value, 'why this must hold').toBe(...)`. Bare `expect` is correct for API status, CLI stdout and parsed files.
- `waitForTimeout` is an ESLint error. `locator.waitFor({ state })` only as a genuine precondition, never in place of an assertion.
- New helpers and POM methods return values and do not assert; the existing POM `verify*` methods are reused, not extended. A POM method waits only for what its own action needs.

## Prefer the modern API

All available at 1.62.1 and barely used in the repo yet, so this table is the target form, not a description of existing code. A CodeceptJS call that transliterates into the left column is written as the right column.

| Instead of | Use | Since |
| --- | --- | --- |
| `evaluate(el => getComputedStyle(el).x)` | `expect(locator).toHaveCSS(prop, value)`; `{ pseudo: '::before' }` for pseudo-elements | 1.60 |
| `toHaveClass(/partial/)` or a `[class*="..."]` selector | `expect(locator).toContainClass('name')` | 1.52 |
| `evaluate(() => localStorage.getItem(...))` | `page.localStorage` / `page.sessionStorage` | 1.61 |
| hand-registered `console` / `request` listeners | `page.consoleMessages()`, `page.pageErrors()`, `page.requests()` | 1.56 |
| a long chain of structural DOM assertions | `expect(page).toMatchAriaSnapshot()` | 1.60 |
| a manual truthiness wait on page state | `locator.waitForFunction()` | 1.62 |

Since 1.59 and 1.62, for code this suite writes:

- A `page.route` handler registered inside a test body is scoped with `await using` (1.59, `target: ESNext` in `tsconfig.json` supports it), so it unregisters when the block ends; a mock shared across tests lives in the `mocks` fixture.
- Console checks use `page.clearConsoleMessages()` before the action and `page.consoleMessages({ filter })` after it (1.59), never a `page.on('console')` listener.
- A locator found by CSS or XPath is run through `locator.normalize()` (1.59) in a scratch script against the live server to propose its test-id or role form; the proposal is then verified through MCP like any other rung.
- `expect.soft.poll` (1.62) is not used: this suite has no soft assertions, and a migration adds none.

Do not introduce, removed or deprecated upstream: `page.accessibility` (1.57); `browserContext.on('backgroundpage')` and `backgroundPages()` (1.56); `?` and `[]` globs in `page.route()` (1.52, use a regular expression, relevant to the `context` override in `e2e_tests/fixtures/pmmTest.ts`); `-gv` (1.54, use `--grep-invert`).

## Structure

- `import pmmTest from '@fixtures/pmmTest';` and `import { expect } from '@playwright/test';`. Never a bare `test`.
- Wrap meaningful phases in `await pmmTest.step('<sentence>', async () => { ... })`, the sentence verb-first as 160 of the 174 existing steps are. A phase is two or more actions or assertions, or one action with the assertion that checks it. A step around a single bare `expect` only duplicates the report entry.
- Timeouts come from `@helpers/timeouts`, never a bare number.
- Every POM, helper, API client and component a test uses is registered in `e2e_tests/fixtures/pmmTest.ts` and destructured alphabetically in the test signature.
- Arrow functions only (`func-style`, `no-restricted-syntax`).
- Each test is self-contained: no state carried between tests unless the source carries it (`SKILL.md` Port behaviour); cleanup in `afterEach`.

## Deliberate deviations from upstream

- Tags live inside the title string, not the native `{ tag: [...] }` option, because the matrix workflows grep titles; `playwright/valid-test-tags` is `off`. Every original CodeceptJS tag is preserved verbatim.
- No `expect` timeout in `playwright.config.ts`: the default 5s applies and an assertion that needs longer carries an explicit `Timeouts.X`.
- `fullyParallel: true` with `WORKERS` read from the environment (`workers: 1` is only the CI default). Never assume cross-test parallelism or its absence: a `beforeAll` that is expensive or mutates shared server state is pinned with `describe.configure({ mode: 'default' })` or moved to a worker-scoped fixture, because `beforeAll` runs once per worker.

## Companions

- `e2e_tests/CONTRIBUTING.md`: POM, fixture and test templates.
- `.agents/workflows/pomRules.md`: POM structure and locator rules.
- `AGENTS.md`: repository-wide do and do-not list.
- `e2e_tests/eslint.config.mjs`: the rules actually enforced.

# Playwright Authoring Practices

```text
verifiedAgainst: 1.62.1
source: https://playwright.dev/docs/best-practices plus release notes 1.52-1.62
```

How migrated code is written. `SKILL.md` stays authoritative for migration rules (fidelity,
reuse, tracker); this file is authoritative for Playwright idiom. When the two disagree about
whether a behavior may change, `SKILL.md` wins: practices govern how behavior is expressed, never
whether it is preserved.

`verifiedAgainst` must match the `@playwright/test` version in `e2e_tests/package.json`. `run.md`
step 1 checks this. On drift, refresh this file against the release notes before migrating.

## Locators

Priority ladder, highest first:

1. `getByTestId`
2. `getByRole`
3. `getByLabel`
4. `getByPlaceholder`
5. `getByText` / `getByTitle`

Test id comes first here, contrary to upstream's role-first advice, because Grafana ships its own
`data-testid` values and the config sets no `testIdAttribute` override, so they are matched by
their literal value including the prefix: `getByTestId('data-testid Panel header <name>')`.

- CSS only for MUI and Grafana internals that expose no stable test id or role
  (`[class*="MuiListItemText-secondary"]`, `.reactour__popover`).
- XPath only for positional table cells and the Grafana iframe (`frameLocator`).
- Every POM entry is a `Locator` object, never a selector string.
- Avoid `nth()`, `first()`, and `last()`. Resolve a strict-mode violation by narrowing the locator
  itself: chain `.locator()` to scope it, or `.filter({ hasText })` to select it. They remain
  legitimate for deliberate indexed iteration over a known collection and for positional table
  cells; justify each use. `check-migration-conventions.sh` reports these as advisories, not
  failures, because they predate this rule in many existing files.
- Chain and scope rather than writing one long selector.
- `locator.describe('...')` (1.53) on an otherwise opaque locator so traces and reports name it.

## Web-first assertions

Assertions auto-wait and retry; manual predicates do not.

- Never `expect(await x.isVisible()).toBe(true)`. Use `await expect(x).toBeVisible()`.
- Never a hand-rolled polling loop. Use `expect.poll(fn, { message, timeout })`.
- `await expect(x).toHaveCount(n)`, not `expect(await x.count()).toBe(n)`.
- `toBeHidden()` when absence is meant; `not.toBeVisible()` only when the distinction matters.
- Attach a message to every non-locator assertion: `expect(value, 'why this must hold').toBe(...)`.
- `waitForTimeout` is an ESLint error and stays one.
- `locator.waitFor({ state })` only as a genuine precondition, never in place of an assertion.
- Assertions stay in test bodies. Helpers return values; they do not assert.

## Prefer the modern API

Each of these is available at 1.62.1. Reach for the right-hand column when writing new code; a
CodeceptJS call that transliterates into the left-hand column is a signal to look here first.

| Instead of | Use | Since |
| --- | --- | --- |
| `evaluate(el => getComputedStyle(el).x)` | `expect(locator).toHaveCSS(prop, value)`; `{ pseudo: '::before' }` for pseudo-elements | 1.60 |
| `toHaveClass(/partial/)` or a `[class*="..."]` selector | `expect(locator).toContainClass('name')` | 1.52 |
| `evaluate(() => localStorage.getItem(...))` | `page.localStorage` / `page.sessionStorage` | 1.61 |
| hand-registered `console` / `request` listeners | `page.consoleMessages()`, `page.pageErrors()`, `page.requests()` | 1.56 |
| a long chain of structural DOM assertions | `expect(page).toMatchAriaSnapshot()` | 1.60 |
| a manual truthiness wait on page state | `locator.waitForFunction()` | 1.62 |

## Do not introduce

Removed or deprecated upstream:

- `page.accessibility` - removed in 1.57; use an external accessibility library.
- `browserContext.on('backgroundpage')` and `backgroundPages()` - deprecated in 1.56.
- `?` and `[]` glob patterns in `page.route()` - removed in 1.52. Relevant to the `context`
  override in `e2e_tests/fixtures/pmmTest.ts`; use a regular expression instead.
- `-gv` shorthand - removed in 1.54; use `--grep-invert`.

## Structure

- `import pmmTest from '@fixtures/pmmTest';` and `import { expect } from '@playwright/test';`.
  Never a bare `test` in a `*.test.ts`.
- Wrap meaningful phases in `await pmmTest.step('<sentence>', async () => { ... })`, including
  value-returning steps.
- Timeouts always come from `@helpers/timeouts`, never a bare number.
- Every POM, helper, API client, and component used by a test is registered in
  `e2e_tests/fixtures/pmmTest.ts` and destructured alphabetically in the test signature.
- Arrow functions only; `func-style` and `no-restricted-syntax` enforce it.
- Each test is self-contained: no state carried between tests, cleanup in `finally`.

## Deviations from upstream, deliberate

Do not "correct" these. They are load-bearing.

- **Tags live inside the title string**, not the native `{ tag: [...] }` option, because
  `.github/workflows/*e2e-tests-matrix*.yml` greps titles. `playwright/valid-test-tags` is `off`
  for this reason. Migration must preserve every original CodeceptJS tag verbatim.
- **No `expect` timeout in `playwright.config.ts`**, so the default 5s applies and individual
  assertions carry an explicit `Timeouts.X` where they need longer.
- **`fullyParallel: true` with `workers: 1` by default**; do not assume cross-test parallelism.

A migration never upgrades Playwright and never edits `playwright.config.ts`.

## Companions

Read alongside, not duplicated here:

- `e2e_tests/CONTRIBUTING.md` - POM, fixture, and test templates.
- `.agents/workflows/pomRules.md` - POM structure and locator rules.
- `AGENTS.md` - repository-wide do and do-not list.
- `e2e_tests/eslint.config.mjs` - the rules that are actually enforced.

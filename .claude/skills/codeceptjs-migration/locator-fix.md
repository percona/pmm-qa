# Broken Locator Fix Workflow (canonical - referenced by SKILL.md, context.md, run.md)

When a live run fails on a locator (timeout, not visible, strict mode violation), behavior preservation still applies: fix the `Locator` so it targets the same element the Codecept source intended. Never weaken assertions or click a different control.

Trace path hint: failures write under `e2e_tests/test-results/`; open the `trace.zip` for the failed test.

Do not use playwright-cli for migration verification. Do not change test behavior to work around a bad locator. **Max 2 locator-fix loops per run.**

## Steps

1. **Trace first:** `playwright.config.ts` uses `trace: retain-on-first-failure`. Open `npx playwright show-trace test-results/<run-folder>/trace.zip`, inspect the failing step, update the POM locator, and re-run the test.
2. **Browser MCP fallback** only when the trace is missing, empty, or does not show the target. Follow `.agents/workflows/mcpRules.md` and `.agents/workflows/pmmLogin.md`, do exactly one DOM discovery pass for the failing control, update the POM, and re-run.

After a substantial POM fix, rerun changed-file ESLint/TypeScript validation and reverify the locator before rerunning.

## Three MCP checks that answer the wrong question

- **A dashboard locator run against the top document counts 0 and reads exactly like a dead locator.** Grafana panels render inside `#grafana-iframe`; `page.locator('section[data-testid=...]')` at top level returns 0 while the title and sidebar render fine, so the failure presents as a wrong locator rather than the wrong frame. Verify every dashboard locator through `grafanaIframe()` (`base.page.ts`), and treat a zero count on a panel as a frame-scoping mistake until the same locator has been tried inside the frame.
- **Credentials in the URL bypass the PMM shell.** `pmmLogin.md` already forbids it; this is the consequence that makes the failure recognizable. Navigating to `https://<user>:<pass>@<host>/graph/...` serves Grafana at top level with no `#grafana-iframe` at all, so a correct iframe-scoped locator counts 0 and reads as broken. A clean navigation reproduces the redirect into `/pmm-ui/...` and the iframe. If a locator that should be inside the frame resolves at top level, or the frame is missing entirely, suspect the navigation before the locator.
- **`expect` is not loadable inside the Playwright MCP server process**, so the mutation proof the audit checklist requires cannot be run there literally - `require` of both `@playwright/test` and `playwright/test` fails. Emulate the matcher instead (for `toHaveText`: strict single-node resolution plus whitespace-normalized `textContent` equality) and say in the evidence that it is an emulation, never a bare PASS/FAIL. When the fix was to narrow an ambiguous locator, prefer the stronger form: compare the un-narrowed locator's `allTextContents()` with the narrowed one's. That names the node the narrowing dropped, where a mutation only shows that some assertion moved.

## Lazy rendering

A count taken on a default load covers only what Grafana has rendered: panels below the fold render on scroll (`graph/d/pmm-health` renders 19 of 81 sections on load, and four titles that count 1 there count 2 after `loadAllPanels()`). Run every uniqueness count after `loadAllPanels()` or a full scroll and report both numbers, sections rendered and matches per locator. A passing strict-mode run is not evidence of uniqueness. Where a title genuinely repeats, scope by `[data-griditem-key="grid-item-<panelId>"]` plus the title through a builder, without fields outside `DashboardInterface`; `.first()` is positional and fails silently.

## Locator rules

- All POM entries must be Playwright `Locator` objects (`this.page.getByTestId(...)`, etc.), not strings.
- Reuse existing locators from `context.md` section 4 when the same page already exists in `e2e_tests`.
- `$foo` in Codecept often maps to a different rendered test id; confirm against trace/MCP DOM, not by guess.
- Chained `locate().find()` maps to chained `.locator()`; preserve scope.

# Broken Locator Fix Workflow (canonical — referenced by SKILL.md, context.md, run.md)

When a live run fails on a locator (timeout, not visible, strict mode violation), behavior preservation still applies: fix the `Locator` so it targets the same element the Codecept source intended. Never weaken assertions or click a different control.

## Priority order

| Priority | Tool                 | When                                                                                                                                                                                                                                                                                  |
| -------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | **Playwright trace** | Always try first. Config retains trace on first failure. `npx playwright show-trace <path-to-trace.zip>`. Inspect DOM at the failing step; fix POM; re-run test.                                                                                                                      |
| 2        | **Browser MCP**      | Only if trace is unavailable, empty, or the target page/iframe isn't reached. Login per `.agents/workflows/pmmLogin.md` — not the UI login form; navigate to the POM `url`; **one** `browser_snapshot`/CDP pass per page; update POM; re-run. Rules: `.agents/workflows/mcpRules.md`. |

Trace path hint: failures write under `e2e_tests/test-results/`; open the `trace.zip` for the failed test.

Do not use playwright-cli for migration verification. Do not change test behavior to work around a bad locator. **Max 2 locator-fix loops per run.**

## Steps

1. **Trace first:** `playwright.config.ts` uses `trace: retain-on-first-failure`. Open `npx playwright show-trace test-results/<run-folder>/trace.zip`, inspect the failing step, update the POM locator, and re-run the test.
2. **Browser MCP fallback** only when the trace is missing, empty, or does not show the target. Follow `.agents/workflows/mcpRules.md` and `.agents/workflows/pmmLogin.md`, do exactly one DOM discovery pass for the failing control, update the POM, and re-run.

After a substantial POM fix, rerun changed-file ESLint/TypeScript validation and reverify the locator before rerunning.

## Locator rules

- All POM entries must be Playwright `Locator` objects (`this.page.getByTestId(...)`, etc.), not strings.
- Reuse existing locators from `context.md` §4 when the same page already exists in `e2e_tests`.
- `$foo` in Codecept often maps to a different rendered test id; confirm against trace/MCP DOM, not by guess.
- Chained `locate().find()` maps to chained `.locator()`; preserve scope.

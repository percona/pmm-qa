# Broken Locator Fix Workflow

When a live run fails on a locator (timeout, not visible, strict mode violation), fix the `Locator` so it targets the element the CodeceptJS source intended. Never weaken an assertion, click a different control, or change test behaviour to work around a bad locator. Max 2 locator-fix loops per run.

## Steps

1. **Trace first.** The failure message already carries `errorContext`, an aria snapshot of the page at the moment of failure (1.60): read it before opening anything. `playwright.config.ts` uses `trace: retain-on-first-failure`; failures write under `e2e_tests/test-results/`. `npx playwright show-trace test-results/<run-folder>/trace.zip`, inspect the failing step, update the POM locator, re-run.
2. **`playwright-cli`** (Live DOM checks below) only when the trace is missing, empty, or does not show the target: one DOM discovery pass for the failing control, update the POM, re-run.

After a substantial POM fix, rerun changed-file ESLint and TypeScript and reverify the locator before re-running the test.

## Live DOM checks

Every live locator check runs through `playwright-cli` on the runner host, the only browser tool an unattended run has; never a browser MCP server, which a scheduled session does not load. Work from a scratch directory (it writes `.playwright-cli/` there), name the session after the run id, and log in with the Basic Auth header, never the UI form:

```bash
mkdir -p <scratchpad>/pwcli && cd <scratchpad>/pwcli || exit 1
export PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS=true
AUTH=$(printf 'admin:%s' "$ADMIN_PASSWORD" | base64 -w0)
playwright-cli -s=<run_id> open about:blank
playwright-cli -s=<run_id> run-code "async page => { await page.setViewportSize({ width: 1920, height: 1080 }); await page.context().setExtraHTTPHeaders({ Authorization: 'Basic $AUTH' }); await page.route('**/api/user/auth-tokens/rotate', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })); await page.goto('${PMM_UI_URL%/}/pmm-ui/help'); }"
playwright-cli -s=<run_id> --raw run-code "async page => { await page.goto('${PMM_UI_URL%/}/<POM url>'); await page.locator('#grafana-iframe').waitFor(); const f = page.frameLocator('#grafana-iframe'); await f.getByTestId('table-tbody-tr').first().waitFor(); return { running: await f.getByTestId('table-tbody-tr').getByText('Running', { exact: true }).count() }; }"
playwright-cli -s=<run_id> snapshot   # aria tree with iframes, for discovery
playwright-cli -s=<run_id> close
```

Batch a page's counts into one `run-code` that returns an object; `--raw` prints only that object, which is the evidence.

## Four live checks that answer the wrong question

- **Dashboard locators live inside `#grafana-iframe`.** `page.locator('section[data-testid=...]')` at top level counts 0 while the title and sidebar render fine. Verify every dashboard locator through `grafanaIframe()` (`base.page.ts`); a zero count on a panel is a frame-scoping mistake until the locator has been tried inside the frame.
- **Credentials in the URL bypass the PMM shell.** `https://<user>:<pass>@<host>/graph/...` serves Grafana at top level with no `#grafana-iframe`, so a correct iframe-scoped locator counts 0. A clean navigation redirects into `/pmm-ui/...` and the iframe. If a frame locator resolves at top level or the frame is missing, suspect the navigation first.
- **The `playwright-cli` browser is not the suite's browser.** It defaults to a smaller viewport while `playwright.config.ts` pins 1920x1080, so a virtualised list unmounts rows the suite keeps on screen, and an emulation that scrolls must pace itself the way the code does (`toPass({ intervals: [ONE_SECOND] })`), not press a key in a tight loop. Both produce false failures. Set the viewport and mirror the pacing before trusting a count.
- **`expect` is not defined inside `playwright-cli run-code`.** Emulate the matcher (for `toHaveText`: strict single-node resolution plus whitespace-normalised `textContent` equality) and label the evidence as an emulation, never a bare PASS/FAIL. When the fix narrowed an ambiguous locator, compare the un-narrowed locator's `allTextContents()` with the narrowed one's: that names the node the narrowing dropped.

## Lazy rendering

A count on a default load covers only what Grafana has rendered: panels below the fold render on scroll (`graph/d/pmm-health` renders 19 of 81 sections on load, and four titles that count 1 there count 2 after `loadAllPanels()`). Run every uniqueness count after `loadAllPanels()` or a full scroll and report both numbers, sections rendered and matches per locator. A passing strict-mode run is not evidence of uniqueness. A count is valid only in the state it was taken, so a builder that takes a display name as data is counted in every state the test reaches, against the name that collides: Grafana gives a folder row and a dashboard row inside it one test id when their titles match (`PMM Health`), and a non-strict CodeceptJS source proves nothing about strict-mode uniqueness. Emulating a POM method reproduces its settle waits and re-reads its loop bound each iteration; a snapshotted bound leaves rows collapsed and invents missing names. Where a title genuinely repeats, scope by `[data-griditem-key="grid-item-<panelId>"]` plus the title through a builder, without fields outside `DashboardInterface`; `.first()` is positional and fails silently.

## Locator rules

- Every POM entry is a `Locator`, not a string (`playwright-practices.md` Locators). Reuse an existing locator when the page already exists in `e2e_tests` (`SKILL.md` Repository map).
- A CodeceptJS `$foo` often maps to a different rendered test id; confirm against the trace or a `playwright-cli` count.
- Chained `locate().find()` maps to chained `.locator()`; preserve scope.

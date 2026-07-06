---
description: Daily CodeceptJS -> Playwright migration run (one test per day, behavior-preserving, live-verified)
---

# Daily Migration Run

Migrate exactly ONE CodeceptJS test per run into `e2e_tests`, verify it with a real live run against a
locally provisioned PMM, and update the tracker. Follow every step in order. Do not skip the confidence
gate. Do not migrate more than one source test per run.

## Inputs / references (read only what you need)

- Context pack: `.agents/codeceptjs-migration/context.md` (provisioning, repo map, registration points,
  existing inventory, commands). READ THIS FIRST instead of scanning the repo.
- Tracker: `.agents/codeceptjs-migration/tracker.md` (pick the work item; update it at the end).
- Migration rules: `.agents/skills/codeceptjs-migration-ai/SKILL.md` + its `references/`.

## STRICT rules (non-negotiable)

1. Behavior preservation: the migrated Playwright test MUST reproduce the source test exactly - same
   flow, same `Before`/`After` setup/cleanup, same assertions and their semantics, same data-driven
   iterations, same tags, same locator targets. No added/removed/weakened/"improved" coverage, no
   invented waits. If a faithful mapping is impossible, STOP and report.
2. Confidence gate: after migration and BEFORE any live run, do a line-by-line critical analysis and
   emit a confidence %. Only run the test if confidence > 95% with zero unexplained discrepancies.
   Otherwise set the row to `needs-review` with the exact gaps and STOP (no run, no PR).

## Procedure

### Step 0 - Load context

Read `.agents/codeceptjs-migration/context.md`. Do NOT re-scan the whole repo.

### Step 1 - Select the work item

Open `tracker.md`, pick the FIRST row with `status = pending` (top-to-bottom). Set it to `in-progress`.
If there are no `pending` rows, post a Slack note "migration backlog empty" and stop.

### Step 2 - Confirm env from source, then provision

1. Read the source test's `Before`/`BeforeSuite`/`Data(...)` to confirm what DB/services it needs.
   Update the row's `Env`/`Setup` if the actual need differs from the planned value.
2. Provision per `context.md` section 1:
   - Bring up the PMM server (compose up + wait for `/v1/server/readyz` = 200) if not already running.
   - Attach the client (`pmm3-client-setup.sh`).
   - If `Setup` is non-empty, run `python pmm-framework.py --pmm-server-password=admin --verbose <Setup>`
     inside the venv.
3. If provisioning is impossible on this host (cloud RDS/Aurora/Azure, AMI/OVF, external pmm-demo, or a
   framework failure), set the row to `blocked-on-env`, record what infra is missing in Notes, go to
   Step 8 (Slack), and STOP.

### Step 3 - Check for an existing target

Look at the row's target folder. If an existing `e2e_tests` test already covers this source (see the
tracker "reconciliation" note - QAN/rta, valkey, docker `srvFolder`/`clickHouse`, etc.), mark the row
`done` with a note ("already covered by <path>"), go to Step 8, and STOP. Do not duplicate coverage.

### Step 4 - Migrate (behavior-preserving)

Follow `SKILL.md`:
- Migrate the test file + its POMs (`*.page.ts` extending `BasePage`) + API clients (`*.api.ts`) +
  custom-step usages (map via `context.md` section 5 / `mappings.md`; create `NotificationComponent`
  and `archive.helper.ts` if first needed).
- Reuse existing fixtures/helpers/API/components from `context.md` section 4; do not recreate them.
- Register new POM fixtures in `fixtures/pmmTest.ts`, new API clients in `api/api.ts`, new API paths in
  `helpers/apiEndpoints.ts`. Use `Timeouts` for any explicit wait.
- Prefer `Edit` over `Write` on existing files. No comments in migrated tests. Arrow functions only.
- Do NOT migrate `.retry(N)`; omit tests that are BOTH skipped AND commented out.

### Step 5 - Static validation

From `e2e_tests/`: `npx tsc --noEmit -p tsconfig.json` and `npx eslint .` (fix issues). Both must pass.

### Step 6 - Confidence gate (MANDATORY, before any run)

Do the `CriticalAuditGate` from `SKILL.md`: line-by-line migrated-vs-source comparison covering flow,
setup/cleanup hooks, every assertion, data loops, tags, locator semantics, timeouts. Output the audit
checklist + a confidence %.
- If confidence > 95% and discrepancies = none -> continue to Step 7.
- Else -> set the row to `needs-review`, record the specific gaps in Notes, go to Step 8, and STOP.

### Step 7 - Live run

From `e2e_tests/` run only the migrated file: `npx playwright test tests/<category>/<name>.test.ts`.
Retry once if the failure looks like flake (timeout/transient).

**On locator / visibility failure** (not env/provisioning): follow **Step 7a** below before marking
`failed`. You may loop Step 7 + 7a up to **2** locator-fix attempts; then mark `failed` if still broken.

Then:
- PASS -> set the row `done`, record confidence % and date.
- Hard FAIL (after Step 7a exhausted or non-locator failure) -> set the row `failed`, record the root
  cause in Notes. No PR.

### Step 7a - Fix broken locators (trace first, MCP fallback)

Behavior preservation still applies: fix the `Locator` so it targets the **same element** the Codecept
source intended — never weaken assertions or click a different control.

**Order (most efficient first):**

1. **Trace on failure (default)** — `playwright.config.ts` uses `trace: retain-on-first-failure`.
   - Open: `npx playwright show-trace test-results/<run-folder>/trace.zip` (or the path printed in the failure output).
   - In the trace: find the failing step, inspect the DOM snapshot at that moment, note the real
     `data-testid` / role / label / iframe context.
   - Update the POM `Locator` (`getByTestId` > `getByRole` > `getByLabel` > `locator`; use
     `grafanaIframe()` for `#grafana-iframe` content per `context.md`).
   - Re-run Step 7. Do **not** start a separate browser session if the trace already shows the element.

2. **Browser MCP (fallback only)** — use when the trace is missing, empty, or does not show the target
   (e.g. wrong page never reached, iframe not captured). Follow `.agents/workflows/mcpRules.md`:
   - Log in with `.agents/workflows/pmmLogin.md` (Basic Auth headers + route mocks + `graph/login`; do
     **not** use the UI login form).
   - Navigate to the POM `url` (or the step URL from the source test).
   - Do **exactly ONE** DOM discovery pass (`browser_snapshot` and/or CDP) for the failing control;
     update the POM; stop browsing.
   - Re-run Step 7.

**Locator rules during fix:**
- All POM entries must be Playwright `Locator` objects (`this.page.getByTestId(...)`, etc.), not strings.
- Reuse existing locators from `context.md` section 4 when the same page already exists in `e2e_tests`.
- `$foo` in Codecept often maps to a different rendered test id (e.g. `$publicAddress-text-input` ->
  `getByTestId('text-input-public-address')`) — confirm against trace/MCP DOM, not by guess.
- Chained `locate().find()` -> chained `.locator()`; preserve scope.

After a successful locator fix, re-check confidence % if the POM change was substantial; re-run Step 7.

### Step 8 - PR + tracker + Slack

1. Update the tracker row (status, confidence %, date, notes).
2. On `done` only: create a branch (e.g. `migrate/<name>`), commit the migrated files + tracker update,
   push, and open a PR in `pmm-qa` (base `main`) via `gh pr create`. Title:
   `migrate(<category>): <name> codeceptjs -> playwright`. Body: source path, target path, tags,
   confidence %, live-run result, audit summary. Put the PR URL in the row Notes.
3. Post a Slack summary to `#pmm-ai` for EVERY outcome (`done`/`failed`/`needs-review`/`blocked-on-env`):
   test name, status, confidence %, and PR link (if any).

### Step 9 - Definition of Done output

Output the `SKILL.md` DoD sequence: Audit Checklist -> Verdict (PASS/FAIL) -> Final Report (Files
Changed, Validation Run, Discrepancies, Confidence %). Then stop - one test per run.

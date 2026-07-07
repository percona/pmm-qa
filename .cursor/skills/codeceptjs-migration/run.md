---
description: Daily CodeceptJS -> Playwright migration run (one test per day, behavior-preserving, live-verified)
---

# Daily Migration Run

Migrate exactly ONE CodeceptJS test per run into `e2e_tests`, verify it with `.cursor/scripts/run-migration-single-test.sh`, and update the tracker. Follow every step in order. Do not skip the confidence gate. Do not migrate more than one source test per run.

## Inputs / references

- Context pack: `.cursor/skills/codeceptjs-migration/context.md` (provisioning, repo map, registration points, existing inventory, commands). READ THIS FIRST.
- Tracker: `.cursor/skills/codeceptjs-migration/tracker.md` (pick the work item; update it at the end).
- Migration rules: `.cursor/skills/codeceptjs-migration/SKILL.md` + its `references/`.
- Live-run script: `.cursor/scripts/run-migration-single-test.sh` (fixed server image: `perconalab/pmm-server:3-dev-latest`).

## STRICT rules

1. Behavior preservation: the migrated Playwright test MUST reproduce the source test exactly - same flow, same `Before`/`After` setup/cleanup, same assertions and their semantics, same data-driven iterations, same tags, same locator targets. No added/removed/weakened/"improved" coverage, no invented waits. If a faithful mapping is impossible, STOP and report.
2. Confidence gate: after migration and BEFORE any live run, do a line-by-line critical analysis and emit a confidence %. Only run the test if confidence > 95% with zero unexplained discrepancies. Otherwise set the row to `needs-review` with the exact gaps and STOP.
3. Git/remote actions are not automatic. Do not create branches, commits, pushes, PRs, or Slack posts unless the user explicitly asks for them.

## Procedure

### Step 0 - Load context

Read `.cursor/skills/codeceptjs-migration/context.md`. Do NOT re-scan the whole repo.

### Step 1 - Select the work item

Open `tracker.md`, pick the FIRST row with `status = pending` (top-to-bottom), and set it to `in-progress`. If there are no `pending` rows, report `migration backlog empty` and stop.

### Step 2 - Confirm env and live-run arguments

1. Read the source test's `Before`/`BeforeSuite`/`Data(...)` to confirm what DB/services it needs. Update the row's `Env`/`Setup` if the actual need differs from the planned value.
2. Derive the live-run command arguments:
   - `<test_file>`: migrated file path relative to `e2e_tests/`, for example `tests/configuration/pmmInventory.test.ts`.
   - `<setup_services>`: the tracker `Setup` value, or an empty string when no DB/service provisioning is needed.
   - `<setup_client>`: `true` only when the source test needs a standalone PMM Client/node outside `pmm-framework.py` provisioning; use `false` for pure UI tests and for DB/service tests where `pmm-framework.py` creates the monitored services.
3. The live-run script uses fixed `DOCKER_VERSION=perconalab/pmm-server:3-dev-latest` and `ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin-password}`. Use that same password for server readiness, PMM client setup, `pmm-framework.py`, and Playwright runtime. Override `ADMIN_PASSWORD=...` only when intentionally testing a different password.
4. If required infra cannot be created by local Docker/Cursor Cloud (cloud RDS/Aurora/Azure, AMI/OVF, external pmm-demo), set the row to `blocked-on-env`, record the missing infra in Notes, go to Step 8, and STOP.

### Step 3 - Best-fit target (mandatory before writing code)

1. Read the source scenarios' **behavior** (page URL, POMs, tags, hooks) — not just the Codecept filename.
2. Search `context.md` section 4 and the tracker reconciliation notes for an existing Playwright file that already covers the same page/feature/fixtures (e.g. help-page log download → `helpCenter.test.ts`, left-menu traversal → `navigation.test.ts`).
3. If an existing `e2e_tests` file is the best fit, **append** the migrated scenario(s) there. Do **not** create a new `*.test.ts` when a suitable file exists.
4. If coverage already exists with no gaps, mark the row `done` with Notes `already covered by <path>` and still rename the source (Step 8a), then STOP.
5. Only create a new Playwright test file when no best-fit target exists. Record the **actual** target path in the tracker `Target` column (may differ from the tracker's initial guess).

### Step 4 - Migrate (behavior-preserving)

Follow `SKILL.md`:
- Migrate the test file + its POMs (`*.page.ts` extending `BasePage`) + API clients (`*.api.ts`) + custom-step usages (map via `context.md` section 5 / `mappings.md`; create `NotificationComponent` and `archive.helper.ts` if first needed).
- Reuse existing fixtures/helpers/API/components from `context.md` section 4; do not recreate them.
- Register new POM fixtures in `fixtures/pmmTest.ts`, new API clients in `api/api.ts`, new API paths in `helpers/apiEndpoints.ts`. Use `Timeouts` for any explicit wait.
- Prefer surgical edits on existing files. No comments in migrated tests. Arrow functions only.
- Do NOT migrate `.retry(N)`; omit tests that are BOTH skipped AND commented out.

### Step 5 - Static validation

From `e2e_tests/`: `npx tsc --noEmit -p tsconfig.json` and `npx eslint .`. Both must pass before a live run.

### Step 6 - Confidence gate (MANDATORY, before any run)

Do the `CriticalAuditGate` from `SKILL.md`: line-by-line migrated-vs-source comparison covering flow, setup/cleanup hooks, every assertion, data loops, tags, locator semantics, and timeouts. Output the audit checklist + confidence %.
- If confidence > 95% and discrepancies = none -> continue to Step 7.
- Else -> set the row to `needs-review`, record the specific gaps in Notes, go to Step 8, and STOP.

### Step 7 - Live run (script is canonical)

From repo root, run exactly one migrated file through the Cursor script:

```bash
chmod +x .cursor/scripts/run-migration-single-test.sh
./.cursor/scripts/run-migration-single-test.sh '<test_file>' '<setup_services>' <setup_client>
```

Examples:

```bash
./.cursor/scripts/run-migration-single-test.sh 'tests/helpCenter.test.ts' '' false
./.cursor/scripts/run-migration-single-test.sh 'tests/configuration/pmmInventory.test.ts' '--database pdpgsql' false
./.cursor/scripts/run-migration-single-test.sh 'tests/dashboards/nodesOverviewDashboard.test.ts' '' true
```

Retry once only if the failure is clearly transient. For locator / visibility failure, follow Step 7a before marking `failed`. You may loop Step 7 + 7a up to 2 locator-fix attempts.

Then:
- PASS -> rename the Codecept source (Step 8a), set the row `done`, record confidence %, date, and live-run command.
- Hard FAIL -> set the row `failed`, record the root cause and failed command in Notes. Do **not** rename the source file.

### Step 7a - Fix broken locators (trace first, MCP fallback)

Behavior preservation still applies: fix the `Locator` so it targets the same element the Codecept source intended. Never weaken assertions or click a different control.

1. Trace first: `playwright.config.ts` uses `trace: retain-on-first-failure`. Open `npx playwright show-trace test-results/<run-folder>/trace.zip`, inspect the failing step, update the POM locator, and re-run Step 7.
2. Browser MCP fallback only when the trace is missing, empty, or does not show the target. Shared MCP workflow docs remain under `.agents/workflows/`: follow `.agents/workflows/mcpRules.md` and `.agents/workflows/pmmLogin.md`, do exactly one DOM discovery pass for the failing control, update the POM, and re-run Step 7.

Locator rules:
- All POM entries must be Playwright `Locator` objects (`this.page.getByTestId(...)`, etc.), not strings.
- Reuse existing locators from `context.md` section 4 when the same page already exists in `e2e_tests`.
- `$foo` in Codecept often maps to a different rendered test id; confirm against trace/MCP DOM, not by guess.
- Chained `locate().find()` maps to chained `.locator()`; preserve scope.

After a substantial POM fix, re-check confidence % before re-running.

### Step 8a - Rename Codecept source (PASS only)

CodeceptJS CI discovers tests via `tests/**/*_test.js` in `codeceptjs-e2e/pr.codecept.js`. After a **successful** live run, exclude the migrated file from workflows by renaming it in place:

```bash
git mv codeceptjs-e2e/tests/<path>/<name>_test.js codeceptjs-e2e/tests/<path>/<name>_migrated.js
```

Example: `leftNavigation_test.js` → `leftNavigation_migrated.js`. Update the tracker `Source` column to the `_migrated.js` path. Keep the file as a migration reference; do not delete it.

### Step 8 - Tracker + handoff

1. Update the tracker row (status, confidence %, date, notes, and live-run command/result when applicable).
2. Report the outcome in chat with files changed, validation run, discrepancies, confidence %, and tracker status.
3. Only if the user explicitly asks: create a branch, commit, push, open a PR, or post Slack updates.

### Step 9 - Definition of Done output

Output the `SKILL.md` DoD sequence: Audit Checklist -> Verdict (PASS/FAIL) -> Final Report (Files Changed, Validation Run, Discrepancies, Confidence %). Then stop - one test per run.
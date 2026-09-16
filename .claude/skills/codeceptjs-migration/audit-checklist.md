# Migration Review Checklist

The reviewer works this twice: before execution and after. Clear the Shape block first.

## Initial review

### Shape

- [ ] `bash .claude/scripts/check-migration-conventions.sh <every changed file>` run by the reviewer, output pasted, zero failures, every advisory answered. Advisories on pre-existing lines are not blockers.
- [ ] No name with one consumer anywhere in the diff (method, `const`, interface, type alias, row field, helper file), counted across files. Pre-existing methods exposed for reuse are not findings; `e2e_tests/eslint.config.mjs` whitelists single-caller assertion helpers by name.
- [ ] A dashboard source produced a `DashboardInterface` page object registered on `Dashboards`, panels listed there as an inline `metrics` literal, no field outside the interface; the test iterates through the fixture, never `new <X>Dashboard()`.
- [ ] One test per `Data(...)` row, distinguishable by title; a bare `Scenario` whose loop lives in a page-object method is one test with a `for` loop. Row titles end in the one distinguishing value, no JSON.
- [ ] Zero comments in `*.test.ts`; no added comment outside tests narrates a decision.
- [ ] Nothing inert was ported (`SKILL.md` Port behaviour, simplify shape); each removal is recorded and outcome-neutral.
- [ ] Every scenario passed the worth-porting gate with evidence (`SKILL.md` Before migrating).
- [ ] Every assertion can fail where it stands; the riskiest one was proven by mutating its expected value and re-running (inverting a matcher is not a mutation). Through MCP, `expect` is unavailable: emulate and label the evidence. Locator values go through web-first matchers or `expect.poll` (precedent: `e2e_tests/tests/changeTheme.test.ts`); bare `expect` stays correct for API status, CLI stdout and parsed files.
- [ ] Every locator is at the highest resolving ladder rung; for each CSS-by-class locator the reviewer showed nothing higher resolves. No text spliced into selector source. No `.getBy*(` or `.locator(` in a test file, including a refinement chained off a builder.
- [ ] No `pmmTest.step` around a single `expect`. Each construct with an alternative (locator form, step granularity, navigation, POM shape, assertion style) matches the dominant `e2e_tests` form or the deviation is justified. Count, do not argue.
- [ ] Cleanup restores from constants and works on every path, including a failure between the mutation and the variable the source read.
- [ ] No relative imports, no config repeated in tests, no fixed pauses.
- [ ] No function or method declared in a `*.test.ts`; repeated blocks became a POM or helper method with the assertions left in the test. No new `private` without a stated reason; no wrapper around a single click; no wait inside a POM beyond a load guard or the event its own action needs.
- [ ] The reviewer agent's Maintainer's rules were applied to the diff and every hit is in `findings` with its severity.

### Completeness

- [ ] Every active scenario is migrated; commented-out ones excluded. For `already-covered`, each scenario is mapped to existing Playwright coverage.
- [ ] Every `PMM-Txxxx` id and every original tag preserved; a destination tag may be added, never substituted.
- [ ] Completeness proved by comparing both runners' listings programmatically on count, rows per scenario, ids, tag sets and each row's distinguishing value. Playwright side from the `list` reporter (the `json` reporter reorders describe-wrapped specs). CodeceptJS side from `npx codeceptjs dry-run` on a scratchpad copy of `pr.codecept.js` with `NODE_PATH=codeceptjs-e2e/node_modules` and `include` and `helpers.*.require` paths absolutised.
- [ ] The writer's `scenarioSelectability` report re-derived: every scenario matches an existing job's grep or carries `destinationTagNeeded: true` with a plan for step 5b.

### Fidelity

- [ ] Hooks, suite setup, cleanup, assertion strictness, and UI/API/CLI/download/file behaviour preserved. Reachable custom steps inspected and mapped.
- [ ] Explicit `.retry(N)` pinned at the source's scope (`SKILL.md` Waits and retries); version conditionals use `versionGates.ts`.
- [ ] Where a helper branches on server configuration, `docker exec pmm-server env` was read and the evidence names the branch the green run took.
- [ ] Every new or edited invocation checked against `mappings.md` Helpers, CodeceptSyntax, Custom Steps and Skip policy. No `eslint-disable` added to dodge a rule fixable in code.

SafeOmission registry:

| Pattern | Rule |
| --- | --- |
| `parseInt(x, 10)` | `parseInt(x)` for decimal version segments. |
| `expect()` inside changed helpers | Assertions stay in tests. |
| `pmmTest.skip` without skip-policy comments | Required by `mappings.md` Skip policy. |
| Copied PR patterns | Flag when old code conflicts with current `mappings.md`. |

### Dependencies

- [ ] Every name the source injects resolved through the `codeceptConfigHelper.js` include map and its `require` chain inspected; target candidates found by grep and opened.
- [ ] Existing abstractions reused (`SKILL.md` Reuse with the smallest diff); new fixtures, POMs, API clients or endpoints registered only when required.

### Playwright practices

Against `playwright-practices.md`, changed files only.

- [ ] `verifiedAgainst` matches `@playwright/test` in `e2e_tests/package.json`; `playwright.config.ts` and the pinned version unchanged.
- [ ] Every POM entry is a `Locator`, not a string. No manual-predicate assertion or hand-rolled polling loop. `toHaveCount`, `toBeHidden`, `toHaveCSS`, `toContainClass` used where they apply; non-locator assertions carry a message.
- [ ] Each `nth()`, `first()`, `last()` is deliberate indexing, not a strict-mode workaround.
- [ ] `playwright-practices.md` Prefer the modern API applied; no removed API (`page.accessibility`, `backgroundPages()`, `?`/`[]` route globs, `-gv`).
- [ ] Documented deviations preserved: tags inside the title, explicit `Timeouts.X` where needed.
- [ ] No `I.*` calls remain; changed-file ESLint and `tsc --noEmit` introduce zero new failures.

### MCP locator verification

- [ ] Every new, changed, or ambiguous reused locator verified: match count over the fully rendered DOM (`loadAllPanels()` or full scroll on a dashboard, `locator-fix.md` Lazy rendering), element identity, iframe boundary. Both numbers stated: sections rendered and matches per locator.

## Initial decision

```text
Shape findings: 0
Convention script failures: 0
Missing scenarios: 0
Missing assertions: 0
Missing hooks or cleanup: 0
Missing data rows: 0
Unresolved dependencies: 0
Unverified locators: 0
Unresolved scenario selectability: 0
New TypeScript failures: 0
New ESLint failures: 0
Migration convention violations: 0
Playwright practice violations: 0
Result: READY_TO_RUN
```

Any non-zero value produces `REVIEW_FAILED` or `LOCATOR_FIX_REQUIRED`.

## Final post-run review

- [ ] Required executions or already-covered regression passed against the final code; runtime and locator fixes did not change behaviour and still satisfy the Shape and Practices blocks.
- [ ] No source dependency omitted; no target registration missing.
- [ ] Every original tag remains. Existing CodeceptJS jobs and greps unchanged, except a job the retirement emptied, deleted in this PR.
- [ ] Every surface the source ran on enumerated per workflow file and cross-repository consumer (`branch-workflow.md` Workflow coverage table), `fb-e2e-suite.yml` named explicitly. Where an `@fb-*` CodeceptJS grep selected a scenario, a Playwright job mirroring the retiring source's `setup_services` was added there.
- [ ] Coverage shape follows `branch-workflow.md` Workflow coverage step 2: a tag appended to an existing `test_execution_playwright` entry where one exists for the surface, a new job only where none exists or on `fb-e2e-suite.yml`, a runner converted in place when this migration retired its last consumer. A nightly append exists only where the source's own tags were already in a nightly grep. No test runs twice in one PR run.
- [ ] `expected_test_jobs` matches the nightly `"test execution / "` entries after the edit, before and after stated. `expected_setup_jobs` matches the shards. Setup jobs start with `setup / `, nightly consumers with `test execution / `, and the poll step is named exactly `Waiting for tests execution`; a job renamed out of its prefix is invisible to the poller.
- [ ] Every migrated title selected, proven with `npx playwright test --list --grep '<expression>'` and a count; every tag the edited job already carried still selects what it did. No unescaped literal `|` in a grep (`launchable-prepare.js` compiles it as a regex). An added Launchable job passes a `--test-suite` distinguishing `playwright` from `codeceptjs`.
- [ ] No `${{ env.X }}` inside a `run:` line the migration wrote.
- [ ] Publish branch cut from `origin/main` and carries only migrated code, coverage YAML and the source retirement; control carries only the merge and tracker commits, worktree clean. Every commit subject is `<type>(<scope>): <summary>` and every claim in a commit body was re-measured against the tree.
- [ ] `e2e_tests/README.md` generated regions came from `support_scripts/generate_readme.py`.
- [ ] No debug code, no unrelated files, source safe to retire.
- [ ] The drafted PR body follows the template in `branch-workflow.md` Push and open the PR: 25 lines and 1,500 characters at most, no evidence or review history. Its `Run:` line names a run containing a job that executed the migrated scenarios.

## Final decision

```text
Missing scenarios: 0
Missing assertions: 0
Unresolved dependencies: 0
Unverified locators: 0
Unselectable scenarios: 0
Vacuous CodeceptJS jobs left undeleted: 0
Surfaces with coverage lost: 0
Manufactured nightly appends: 0
expected_test_jobs mismatches: 0
Required test execution: PASS
Target regression: PASS or NOT REQUIRED
Result: FINAL_REVIEW_PASS
```

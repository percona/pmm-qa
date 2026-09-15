# Migration Review Checklist

The reviewer works this twice: before execution and after. Every human comment on a migration PR to date falls in the Shape block; clear it first.

## Initial review

### Shape

- [ ] `bash .claude/scripts/check-migration-conventions.sh <every changed file>` was run by the reviewer, output pasted, zero failures, every advisory answered.
- [ ] No name with one consumer anywhere in the diff: method, `const`, interface, type alias, row field, helper file. Cross-file call counts, not single-file. Pre-existing methods exposed for reuse are not findings; `e2e_tests/eslint.config.mjs` whitelists single-caller assertion helpers by name. Advisories on pre-existing lines are not blockers.
- [ ] Data rows carry only what varies; the title suffix is the one distinguishing value, no `DataTable` JSON imitation.
- [ ] Zero comments in `*.test.ts`; no added comment outside tests narrates a decision.
- [ ] Nothing inert was ported (`SKILL.md` Port behaviour, simplify shape); each removal is recorded and outcome-neutral.
- [ ] Every scenario passed the worth-porting gate with evidence (`SKILL.md` Before migrating).
- [ ] Every assertion can fail where it stands; the riskiest one was proven by mutating its expected value and re-running (inverting a matcher is not a mutation). Through MCP, `expect` is unavailable: emulate and label the evidence. Locator values go through web-first matchers or `expect.poll` (`e2e_tests/tests/changeTheme.test.ts:61-65`); bare `expect` stays correct for API status, CLI stdout and parsed files.
- [ ] Every locator is at the highest resolving ladder rung. For each CSS-by-class locator the reviewer showed nothing higher resolves. No text spliced into selector source.
- [ ] No `pmmTest.step` around a single `expect`. Each construct with an alternative (locator form, step granularity, navigation, POM shape, assertion style) matches the dominant `e2e_tests` form or the deviation is justified. Count, do not argue.
- [ ] Cleanup restores from constants and works on every path, including a failure between the mutation and the variable the source read.
- [ ] No relative imports, no config repeated in tests, no fixed pauses in any file.
- [ ] No function or method declared in a `*.test.ts`; repeated blocks became a POM or helper method with the assertions left in the test. No new `private` without a stated reason; no wrapper around a single click; no waits inside a POM.
- [ ] The reviewer's Maintainer's rules section was applied to the diff and every hit is in `findings` with its severity.

### Completeness

- [ ] Every active scenario is migrated; commented-out ones are excluded. For `already-covered`, each scenario is mapped to existing Playwright coverage.
- [ ] Every `PMM-Txxxx` id and every original tag is preserved. A destination tag may be added, never substituted.
- [ ] Completeness was proved by comparing both runners' listings programmatically on count, rows per scenario, ids, tag sets and each row's distinguishing value. Playwright side from the `list` reporter (the `json` reporter reorders describe-wrapped specs). CodeceptJS side from `npx codeceptjs dry-run` on a scratchpad copy of `pr.codecept.js` with `NODE_PATH=codeceptjs-e2e/node_modules`, `include` and `helpers.*.require` absolutised, bare npm helper names left alone; the tracked config aborts on a missing `codeceptjs/effects`.
- [ ] One generated test per data row, each distinguishable by title; never a loop inside one test.
- [ ] The writer's `scenarioSelectability` report was re-derived: every scenario matches an existing job's grep or carries `destinationTagNeeded: true` with a plan for step 5b.

### Fidelity

- [ ] Hooks, suite setup, cleanup, assertion strictness, and UI/API/CLI/download/file behaviour are preserved. Reachable custom steps were inspected and mapped.
- [ ] Explicit `.retry(N)` is pinned at the source's scope (`SKILL.md` Waits and retries); version conditionals use `versionGates.ts`.
- [ ] Where a helper branches on server configuration, `docker exec pmm-server env` was read and the evidence names the branch the green run took.
- [ ] Zip entry assertions were re-derived: `custom_steps.js` maps `entryName` to the basename, `archive.helper.ts` returns the full path.
- [ ] Every new or edited invocation was checked against `mappings.md` Helpers, CodeceptSyntax, SafeOmission and Skip policy. No `eslint-disable` added to dodge a rule fixable in code.

#### SafeOmission registry

| Pattern | Rule |
| --- | --- |
| `parseInt(x, 10)` | `parseInt(x)` for decimal version segments. |
| `expect()` inside changed helpers | Assertions stay in tests. |
| `pmmTest.skip` without skip-policy comments | Required by `mappings.md` Skip policy. |
| Copied PR patterns | Flag when old code conflicts with current `mappings.md`. |

### Dependencies

- [ ] Source and target Graphify-linked files were independently inspected; both graphs were refreshed and committed on control before `in-progress`; stale edges accounted for.
- [ ] Existing abstractions reused per `SKILL.md` Reuse with the smallest diff; new fixtures, POMs, API clients or endpoints registered only when required.

### Playwright practices

Against `playwright-practices.md`, changed files only.

- [ ] `verifiedAgainst` matches `@playwright/test` in `e2e_tests/package.json`; `playwright.config.ts` and the pinned version are unchanged.
- [ ] Every POM entry is a `Locator`, not a string. No manual-predicate assertion or hand-rolled polling loop. `toHaveCount`, `toBeHidden`, `toHaveCSS`, `toContainClass` used where they apply; non-locator assertions carry a message.
- [ ] Each `nth()`, `first()`, `last()` is deliberate indexing, not a strict-mode workaround.
- [ ] PreferModernApi applied; no removed API (`page.accessibility`, `backgroundPages()`, `?`/`[]` route globs, `-gv`).
- [ ] Documented deviations preserved: tags inside the title, explicit `Timeouts.X` where needed.
- [ ] No `I.*` calls remain; changed-file ESLint and `tsc --noEmit` introduce zero new failures; changed docs are ASCII-only over added lines.

### MCP locator verification

- [ ] Every new, changed, or ambiguous reused locator is verified: match count, element identity, iframe boundary.

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
- [ ] Final source and target graphs checked; no source dependency omitted; no target registration missing.
- [ ] Every original tag remains. Existing CodeceptJS jobs and greps are unchanged, except a job the retirement emptied, which is deleted in this PR.
- [ ] Every surface the source ran on was enumerated per workflow file, `fb-e2e-suite.yml` named explicitly. Where an `@fb-*` CodeceptJS grep selected a scenario, a Playwright job mirroring the retiring source's `setup_services` was added there.
- [ ] A nightly entry exists only where the source's own tags were already in a nightly grep, appended to the existing `test_execution_playwright` alternation, no new matrix entry. No test runs twice in one PR run.
- [ ] `expected_test_jobs` matches the nightly `"test execution / "` matrix entries after the edit, before/after stated from the script's info line. `expected_setup_jobs` matches the shards. Setup jobs start with `setup / `, nightly consumers with `test execution / `, the poll step is named exactly `Waiting for tests execution`; a job renamed out of its prefix is invisible to the poller. A no-DB row's job is named outside `test execution / `.
- [ ] Every migrated title is selected, proven with `npx playwright test --list --grep '<expression>'` and a count; every tag the edited job already carried still selects what it did. No unescaped literal `|` in a grep (`launchable-prepare.js` compiles it as a regex).
- [ ] Any added Launchable job passes a `--test-suite` distinguishing `playwright` from `codeceptjs`.
- [ ] Publish branch was cut from `origin/main` and carries only migrated code, coverage YAML and the source retirement; control carries only the merge, graph refreshes and tracker commits, worktree clean.
- [ ] `e2e_tests/README.md` generated regions came from `support_scripts/generate_readme.py`.
- [ ] No debug code, no unrelated files, source safe to retire.
- [ ] The drafted PR body follows the template in `branch-workflow.md` Push and open the PR: 25 lines and 1,500 characters at most, no evidence or review history. Over the cap is a finding.

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

# Migration Review Checklist

The reviewer performs this checklist twice: before execution and after execution.

## Initial review

### Source coverage

- [ ] Every active executable scenario is migrated.
- [ ] For `already-covered`, every active executable scenario is mapped to existing Playwright coverage.
- [ ] Commented-out scenarios are excluded.
- [ ] Scenario titles and every original CodeceptJS tag are preserved; a destination execution tag may be added but does not replace a source tag. Prove title fidelity by extracting both title lists programmatically and printing them as quoted strings side by side, not by reading the two files - that form exposes a trailing-space or byte-level difference, and it must include commented-out and skipped scenarios so their handling is visible in the same output. For a data-driven scenario, check the generated suffix against CodeceptJS's own `<title> | <JSON.stringify(row)>` construction, derived from the data-table source rather than assumed.
- [ ] Data-driven rows and generated titles are preserved.
- [ ] The writer's `scenarioSelectability` report is re-derived, not trusted: every scenario either already matches an existing job's grep, or carries `destinationTagNeeded: true` with a stated plan for what tag or job the runner will add at step 5b. No scenario is left unresolved with no plan.

### Source fidelity

- [ ] Hooks and suite setup are preserved.
- [ ] Cleanup is preserved.
- [ ] Every assertion is present with equivalent strictness.
- [ ] UI, API, CLI, download, and file behavior is preserved.
- [ ] Reachable custom steps were inspected and mapped.
- [ ] No behavior was added, removed, weakened, or improved.
- [ ] Where a migrated helper branches on server configuration, the running server's environment was read (`docker exec pmm-server env`) and the evidence states which branch the green run actually took. Code alone cannot show it, so a ported fallback can look exercised when it never ran, or look dead when it is the only live path.
- [ ] Data-driven rows generate one test each, not a loop inside one test - a loop hides which row failed, stops at the first, and collapses N selectable titles into one.
- [ ] Source version conditionals are ported to `helpers/versionGates.ts` plus the `versionGate` fixture, keyed by the `PMM-T` id, never an inline `if (version...)`.
- [ ] Zip entry assertions were re-derived, not copied: `codeceptjs-e2e/tests/custom_steps.js` maps `entryName` to the basename while `e2e_tests/helpers/archive.helper.ts` returns the full path, so a copied assertion changes meaning and stays green. `logs.zip` really contains both `pmm-agent.log` and `client/pmm-agent/pmm-agent.log`.
- [ ] The assertion most at risk of being vacuous was proven able to fail by mutating its expected value and re-running. Inverting a matcher is not a mutation.

### Migration rules compliance

- [ ] Every new or edited invocation in migration-related files was checked against `mappings.md` Helpers, CodeceptSyntax, SafeOmission, and Skip policy.
- [ ] No explicit default arguments or options remain when `SKILL.md` or SafeOmission requires omission.
- [ ] No `eslint-disable` was added to work around a rule that must be fixed in code.
- [ ] Assertions remain in test bodies; helpers contain no hidden `expect()` unless `mappings.md` explicitly allows it.

#### SafeOmission registry

| Pattern | Rule |
| --- | --- |
| `parseInt(x, 10)` | Use `parseInt(x)` for decimal version segments. |
| `expect()` inside changed helpers | Only `readZipArchive`-style utilities belong in helpers; assertions stay inline in tests. |
| `pmmTest.skip` without skip-policy comments | Required by `mappings.md` section Skip policy. |
| Copied PR patterns without a rule check | Flag when old code conflicts with current `mappings.md`. |

- [ ] Ran `.claude/scripts/check-migration-conventions.sh` against the changed migration files.

### Dependencies

- [ ] Source Graphify-linked files were independently inspected.
- [ ] Target Graphify-linked files were independently inspected.
- [ ] Both graphs were refreshed and committed on control before the tracker row was marked `in-progress`.
- [ ] Missing or stale graph edges were accounted for.
- [ ] Existing Playwright abstractions were reused where applicable.
- [ ] Reuse changes follow `SKILL.md` section Minimal reuse diffs (expose in place; no duplicate public+private delegates).
- [ ] New fixtures, POMs, API clients, or endpoints are registered.

### Playwright practices

Against `playwright-practices.md`. Check the changed files, not the whole repository.

- [ ] `verifiedAgainst` in `playwright-practices.md` matches `@playwright/test` in `e2e_tests/package.json`.
- [ ] Locators follow the priority ladder; CSS is confined to MUI/Grafana internals and XPath to positional cells and the Grafana iframe.
- [ ] Each new `nth()`, `first()`, or `last()` is deliberate indexing or a positional cell, not a strict-mode workaround. Advisories on pre-existing lines are not blockers.
- [ ] Every POM entry is a `Locator` object, not a selector string.
- [ ] No manual-predicate assertion (`expect(await x.isVisible()).toBe(true)`) and no hand-rolled polling loop.
- [ ] `toHaveCount`, `toBeHidden`, `toHaveCSS`, `toContainClass` used where they apply; non-locator assertions carry a message.
- [ ] Where section PreferModernApi applies, the modern API was used rather than the literal CodeceptJS transliteration.
- [ ] No removed or deprecated API introduced (`page.accessibility`, `backgroundPages()`, `?`/`[]` route globs, `-gv`).
- [ ] The documented deviations were preserved, not "corrected": tags stay inside the title string, explicit `Timeouts.X` on assertions that need longer than the default.
- [ ] `playwright.config.ts` and the pinned Playwright version are unchanged.

### Playwright quality

- [ ] No CodeceptJS `I.*` calls remain.
- [ ] No arbitrary sleeps or unsupported shortcuts were added.
- [ ] Helper APIs have no mode flags or union returns unless source behavior truly requires it.
- [ ] Changed migration docs contain ASCII punctuation only.
- [ ] Migrated test files contain zero comments, including ESLint disable comments.
- [ ] No block-level ESLint disable comments were added anywhere in migration-related code.
- [ ] Changed-file ESLint passes.
- [ ] No new TypeScript or full-project ESLint failures were introduced.
- [ ] No newly added POM or helper method has exactly one caller; inline it at the call site instead. New surfaces only - exposing an existing method for reuse is `SKILL.md` Minimal reuse diffs and is not a finding.
- [ ] No new wrapper method around a single click; the test uses the locator directly.
- [ ] `e2e_tests/pages/base.page.ts` was checked before any method was added: `selectTimeRange`, `selectVariableValue`, `getVariableValues`, `grafanaIframe`, `duplicateCurrentPage`, and `haEnableCheck` already exist.
- [ ] No function or method is declared in a `*.test.ts`; behavior lives in a POM or helper.

### MCP locator verification

- [ ] Every new locator is verified.
- [ ] Every changed locator is verified.
- [ ] Ambiguous reused locators are verified.
- [ ] Locator match count and element identity are correct.
- [ ] Iframe boundaries are correct.
- [ ] No invalid or ambiguous locator remains.

## Initial decision

```text
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

- [ ] Required executions or already-covered regression passed against the final code.
- [ ] Runtime fixes did not weaken or change behavior.
- [ ] Locator fixes still match source intent.
- [ ] The final source and target dependency graphs were checked.
- [ ] No required source dependency was omitted.
- [ ] No target registration is missing.
- [ ] Every original CodeceptJS tag remains on the migrated Playwright scenarios.
- [ ] Existing CodeceptJS jobs and grep expressions remain unchanged, unless retirement emptied one - in which case that job was deleted in this PR (see `branch-workflow.md` section Workflow coverage), not left in place reporting green on zero tests.
- [ ] Every surface the *source* ran on was enumerated before any coverage was added, and each migrated tag's consumers were named per workflow file - `fb-e2e-suite.yml` explicitly included, never folded into the word "nightly".
- [ ] A `nightly-e2e-tests-matrix.yml` entry was added **only** where the source's own tags were already in a nightly grep. Manufactured nightly coverage - a tag appended to `test_execution_playwright` that the source never ran under - is a failure, not a safe default (see `branch-workflow.md` section Workflow coverage).
- [ ] Where a migrated scenario carried a tag selected by a CodeceptJS job in `fb-e2e-suite.yml`, a Playwright job was added to that file mirroring the retiring source's `setup_services`. A still-green `@fb-*` CodeceptJS job is not evidence: it stays green on its remaining files while this migration's scenarios go unselected.
- [ ] Otherwise, each migrated tag is appended to the existing `test_execution_playwright` matrix entry with no new job block added, unless no compatible job exists anywhere for this migration's CI surface - in which case a new job was created mirroring the retiring CodeceptJS job's setup.
- [ ] `expected_test_jobs` matches the actual number of nightly `"test execution / "` consumer jobs after this PR's edits: unchanged when a tag was merely appended, incremented when a nightly consumer was added, decremented when one was deleted (including a CodeceptJS job this migration emptied). The before/after count is stated, not inferred.
- [ ] Every migrated scenario title is selected by some Playwright job, proven with `npx playwright test --list --grep '<expression>'` and a title count - not merely believed selected because the file's union of tags looks right.
- [ ] Every tag the edited job already carried still selects exactly what it selected before the edit (the same command, run against the pre-edit grep).
- [ ] Any grep expression touched or added contains no unescaped `|` that was meant to be literal: `e2e_tests/launchable-prepare.js` and `codeceptjs-e2e/launchable-prepare.js` both compile a `|`-containing expression as a regular expression, not a string match - a string-matched intent here silently selects nothing while the job still reports green.
- [ ] The publish branch was cut from `origin/main` and carries only the migrated code, its workflow coverage, and the source retirement - no tracker, `graphify-out/`, `parallelization-ledger.md`, or `.claude/migration-observations/` paths, because none were ever committed on it.
- [ ] No migration code was committed on control; control carries only the `origin/main` merge, the two graph refreshes, and the two tracker status commits.
- [ ] Control's worktree was restored to clean after publication.
- [ ] Runtime and locator fixes still satisfy section Playwright practices.
- [ ] No debug or temporary code remains.
- [ ] No unrelated files or behavior are included.
- [ ] Static validation still introduces zero new failures.
- [ ] The selected CodeceptJS source can be safely retired.
- [ ] `expected_setup_jobs` matches the number of setup shards, and no job this PR added or renamed falls outside its required prefix: setup jobs start with `setup / `, nightly consumer jobs with `test execution / `, and the poll step is named exactly `Waiting for tests execution`. A job renamed out of its prefix is invisible to the poller - the shard finishes and a running consumer loses its client.
- [ ] A migrated no-DB (B1) row was given a job named outside the `test execution / ` prefix, so the setup shards do not wait on it.
- [ ] Any Launchable job this PR added passes a `--test-suite` name that distinguishes `playwright` from `codeceptjs`; the two use different path formats and a shared name poisons the model. `launchable subset` selects at file granularity, so a tag decision is a per-file decision.
- [ ] Regions of `e2e_tests/README.md` between `<!-- *-START -->` and `<!-- *-END -->` were produced by `support_scripts/generate_readme.py`, not hand-edited, even where the text happens to be right.

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

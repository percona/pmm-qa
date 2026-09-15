---
name: codeceptjs-migration
description: Migrate one CodeceptJS test to native Playwright, provision its PMM environment locally with provisioning/, verify and execute it, open a PR, and mark the tracker done.
---

# CodeceptJS to Playwright Migration

Migrate exactly one CodeceptJS source at a time. `done` means the PR is open against `main`; merge is not required. Publish branches are cut from `origin/main` and never merge into control, so every open migration PR is a collision target for the files all migrations touch (the nightly Playwright matrix, `e2e_tests/README.md`). `orchestration.md` step 1 caps how many may be open before a new row is selected.

## Required outcome

1. All active behaviour from the source is represented in Playwright.
2. The initial independent review passes.
3. Migration-related locators are verified through MCP.
4. The migrated test passes; the whole target file passes when an existing file was modified.
5. Every migrated scenario is selected by some Playwright job, committed on the PR branch.
6. The final independent review passes.
7. A PR targeting `main` is open and the tracker row is `done`.

## Before migrating: is it worth porting?

For every scenario, not only `xScenario`, establish and record: the ticket or behaviour it verifies still ships; the value it asserts is still the product default; the behaviour is not already covered in `e2e_tests`; every branch is reachable on the destination runner (a `JOB_NAME` check only Jenkins satisfies is dead in GitHub Actions). If any fails, propose `retired` for that scenario in the tracker with the evidence instead of porting dead coverage. A skip or a two-year-old ticket carried on the source's authority alone is not evidence.

## Port behaviour, simplify shape

The source is the authority on **what** is checked, never on **how** the code is shaped. Preserve exactly: every active scenario, every `PMM-Txxxx` id and tag, hooks and cleanup, one test per data row, assertion strictness, API/CLI/UI/download/file behaviour, and order where it affects behaviour. Do not add, remove, weaken or improve coverage. Everything else you simplify, and reviewers expect it:

- **Nothing used once.** No POM method, helper, `const`, interface, type alias, row field or file with one consumer. Inline it; `as const` types the rows. "The source declared it too" and "siblings do it" are not defences. Exposing an existing method for reuse is fine.
- **A data row carries only what varies.** One distinguishing value per row; derive the rest at the call site or move it onto the page object. Title: `PMM-Txxxx - <description> <tags> | <that one value>`. Never imitate CodeceptJS's `DataTable` JSON suffix.
- **Zero comments in `*.test.ts`**, except the skip-policy pair in `mappings.md`. Outside tests, no comment narrates a decision (why an option was rejected, which job consumes a tag); that goes in the PR body. `CLAUDE.md` house style outranks a reviewer bot asking for a comment.
- **Drop what is inert.** A wait on a locator the step already acted on, a second assertion of an established condition, a navigation nothing after it needs, an unfiltered `goto` immediately replaced by the filtered one, a parameter no call site exercises, a type or registry entry with no consumer, an unreachable branch. Record each removal; keep anything you cannot show is outcome-neutral.
- **Best locator wins.** Re-derive every locator at the highest rung of the `playwright-practices.md` ladder that resolves to the same element. A green source selector proves the element, not the form. Never splice text into selector source; `getByText` and `getByRole` take the value as data. Generated CSS classes break on the next Grafana bump. A load-guard wait is a means, not a preserved behaviour: re-anchoring it to a better element is not a fidelity change. URLs stay in the existing POM structure.
- **Assertions must be able to fail where they stand.** No absence check straight after the click that would produce the element; no locator value awaited into a variable and asserted once (web-first matcher or `expect.poll`); no `pmmTest.step` around a single `expect`; every new API method asserts status or returns the raw `APIResponse` like its siblings, never neither.
- **Cleanup on every path.** Restore shared state from the constant the test would have set, not from a variable set mid-test. A swallowed restore failure poisons the next spec in the same worker.
- **Duplication is not behaviour.** A block repeated across scenarios has two callers, so it has earned a POM or helper method; extract it there, never as a function declared in the spec file, because a test file holds tests. Assertions stay in the test body: extract the steps around them. Keep per-scenario asymmetry. Prove by counting each assertion and call category before and after. Shell command strings differing only in runs of spaces share one builder; `cli.helper.ts` hands them to `/bin/sh`, which collapses them.
- **No `private`, no one-click wrappers, no waits in the POM.** A new `private` method needs a stated reason; without one, fold it into its caller. A method that wraps a single click is replaced by the locator at the call site. Waits and one-off actions live in the test; locators live in the POM as class properties, never raw inside a method or a test.
- **Reuse with the smallest diff.** Drop `private` in place instead of renaming or wrapping; never a public method plus a forwarding delegate. Check `base.page.ts` (`selectTimeRange`, `selectVariableValue`, `getVariableValues`, `grafanaIframe`, `duplicateCurrentPage`, `haEnableCheck`) before adding anything. A new page object matches its folder siblings. Do not repeat config in tests (`ignoreHTTPSErrors` is set in `playwright.config.ts`); use path aliases, not relative imports.
- **Helpers return one shape.** No mode flags that change the return type. Assertions stay in test bodies; a CodeceptJS custom step that asserts becomes a helper returning a value plus an `expect` in the test. Never extend `assertFunctionNames` to satisfy `playwright/expect-expect`.

Run `bash .claude/scripts/check-migration-conventions.sh <every changed file>` before handing off and paste its output. It fails on every shape above that can be grepped; the reviewer re-runs it.

## Title, tags, ids

Tags live in the title and CI selects with `--grep`; `fixtures/pmmTest.ts` reads `PMM-T\d+` from the title for the version gate. Both survive verbatim. The rest is free text. The gates prove completeness (scenario count, rows per scenario, ids, tag sets, each row's distinguishing value), never string equality.

## Waits and retries

- `I.wait(N)` becomes a web-first assertion or `expect.poll`. Budget, in order: an existing poll in the file on the same operation; the source's explicit waiter for it; N as the floor. Never two polls on one command with different timeouts. Raising above the floor is not a weakening.
- Sequential waits on different locators sum; state the sum when collapsing them.
- Pin every `.retry(N)` exactly. `Feature.retry` -> file-scope `pmmTest.describe.configure({ retries: N })`; scenario-level -> the same when all agree, else one `describe` wrapper per group sharing N. The config default is `CI ? 2 : 0`, so no N survives unpinned. A wrapper prefixes the full title: re-run the selectability check (`run.md` step 8). Record N and scope in the PR body.
- Source version conditionals -> `helpers/versionGates.ts` plus the `versionGate` fixture, keyed by the `PMM-T` id, never inline.
- Where a helper branches on server configuration, read the running server's env and state which branch the green run took.

## Skips

Do not migrate commented-out scenarios. An `xScenario` follows the fixture-based skip policy in `mappings.md`; stop if no policy fits rather than inventing one.

## Workflow coverage

`branch-workflow.md` section Workflow coverage is normative. Short form: enumerate every surface the source ran on before adding any, `fb-e2e-suite.yml` included; append the migrated tag to the existing `test_execution_playwright` alternation, never a new matrix entry; add an FB job mirroring the retiring source's `setup_services` when an `@fb-*` CodeceptJS grep selected the scenario; `e2e-tests-matrix.yml` already calls `fb-e2e-suite.yml`, so never add a second job that runs the same tests in one PR run; state `expected_test_jobs` before and after; delete a CodeceptJS job the retirement emptied; never point a load-generating test at the shared nightly server. Never add `@nightly` to the Playwright alternation: that tag also marks tests owned by jobs whose services the nightly shards never provision. Retagging true nightly tests with `@nightly` plus per-database `@*-nightly` tags is a separate PR, not a migration.

## Review comments

When a human reviewer names a concrete end state, ship it in this PR; do not offer a follow-up or ask which variant. Push back only when the request breaks an invariant above, and name it. Answer every open bot thread either way. This repo squash-merges commit messages, not the PR body, into `main`: verify every attribution before it enters a commit body, and keep a hedged finding hedged.

## Graphify rule

Before marking the tracker row `in-progress`, merge `origin/main` into control and refresh `e2e_tests/graphify-out/` and `codeceptjs-e2e/graphify-out/` through the `graphify` skill's update flow, each from its own root, each its own commit on control. Never regenerate during migration. A missing LLM API key is never a reason to stop or use `--code-only`; see `graphify.md`. What is committed where is owned by `branch-workflow.md`.

## Local provisioning rule

One local Docker environment per migration through `provisioning/setup.ts`, started in the background as soon as the environment bucket is confirmed, reused through both reviews and execution, torn down through the same entry point. No Linode or `qa-integration` provisioners here. See `context.md` and `run.md`.

## Editing this skill

Execute any shell command you write into these files before committing it, through the same quoting path the skill will use, with its output shown. `grep -P` is unavailable and a carriage-return literal does not survive its own heredoc; `AGENTS.md` section Shell and tooling notes has the working forms. Rules are short imperatives; incident history goes in the tracker Notes.

## Agent responsibilities

- `pmm-migration-writer`: graph discovery, migration, per-scenario selectability check, convention script, static validation.
- `pmm-migration-reviewer`: independent completeness review, MCP locator verification, locator-only corrections, final review.
- `pmm-migration-runner`: execution, failure evidence, workflow coverage, publication, PR creation, tracker completion.

The parent spawns every review gate; a worker that spawns a subagent and waits on it deadlocks. Each agent appends its row to `.claude/migration-observations/` before returning. Phase contracts are in `run.md`; the parent's sequence is in `orchestration.md`.

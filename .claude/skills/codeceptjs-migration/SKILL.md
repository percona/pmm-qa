---
name: codeceptjs-migration
description: Migrate one CodeceptJS test to native Playwright, provision its PMM environment locally with provisioning/, verify and execute it, open a PR, and mark the tracker done.
---

# CodeceptJS to Playwright Migration

Migrate exactly one CodeceptJS source test at a time. Several such migrations may be *published together* as one batch when they share an identical environment setup - see `orchestration.md` section Batch mode - but each source test is still migrated, reviewed, and proved on its own.

## Required outcome

A migration is complete only when:

1. all active behavior from the selected CodeceptJS source is represented in Playwright;
2. the initial independent review passes;
3. migration-related locators are verified through MCP;
4. the migrated test passes;
5. the complete target file passes when an existing file was modified;
6. every migrated scenario is selected by some Playwright job, and that coverage is committed on the PR branch;
7. the final independent review passes;
8. a PR targeting `main` is opened; and
9. the tracker row is updated to `done`.

For this workflow, `done` means the PR is open for review. Merge is not required.

Because every publish branch is cut from `origin/main` and none of them merge into control, an open migration PR is a liability that every later row inherits until it merges: `main` never carries it, so nothing after it can see it, and it stays a live target for collision on any file more than one migration PR touches (the nightly Playwright matrix and `e2e_tests/README.md` are touched by every migration PR). `orchestration.md` step 1 therefore caps how many migration PRs may be open at once before a new row is selected - see that file.

## Migration invariants

Preserve exactly:

- every active executable scenario;
- scenario titles and tags;
- hooks, suite setup, and cleanup;
- data-driven rows and generated test titles;
- assertions and assertion strictness;
- API, CLI, UI, download, and file-check behavior;
- ordering when it affects behavior.

Titles are byte-identical **through the gates**, and that is what the invariant buys: a programmatic diff of the two title lists proves no scenario or data row was silently dropped or renamed. It is a migration-time check, not a permanent constraint on the file. Once both gates have passed, a reviewer may explicitly approve a clearer title. Make such a change only on an explicit reviewer request, in its own commit, and record it in the tracker Notes. Never retitle on your own judgement mid-migration: that is the silent rename the invariant exists to catch.

Two parts of a title are load-bearing at runtime and survive any retitle verbatim:

- **Every tag.** CI selects with `npx playwright test --grep`, and the tags live inside the title string.
- **The `PMM-Txxxx` token.** `e2e_tests/fixtures/pmmTest.ts` extracts it with `testInfo.title.match(/PMM-T\d+/)` and keys `minPmmVersion` off it to gate the test by server version. Drop or mangle the id and the gate silently stops firing - the test then runs on every version and fails somewhere unrelated, with nothing pointing back at the title.

Only the descriptive middle is free text. Launchable does not key on it either, since it subsets by file rather than by test name. A data-driven suffix that imitates CodeceptJS's `DataTable` output is the usual thing worth rewriting, and hand-building that JSON is its own hazard: nothing escapes it, so a row whose value contains a quote or backslash diverges silently.

Do not add, remove, weaken, or improve coverage during migration.
Preserve behavior, not redundant syntax. Omit arguments/options only when they restate a default and removal is behaviorally identical for the migrated values.
When unsure, keep the source syntax.

**Drop what is inert in Playwright.** The test: if removing it cannot change the outcome for any migrated value, remove it. This is not a coverage change - inert code asserts nothing, so removing it removes nothing - and it is the one place where fidelity to the source is the wrong answer. Shapes seen so far:

- a wait on a locator the same step has already acted on (`waitFor({ state: 'attached' })` after `clear()`/`fill()`);
- a second assertion of a condition the first already established;
- a parameter no migrated call site exercises;
- a type or registry entry with no consumer;
- a branch unreachable on the target's library version.

Record each removal and why it is inert. If you cannot show that removal is outcome-neutral, keep it.

## Minimal reuse diffs

When the source needs behavior that **already exists** in Playwright code (POM, helper, API client, component, fixture), reuse it with the **smallest** change:

1. Prefer renaming or making the existing implementation public in place; match the source name when practical.
2. Update existing internal callers in the same file to use that one implementation.
3. Do **not** add a second public surface plus a private delegate/wrapper that only forwards to it.
4. Do **not** duplicate the same logic in the test, a new helper, or a new abstraction when an existing one can be exposed.

```ts
// BAD - duplicate surface
doThing = async () => { ... };
private legacyDoThing = async () => this.doThing();

// GOOD - one method, internal + migrated test callers share it
doThing = async () => { ... };
```

Inline in the test only when no suitable existing abstraction exists. Creating a new file is the last resort, not the default.

When you add a method to an existing API client, POM, or helper, match what its siblings already do - status handling, locator strategy, return shape - and name the sibling you matched. In `e2e_tests/api/`, 14 of 25 request-issuing methods assert the status with `expect`, and most of the rest deliberately return the raw `APIResponse` so the caller asserts (`alerting.api.ts`, `annotation.api.ts`). Either is correct; doing neither is not.

## Native Playwright rules

`playwright-practices.md` is authoritative for how migrated code is written: locator ladder,
web-first assertions, the modern API to prefer over a CodeceptJS transliteration, removed APIs,
structure, and the repository's deliberate deviations from upstream. Read it before migrating.
Its `verifiedAgainst` version must match `e2e_tests/package.json`; `orchestration.md` step 1 checks this.

The rules below are migration-specific and are not repeated there:

- Reuse existing POMs, helpers, components, API clients, fixtures, and test data.
- When reusing existing code, follow section Minimal reuse diffs (expose in place; no duplicate delegates).
- Port behavior, not CodeceptJS helper APIs.
- Helpers should have one stable return type.
- Do not use boolean mode flags that change helper return shape.
- Keep migration docs ASCII-only.
- Add target registrations only when required.
- Keep URLs in the repository's existing POM structure.
- Do not retain CodeceptJS `I.*` calls or recreate an actor abstraction.
- Do not hide assertions inside POMs or helpers; a CodeceptJS custom step that asserts becomes a
  helper that returns a value plus an assertion in the test body.
- Do not suppress `playwright/expect-expect` to compensate for hidden assertions.
- Do not add comments of any kind in migrated test files (`*.test.ts`), except the required skip-policy comments in `mappings.md`.
- Outside migrated tests - POMs, helpers, API clients, and workflow YAML - do not narrate a decision. Reasoning about why an option was rejected, which consumer depends on a tag, or what would happen if something were removed belongs in the PR body and the tracker Notes, where it is searchable and does not age in place beside the code. A one-line statement of a fact a reader cannot infer from the code stays.
- If a lint rule fails in a test, refactor the test or move the behavior into an existing/new helper, POM, component, or API client where appropriate.
- `.retry(N)` is not ported as CodeceptJS syntax, but **every explicit source retry value must be pinned exactly**, at the same scope the source applied it. There is no value of N for which doing nothing preserves behavior: `playwright.config.ts` sets `retries: process.env.CI ? 2 : 0`, so an unpinned scenario gets 2 retries in CI and 0 locally regardless of what the source asked for. `.retry(1)` is not the CI default, `.retry(0)` would silently gain 2, and any N > 2 would silently lose retries. A source with no `.retry()` anywhere inherits the config default, which is correct - that is what it inherited before.
  Scope matters, because Playwright has no per-test `retries` option and `pmmTest.describe.configure({ retries: N })` applies to everything in its enclosing scope:
  - **Feature-level** (`Feature('...').retry(N)`): one `pmmTest.describe.configure({ retries: N })` at file scope. This is the direct equivalent - the source applied it to the whole file too.
  - **Scenario-level** (`}).retry(N)` on an individual `Scenario`/`Data` block) where every retrying scenario in the file shares the same N and no scenario is meant to differ: file-scope `configure` is still equivalent, and is preferred over wrapping.
  - **Scenario-level with differing N across scenarios in one file**: wrap each affected scenario, or each group sharing one N, in its own `pmmTest.describe` with `configure({ retries: N })`. Never let a wrapper added for one scenario's retry count change a sibling's - that is the failure mode a file-scope `configure` causes here.
  A describe wrapper prefixes the test's full title. Keep the scenario title string byte-identical inside it, and re-run the per-scenario selectability check afterwards (`run.md` step 8): the destination grep matches against the full title, so a wrapper must be proven not to have broken selection.
  Record the source N and the scope you applied it at in the tracker Notes. This is the "preserve exactly" invariant applied to retries, not a judgement call.
- Do not migrate commented-out scenarios.
- Migrate an explicitly skipped active scenario only according to the repository's established Playwright skip policy. Stop when no policy exists rather than inventing one.
- Before migrating an `xScenario`, establish that it is still worth migrating, and record the answers: is its blocking ticket still open; is the behavior already covered elsewhere in either suite; does its assertion still match current product behavior. If any of the three fails, propose dropping it with that evidence instead of porting dead coverage - `tracker.md` already has a `retired` status for obsolete coverage, and this is its per-scenario counterpart. A skip carried forward on the source's authority alone can outlive its reason by years.

## Graphify rule

Before marking the tracker row `in-progress`, merge `origin/main` into control and refresh both `e2e_tests/graphify-out/` and `codeceptjs-e2e/graphify-out/` through the `graphify` skill's update flow, each from its own root, each its own commit on control. Never regenerate either graph during migration. A missing LLM API key is never a reason to stop or to fall back to `--code-only`; see `graphify.md`. What is committed where after this point is owned by `branch-workflow.md` section What is committed where.

## Local provisioning rule

Create one local Docker environment per migration through `provisioning/setup.ts`, reuse it through both reviews and execution, then tear it down through the same entry point. It starts in the background as soon as the environment bucket is confirmed, so it provisions while the writer migrates. Do not use the Linode or `qa-integration` provisioners for this workflow. See `context.md` and `run.md`.

## Searching this repository

Use the Grep tool with an explicit path scope and `output_mode`. A repo-wide `grep -rn` from the repository root exceeds the 120s Bash timeout here, and the retry has to be scoped anyway.

## Editing this skill

A shell command written into these files as a check must be executed before it is committed, through the same quoting path the skill will use, with its output shown. `orchestration.md` requires `bash -n` on `.claude/scripts/*.sh`, but that only parses a script file and never reaches a command embedded in markdown.

Prefer forms with no shell-escaping hazard. A carriage-return literal added here as a line-ending guard did not survive its own heredoc and reached both `branch-workflow.md` and `run.md` as an empty `grep` pattern, which matches every line - it then reported a 164-line CRLF flip on a file that was pure LF. A byte count says the same thing and cannot misfire:

```bash
python -c "print(open('<path>','rb').read().count(bytes([13])))"
```

`grep -P` is unavailable here and fails on every invocation; see the ASCII item in `audit-checklist.md` for the working form.

## Agent responsibilities

- `pmm-migration-writer`: graph discovery, migration, per-scenario selectability check, and static validation.
- `pmm-migration-reviewer`: independent completeness review, MCP locator verification, locator-only corrections, and final review.
- `pmm-migration-runner`: execution, failure evidence, workflow coverage, publication, PR creation, and tracker completion.

The parent spawns every review gate. No worker subagent spawns another subagent - one that does, and then waits on the reply, deadlocks.

Each of the three appends its own row to this migration's timeline in
`.claude/migration-observations/` before returning. `skill-gardener` reads those rows to audit the
workflow and to fill in `parallelization-ledger.md`.

Phase contracts are defined in `run.md`; the parent's steps and the canonical sequence are in `orchestration.md`.

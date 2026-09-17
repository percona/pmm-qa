---
name: codeceptjs-migration
description: Migrate one CodeceptJS test to native Playwright, provision its PMM environment locally with provisioning/, verify and execute it, open a PR, and mark the tracker done.
---

# CodeceptJS to Playwright Migration

Migrate exactly one CodeceptJS source at a time. `done` means the PR is open against `main`; merge is not required. Every open migration PR collides on the files all migrations touch (the nightly Playwright matrix, `e2e_tests/README.md`), so `orchestration.md` step 1 allows none open before a new row starts.

| Topic | File |
| --- | --- |
| Worker phase contracts | `run.md` |
| Parent orchestration and canonical sequence | `orchestration.md` |
| CodeceptJS call and custom-step mapping, skip policy | `mappings.md` |
| Playwright idiom and locator ladder | `playwright-practices.md` |
| Review checklist and done gate | `audit-checklist.md` |
| Broken locator recovery | `locator-fix.md` |
| Branch, coverage, PR and tracker publishing | `branch-workflow.md` |
| Work queue | `tracker.md` |

## Required outcome

1. All active behaviour from the source is represented in Playwright.
2. The initial independent review passes.
3. Migration-related locators are verified through MCP.
4. The migrated test passes; the whole target file passes when an existing file was modified.
5. Every migrated scenario is selected by some Playwright job, committed on the PR branch.
6. The final independent review passes.
7. A PR targeting `main` is open and the tracker row is `done`.

## Repository map

| Source | Target |
| --- | --- |
| `codeceptjs-e2e/tests/<category>/*_test.js` | best-fit existing `e2e_tests/tests/**/*.test.ts`, else a new file |
| `codeceptjs-e2e/tests/**/pages/*.js` | `e2e_tests/pages/**/*.page.ts` |
| `codeceptjs-e2e/tests/**/pages/api/*.js` | `e2e_tests/api/*.api.ts` |
| `codeceptjs-e2e/tests/custom_steps.js` | existing helpers and components per `mappings.md` |
| `codeceptjs-e2e/testdata/` | `e2e_tests/testdata/` |

Match a target by behaviour, fixtures, hooks and environment, not filename. Injected CodeceptJS names resolve through the `include` map in `codeceptjs-e2e/codeceptConfigHelper.js`. Discover the target live, never from a static inventory:

```bash
rg --files e2e_tests/pages e2e_tests/api e2e_tests/helpers e2e_tests/components
rg -n "base.extend|readonly .*Api|new .*Page|new .*Api" e2e_tests/fixtures/pmmTest.ts e2e_tests/api/api.ts
```

Registration points: POM fixtures `e2e_tests/fixtures/pmmTest.ts`; API clients `e2e_tests/api/api.ts`; API paths `e2e_tests/helpers/apiEndpoints.ts`; timeouts `e2e_tests/helpers/timeouts.ts`; POM base `e2e_tests/pages/base.page.ts`. POM locators are grouped in `buttons`, `elements`, `inputs`, `messages` or `builders`, methods are arrow functions, and `url` holds the page URL. Tests authorize through `grafanaHelper.authorize()` in `pmmTest.beforeEach`; `pmmTest` already mocks tour completion and server updates.

Environment setup comes from the source (hooks, data rows, custom steps, helpers, API calls), with the tracker's `Setup` as the planned default and tags as hints. Rows needing AWS RDS, Aurora, Azure, AMI, OVF or pmm-demo stay blocked until that infrastructure exists.

## Before migrating: is it worth porting?

For every scenario, not only `xScenario`, establish and record: the ticket or behaviour it verifies still ships; the value it asserts is still the product default; the behaviour is not already covered in `e2e_tests`; every branch is reachable on the destination runner (a `JOB_NAME` check only Jenkins satisfies is dead in GitHub Actions). If any fails, propose `retired` for that scenario in the tracker with the evidence. A skip or an old ticket carried on the source's authority alone is not evidence. Disproving a skip's stated reason is not evidence for the row it guards: validate that row's values against the live server before restoring it.

## Port behaviour, simplify shape

The source is the authority on what is checked, never on how the code is shaped. Preserve exactly: every active scenario, every `PMM-Txxxx` id and tag, hooks and cleanup, one test per data row, assertion strictness, API/CLI/UI/download/file behaviour, and order and state the source carries between scenarios (a module-level variable, an agent an earlier scenario registered), pinned with `pmmTest.describe.configure({ mode: 'default' })` and named in the handoff. Do not add, remove, weaken or improve coverage. Simplify everything else:

- **Nothing used once.** No POM method, helper, `const`, interface, type alias, row field or file with one consumer; inline it, `as const` types the rows. "The source declared it" and "siblings do it" are not reasons. Exposing an existing method for reuse is fine.
- **A dashboard gets its own page object.** One `DashboardInterface` class per dashboard: a flat file under `pages/dashboards/` registered directly on `Dashboards` when it stands alone (`home.ts`), or inside a family folder with that folder's index when several share one (`pages/dashboards/valkey/`). Fields: `url`, `metrics: GrafanaPanel[]` as an inline literal with each panel's Grafana type (`stat`, `table`, ...) or `'unknown'`, and `noDataMetrics`. Panel names live there. The test iterates `dashboard.<x>.metrics` through the fixture, never `new <X>Dashboard()` inside a test body. A `Data` port needs its rows at module scope, where no fixture is available, but an import works there: shipped inventory (folder and dashboard names) joins `testdata/dashboards.registry.ts`, the file that already holds it, and only rows that are the spec's own parameters stay a `const` in the test (`homeDashboards.test.ts`, `verifyAnnotations.test.ts`). `pages/dashboards/` holds `DashboardInterface` classes and family indexes only; a bare data module there matches nothing. It reuses `verifyMetricsPresent`, `verifyPanelValues`, `verifyAllPanelsHaveData` where they fit. No field outside the interface; an id a locator needs goes on `GrafanaPanel` or a builder.
- **Repeated checks on one loaded page stay in one test.** A `Data` table splits into one `pmmTest` per row only when rows need different navigation or state; rows that inspect parts of the same loaded page become one test with a `for` over the rows, collapsing each row before the next. `homeDashboards.test.ts` splits because each row opens a different dashboard.
- **A data row carries only what varies.** One distinguishing value per row; derive the rest at the call site or move it onto the page object. Title: `PMM-Txxxx - <description> <tags> | <that one value>`, never a JSON suffix.
- **Zero comments in `*.test.ts`**, except the skip-policy pair in `mappings.md`. Outside tests, no comment narrates a decision; that goes in the commit message. `CLAUDE.md` house style outranks a reviewer bot asking for a comment.
- **Drop what is inert.** A wait on a locator the step already acted on (not one whose budget exceeds the assertion that follows it: that stays as its own assertion), a second assertion of an established condition, a navigation nothing after it needs, a `goto` immediately replaced by a filtered one, a parameter no call site exercises, a type or registry entry with no consumer, an unreachable branch. Record each removal; keep anything you cannot show is outcome-neutral.
- **Best locator wins.** Re-derive every locator at the highest rung of the `playwright-practices.md` ladder that resolves to the same element; a green source selector proves the element, not the form. The writer picks the rung provisionally and lists every form it could not verify under `uncertainties`; the reviewer confirms through MCP. Never splice text into selector source; `getByText` and `getByRole` take the value as data. No generated CSS classes. A load-guard wait may be re-anchored to a better element. URLs stay in the POM.
- **Assertions must be able to fail where they stand.** No absence check straight after the click that would produce the element; no locator value awaited into a variable and asserted once (web-first matcher or `expect.poll`); no `pmmTest.step` around a single `expect`; every new API method asserts the status and returns the parsed body typed from `@interfaces/`, the form every existing client uses.
- **Cleanup on every path.** Restore shared state from the constant the test would have set, not from a mid-test variable. A swallowed restore failure poisons the next spec in the worker.
- **Duplication is not behaviour.** A block repeated across scenarios has two callers and earns a POM or helper method, never a function in the spec file. When the block contains assertions, extract the commands and locators around them and leave each assertion inline in every scenario. Keep per-scenario asymmetry. Prove it by counting each assertion and call category before and after. Shell strings differing only in runs of spaces share one builder; `cli.helper.ts` hands them to `/bin/sh`, which collapses them.
- **No `private`, no one-click wrappers, no waits in the POM.** A new `private` method needs a stated reason. A method wrapping a single click is replaced by the locator at the call site. One-off actions live in the test. A POM method waits only for what its own action needs (`waitForEvent('download')`, `loadAllPanels()`); a `waitFor` standing in for an assertion belongs in the test. Locators live in the POM as class properties, never raw in a method or a test. A refinement chained off a builder in a test (`builders.x(name).getByTestId(...)`) is a raw locator: make it its own builder.
- **Reuse with the smallest diff.** Drop `private` in place instead of renaming or wrapping; never a public method plus a forwarding delegate. Check `base.page.ts` and the target's folder siblings before adding anything. Do not repeat config in tests (`ignoreHTTPSErrors` is in `playwright.config.ts`); path aliases, not relative imports.
- **Helpers return one shape.** No mode flags that change the return type. A CodeceptJS custom step that asserts becomes a helper returning a value plus an `expect` in the test. Existing POM `verify*` methods that assert are reused as they are, never extended or imitated in new methods. Never extend `assertFunctionNames` to satisfy `playwright/expect-expect`.

Run `bash .claude/scripts/check-migration-conventions.sh <every changed file>` before handing off and paste its output; it fails on every shape above that can be grepped, and the reviewer re-runs it.

## Title, tags, ids

Tags live in the title and CI selects with `--grep`; `fixtures/pmmTest.ts` reads `PMM-T\d+` from the title for the version gate. Copy the title string as is, interior spacing included; trim leading and trailing whitespace, which `playwright/valid-title` rejects. Gates prove completeness (scenario count, rows per scenario, ids, tag sets, each row's distinguishing value), never string equality.

## Waits and retries

- `I.wait(N)` becomes a web-first assertion, `expect.poll` for one computed value, or `expect(async () => { ... }).toPass({ intervals: [Timeouts.X], timeout: Timeouts.Y })` for a block of assertions that must hold together, the form most existing files use. Budget, in order: an existing poll in the file on the same operation; the source's explicit waiter for it; N as the floor. Never two polls on one command with different timeouts. Raising above the floor is not a weakening.
- Sequential waits on one locator stay separate assertions with their own `Timeouts` values (`toBeVisible` at the source's visibility budget, then the text assertion at its own). Sum only when collapsing waits on different locators onto one assertion, and state the sum; never drop a wait because the sum is not in the enum.
- Drop every `.retry(N)`. `playwright.config.ts` owns retries (`CI ? 2 : 0`); a CodeceptJS N was written for a different runner, so pinning it makes CI less tolerant and local runs more tolerant than that policy. Record the dropped N in the commit message.
- Source version conditionals become `helpers/versionGates.ts` plus the `versionGate` fixture, keyed by the `PMM-T` id, never inline. A guard written for an earlier major line (`minor > 40` meaning 2.41+) is true on every 3.x server: port its body unconditionally, and record the collapsed guard.
- Where a helper branches on server configuration, read the running server's env and state which branch the green run took.

## Skips

Do not migrate commented-out scenarios. An `xScenario` goes through the worth-porting gate first; one that fails it is proposed `retired` on static evidence (the source TODO, the product default, sibling sources), for the reviewer to confirm live. One that passes follows the skip policy in `mappings.md`; stop if no policy fits rather than inventing one.

## Workflow coverage

`branch-workflow.md` section Workflow coverage is normative and is applied in full by the runner: enumerate every surface the source runs on, choose the shape, keep `expected_test_jobs` true, verify selectability both ways.

## Review comments

When a human reviewer names a concrete end state, ship it in this PR; do not offer a follow-up or ask which variant. Push back only when the request breaks an invariant above, and name it. Answer every open bot thread. A bot predicting a locator or strict-mode failure is answered with a count over the fully rendered DOM through MCP (`locator-fix.md` Lazy rendering); a green strict-mode run on a default load proves nothing on a lazy-rendering page. Before repeating a refutation to a human, re-measure the mechanism you named, not the count. A decision defended in a thread is reopened only by a human reviewer: a suggestion you declined stays declined. Reply to a human after the push lands and name the commit. Verify every attribution before it enters a commit body, and keep a hedged finding hedged.

## Local provisioning rule

One local Docker environment per migration through `provisioning/setup.ts` (`orchestration.md` steps 2a and 3), started in the background once the bucket is confirmed, reused through both reviews and execution, torn down through the same entry point. No Linode or `qa-integration` provisioners.

## Editing this skill

Execute any shell command you write into these files before committing it, through the same quoting path the skill will use, with its output shown. `grep -P` is unavailable and a carriage-return literal does not survive its own heredoc; `AGENTS.md` section Shell and tooling notes has the working forms. Rules are short imperatives; incident history goes in the tracker Notes.

## Agent responsibilities

- `pmm-migration-writer`: linked-file discovery, migration, per-scenario selectability check, convention script, static validation.
- `pmm-migration-reviewer`: independent completeness review, MCP locator verification, locator-only corrections, final review.
- `pmm-migration-runner`: execution, failure evidence, workflow coverage, publication, PR creation, tracker completion.

The parent spawns every review gate. Each agent appends its row to `.claude/migration-observations/` before returning.

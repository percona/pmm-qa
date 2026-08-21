# Migration Phase Contracts

What each worker phase does and what gate it returns. The parent's half of the workflow - row selection, preflight, provisioning, gate ownership, the phase timeline, and the canonical sequence - lives in `orchestration.md`; worker subagents do not need it and should not read it.

All working-phase steps happen directly on the control branch's own worktree. No separate migration branch exists until publish (step 7), which uses an isolated `git worktree` and never switches control's own checkout.

Environment contract for every phase that touches a running PMM: reuse the prepared local environment, never recreate or clean it, and pass the same `PMM_UI_URL` and `ADMIN_PASSWORD` the parent hands over (default `https://127.0.0.1/` and `admin`) to every command. Never edit `e2e_tests/.env`.

Search contract for every phase: use the Grep tool with an explicit path scope and `output_mode`. A repo-wide `grep -rn` from the repository root exceeds the 120s Bash timeout in this repository and has to be re-run scoped anyway.

Steps 1, 2a, and 3 are the parent's; they are in `orchestration.md`.

## 2. Discover and migrate

The writer:

1. reads the source test;
2. queries the existing source graph with `graphify query`/`graphify path`/`graphify explain`, or a targeted filter as described in `.claude/skills/graphify/references/query.md` (no graph generation and never loading the full `graph.json`); CodeceptJS fixture injection (`async ({ I, somePage }) => ...`) is not a static import, so graphify's AST pass will not have an edge for it - always also check the scenario's injected parameter names directly against `codeceptjs-e2e/tests/**/pages/*.js` regardless of what the graph shows;
3. opens and verifies the actual linked source files;
4. queries the refreshed `e2e_tests/graphify-out/graph.json` to find reusable Playwright files (no graph generation);
5. opens and verifies the actual target candidates;
6. derives environment setup from source behavior;
7. migrates the test to native Playwright;
8. checks destination selectability **per scenario**; and
9. runs static validation.

On step 8: a source file's scenarios do not all carry the same tags, so the file's union of tags is not what CI selects on. Check every migrated scenario title against the grep of the workflow job that will run it, with `npx playwright test --list --grep '<expression>'`, and confirm the count and the titles. A scenario that matches no destination grep is coverage that disappears the moment the CodeceptJS source is retired - and it is invisible in a green test run. Report any scenario that needs a destination execution tag added; adding one is permitted, removing or replacing a source tag is not.

Writer output: `MIGRATION_READY`, `BLOCKED`, or `STATIC_FAILED`.

## 4. Initial review and MCP verification

The reviewer independently:

1. queries the existing source and refreshed target graphs to derive dependency lists (no graph generation);
2. compares all source behavior with the migrated implementation;
3. confirms nothing is missing or weakened;
4. confirms the writer's per-scenario selectability check, re-deriving it rather than trusting it;
5. verifies every new or changed locator through MCP against the prepared PMM environment;
6. fixes locator definitions only when live DOM evidence proves the correction; and
7. reruns static validation after locator changes.

Reviewer output: `READY_TO_RUN`, `REVIEW_FAILED`, or `LOCATOR_FIX_REQUIRED`.

Non-locator findings return to the writer. Any changed code must be reviewed again.

If HEAD moves while a review is in flight, say so in the handoff. A commit landing under a reviewer is otherwise invisible, and it silently invalidates whatever the review already checked.

## 5. Execute

The runner executes the migrated scenarios or existing coverage against the prepared local environment, reusing the same `PMM_UI_URL`/`ADMIN_PASSWORD` for every proof and regression command.

- For a new target file containing only migrated scenarios, run the complete file once.
- For an appended existing target file, first run only the migrated scenarios, then run the complete target file.
- For `targetMode: already-covered`, skip the new-scenario proof run and run the existing target file or matched existing test titles as regression evidence.

Run the file in declaration order unless the source proves the scenarios are independent; a migrated scenario may depend on state an earlier one created, faithfully to the source.

A test that selects state by index is not rerunnable on a reused environment without resetting that state first. Establish the precondition before the run and state it in the evidence. If the reset is refused by the permission classifier, stop and ask the parent - do not achieve the same effect by another route.

Failure routing:

- locator failure -> reviewer;
- migration logic failure -> writer;
- environment or product failure -> keep `in-progress` and record the reason;
- stale environment state -> reset the state and rerun; this is not a code failure and does not re-enter review.

Any code change requires the relevant review again before rerunning. Do not clean or recreate the environment after a failure.

## 5b. Workflow coverage

After execution passes and **before** the final review, the runner commits workflow coverage directly on control, per `branch-workflow.md`. This ordering is deliberate: the final review has to verify committed YAML, and a coverage plan described only in prose cannot be verified at all.

Preserve every original CodeceptJS scenario tag. Leave existing CodeceptJS jobs and grep expressions unchanged. Append the migrated tags to an existing Playwright job when its `setup_services` is genuinely sufficient, or create a Playwright job with the required setup when no compatible job exists.

Verify each grep expression selects what you intend with `npx playwright test --list --grep`, in both directions: the migrated scenarios are now selected, and every tag the job already carried still selects what it selected before.

## 6. Final review

After the required tests pass and coverage is committed, the reviewer performs a final complete review of the final code, the committed workflow coverage, and the execution evidence.

The parent spawns this gate. The runner does not.

Reviewer output: `FINAL_REVIEW_PASS` or `FINAL_REVIEW_FAILED`.

## 7. Publish

Only after `FINAL_REVIEW_PASS`, the runner:

1. retires the selected CodeceptJS source according to repository discovery rules, committed directly on control - retire only the selected file, and keep any page object, API client, or helper the source shared with a CodeceptJS test that still exists;
2. adds an isolated `git worktree` for the publish branch, built from `origin/main`;
3. in that worktree, checks every file touched in `migration-start..<control-branch>` against `origin/main` for cross-migration dependencies, then cherry-picks `migration-start..<control-branch>` onto the publish branch;
4. purifies (confirms no `tracker.md`, `parallelization-ledger.md`, `graphify-out/`, or `.claude/migration-observations/` paths landed) and revalidates (lint/typecheck/build/test) the freshly cherry-picked worktree, every time, not only when a conflict occurred;
5. pushes the publish branch, opens a PR targeting `main`, and attaches the E2E tests Matrix Actions run URL per `branch-workflow.md`; and
6. returns to control's own checkout (never switched away - only the isolated publish worktree used a different branch), updates the tracker row to `done` with the PR link and pre-migration graph-refresh result, then commits and pushes only the tracker change.

Do not merge the publish branch into control. A later merge of `main` into control receives the migration after its PR merges.

For this workflow, `done` means the PR was opened successfully.

## 8. Cleanup

Run `node provisioning/setup.ts --teardown` on every terminal path after provisioning begins: success, provisioning failure, test failure, review failure, publication failure, or blocker. This removes the migration's provisioned containers, volumes, and network. Also remove the publish worktree (`git worktree remove ../pmm-qa-publish`) once the PR is opened.

Teardown is classifier-blocked inside a subagent. When it is refused, report it in the handoff and leave the environment running for the parent rather than working around the refusal.

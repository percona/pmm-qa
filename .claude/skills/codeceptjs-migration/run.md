# Migration Phase Contracts

What each worker phase does and what gate it returns. The parent's half of the workflow - row selection, preflight, provisioning, gate ownership, the phase timeline, and the canonical sequence - lives in `orchestration.md`; worker subagents do not need it and should not read it.

Working phases edit the control branch's own worktree and **commit nothing there**. Everything the migration produces stays uncommitted until publish (step 7), which moves it to a branch cut from `origin/main` in an isolated `git worktree` and commits it there. Control's own checkout is never switched away from. If you find yourself about to `git commit` migration code on control, stop - that is the one thing this workflow does not do.

Environment contract for every phase that touches a running PMM: reuse the prepared local environment, never recreate or clean it, and pass the same `PMM_UI_URL` and `ADMIN_PASSWORD` the parent hands over (default `https://127.0.0.1/` and `admin`) to every command. Never edit `e2e_tests/.env`.

Search contract for every phase: use the Grep tool with an explicit path scope and `output_mode`. A repo-wide `grep -rn` from the repository root exceeds the 120s Bash timeout in this repository and has to be re-run scoped anyway.

Steps 1, 2a, and 3 are the parent's; they are in `orchestration.md`. Only the parent commits on control, and only the tracker and the graphs.

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

On step 8: a source file's scenarios do not all carry the same tags, so the file's union of tags is not what CI selects on. The workflow-coverage YAML itself is not edited until step 5b (the runner's), so at this point you can only check against jobs as they exist **today** - list the migrated scenario titles, diff them against the grep expressions the destination jobs already carry, with `npx playwright test --list --grep '<expression>'` per existing job, and report each scenario that matches no existing job's grep as `destinationTagNeeded: true`.

A single `--list --grep` over the `|`-union of every active job expression may replace the per-job loop **only** to establish the negative: zero matches from the migrated file means every scenario in it needs a tag, and one command proves it. The moment the union matches anything, the union cannot say *which* job is the home, and `destinationTagNeeded` is a per-scenario-per-job verdict - so fall back to the per-job loop for the matching scenarios. State which form was used and its result count.

The two job kinds carry their grep expression under **different** input keys, and both kinds appear in the same workflow files: CodeceptJS jobs use `tags_for_tests`, Playwright jobs use `pmm_test_flag`. A scan that greps only one key finds zero jobs of the other kind and returns a clean empty result - indistinguishable from "no job greps this tag". So report the count of each kind found (e.g. "7 `tags_for_tests` jobs, 5 `pmm_test_flag` jobs, active only") before reporting any per-scenario verdict; a count of 0 for either key means the parse is wrong, not that the coverage is absent. Do not edit workflow YAML. A scenario left at `destinationTagNeeded: true` is not a defect in itself, but `MIGRATION_READY` is invalid while any scenario's tag need is unresolved: either the scenario already has a home in an existing job's grep, or the report says explicitly which new tag or job the runner must add at step 5b. Do not return `MIGRATION_READY` with an unresolved `destinationTagNeeded: true` scenario and no stated plan for it - that gap is what cost row 3 two extra final-review passes.

On step 9: if any migrated tag does not already appear anywhere under `e2e_tests`, regenerate `e2e_tests/README.md` and re-run the generator's `--check` before returning `MIGRATION_READY`. A new tag makes that check stale repo-wide, so it fails every later gate rather than only the publish step.

Leave the changes uncommitted and report the changed paths. Do not commit on control.

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

Review the working tree, not a commit range. Any locator fix you make also stays uncommitted.

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

The hazard is state a test *reads* without establishing, not state a test *leaves*. Check where the reset runs before escalating one: a file whose `beforeEach` restores its own precondition is self-preconditioning and needs no external reset, however dirty its last scenario leaves the environment.

Failure routing:

- locator failure -> reviewer;
- migration logic failure -> writer;
- environment or product failure -> keep `in-progress` and record the reason;
- stale environment state -> reset the state and rerun; this is not a code failure and does not re-enter review.

Any code change requires the relevant review again before rerunning. Do not clean or recreate the environment after a failure.

## 5b. Cut the publish branch, move the work, add coverage

After execution passes and **before** the final review, the runner cuts a worktree and branch from `origin/main`, moves control's uncommitted changes into it, commits them there, then performs the source retirement and the workflow-coverage edits in that same worktree. Full commands in `branch-workflow.md`.

This ordering is deliberate: the final review has to verify committed content, and a coverage plan described only in prose cannot be verified at all.

Coverage rules, the per-scenario check across every consumer job (not only the one edited), and the two CI traps (the `|` regex trap and the `expected_test_jobs` counter) are all in `branch-workflow.md` section Workflow coverage - apply it in full; it is not restated here.

After the coverage edit, run the reverse direction too: re-list the highest-traffic existing expressions and confirm their selections are unchanged. Do this **even when the edit only added a job** and "no existing expression changed" is true by construction - it costs one batched `--list` command and is the only thing separating a verified claim from a believed one.

## 6. Final review

After the required tests pass and the publish branch carries the code, the retirement, and the workflow coverage, the reviewer performs a final complete review of that branch plus the execution evidence.

The parent spawns this gate. The runner does not.

Reviewer output: `FINAL_REVIEW_PASS` or `FINAL_REVIEW_FAILED`.

## Gate ledger

Applies to both gates (step 4 and step 6). The parent creates `.claude/migration-observations/<row>-<slug>.gates.yaml` and passes its path on every gate spawn; the reviewer reads it and appends to it itself, so a missing or incomplete prose handoff can never silently cause a full re-derivation.

Read it first, before any other work in the gate. Append one entry before returning:

```yaml
- gate: initial | final
  attempt: 1
  rowsCovered: []   # usually one row; several only for a batch (see the parent's batch mode)
  subject:
    kind: worktree | branch   # initial gate is always worktree; final gate is branch, except worktree in test-run mode
    startRef:       # kind: branch only: the branch HEAD sha, measured before any review work. Omit for a worktree subject.
    endRef:         # kind: branch only: the branch HEAD sha again, measured immediately before returning; must equal startRef for a passing verdict. Omit for a worktree subject.
  verdict: READY_TO_RUN | REVIEW_FAILED | LOCATOR_FIX_REQUIRED | STALE_SUBJECT | FINAL_REVIEW_PASS | FINAL_REVIEW_FAILED
  blockers:
    - id: B1
      claim:
      evidence:
      status: open | fixed-by:<commit-or-note> | withdrawn
  advisories: []
```

Scoping rule. If no entry exists for this gate, this is attempt 1 and the full checklist in `audit-checklist.md` applies. If the last entry for this gate is not a pass and carries any blocker with `status: open`, scope this pass to those blocker ids plus whatever changed on the subject since that entry's `endRef`, and do not re-derive the full checklist. This applies to advisories too: an advisory recorded `withdrawn` needs no re-derivation at a later gate unless the code it was about changed. Only `open` items and the delta are ever in scope, whatever a prose handoff asks for. If you cannot determine what changed since that entry - the handoff is silent and the recorded `endRef` does not correspond to anything you can diff - stop and report that gap rather than repeating a pass that cannot move; a missing delta is not license to re-derive everything anyway.

Subject stability, final gate only. The final gate's subject is the publish branch, so measure its HEAD sha before doing any review work and again immediately before returning. If they differ, the subject changed underneath you: record both values, return `STALE_SUBJECT`, and do not return a passing verdict on a branch that no longer exists as reviewed. The parent then re-spawns the gate scoped to the delta.

There is deliberately no equivalent at the initial gate. Its subject is control's uncommitted worktree, which has no ref to compare, and the obvious stand-in - the phase `.patch` file's hash - does not work: the parent writes that file between phases and nothing regenerates it during a gate, so the two measurements would be equal by construction no matter what happened to the tree. The initial gate therefore omits `startRef`/`endRef` and never returns `STALE_SUBJECT`. The same applies to a **final** gate whose subject is a worktree rather than a branch, which is what test-run mode produces by skipping step 5b: the subject kind decides the rule, not which gate it is. The invariant that protects it is the parent's, not the reviewer's: nothing may write to a subject while its gate is live (`orchestration.md`).

## 7. Publish

Only after `FINAL_REVIEW_PASS`, the runner:

1. revalidates the publish worktree (lint/typecheck/build/test), every time - the four migration-specific scripts under `.claude/scripts/` are control-only and absent from a tree cut from `origin/main` (see `branch-workflow.md` "Revalidate, every time"), so the test runner is invoked directly and any of those four scripts still needed here is invoked by its absolute path on the control worktree;
2. pushes the publish branch, opens a PR targeting `main`, and attaches the E2E tests Matrix Actions run URL per `branch-workflow.md`;
3. on control's own checkout (never switched away), updates the tracker row to `done` with the PR link and pre-migration graph-refresh result, then commits and pushes only the tracker change; and
4. restores control's worktree to clean and verifies `git status --short` is empty.

Do not merge the publish branch into control. A later merge of `main` into control delivers the migration after its PR merges - which is the whole point of not committing it on control in the first place.

For this workflow, `done` means the PR was opened successfully.

## 8. Cleanup

Run `node provisioning/setup.ts --teardown` on every terminal path after provisioning begins: success, provisioning failure, test failure, review failure, publication failure, or blocker. This removes the migration's provisioned containers, volumes, and network. Also remove the publish worktree (`git worktree remove ../pmm-qa-publish`) once the PR is opened, delete the `.patch` checkpoint, and leave control's worktree clean.

On a terminal path that stops before publication, control's worktree still holds the uncommitted work. Say so explicitly in the handoff, and keep the `.patch` checkpoint rather than discarding either.

Teardown is classifier-blocked inside a subagent. When it is refused, report it in the handoff and leave the environment running for the parent rather than working around the refusal.

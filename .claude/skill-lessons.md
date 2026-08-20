# Skill Lessons

Open, sanitized lessons awaiting review.

## .claude/skills/codeceptjs-migration/run.md — decide and commit workflow coverage before the final review gate, and check tag selectability per scenario, not per file

- Added: 2026-08-20
- Evidence: A migration whose source file mixed tag sets across scenarios failed the final review gate twice on the same unchanged commit, ~17 minutes of gate time plus a writer round trip. Step 7 places the workflow-coverage commit after the step 6 gate, so the gate can only ever judge a coverage plan described in prose, never the committed YAML. The blocker itself was per-scenario: one migrated scenario carried only the source's own tags and matched no destination grep, so retiring the CodeceptJS source would have dropped it from CI silently while the file as a whole looked covered. The gate passed on the third pass only after coverage was committed early, out of the prescribed order.
- Proposed change: Move the workflow-coverage decision and commit out of step 7 and ahead of step 6, so the final review verifies committed YAML; and add a writer-phase check that every migrated scenario title is matched by the destination workflow grep, verified with `npx playwright test --list --grep`, rather than checking the file's union of tags once.

## .claude/skills/codeceptjs-migration/branch-workflow.md — the publish worktree is not a copy of control, and the cross-migration check must compare content, not file existence

- Added: 2026-08-20
- Evidence: Three separate stalls in one publish step. The prescribed pre-cherry-pick check reports a path as present on the base branch and says nothing when the *hunk* the migration edits is missing — a sibling migration's still-unmerged PR had introduced the CI job being edited, so the check passed and the cherry-pick conflicted anyway. The documented single-test runner script is control-only tooling and absent from a worktree cut from the base branch, costing a failed run attempt before falling back to invoking the test runner directly. And the cherry-pick cannot even be completed before installing dependencies in the fresh worktree, because the pre-commit hook shells into a local module.
- Proposed change: Widen the pre-cherry-pick check from "does this path exist on the base branch" to a content comparison of the specific hunks each commit touches; and state in the publish section that the worktree needs a dependency install before `git cherry-pick --continue`, and that revalidation there must invoke the test runner directly because control-only scripts are absent.

## .claude/skills/codeceptjs-migration/run.md — the parent owns gate spawns, gate re-requests, and any operation a subagent is not permitted to perform

- Added: 2026-08-20
- Evidence: Three avoidable stalls in one run. Twice a worker subagent spawned the gate reviewer itself and then blocked waiting for a reply that never arrived, each time needing an external nudge to resume; spawning the gate from the parent instead returned normally. Separately, a re-requested gate was handed over as a fresh review with no mention of the prior verdict, so the second pass re-derived the entire checklist to rediscover one unchanged blocker and could not move; the third pass, handed the prior finding and the exact fixes, completed as a targeted verification in the same wall-clock as a single earlier pass. Finally, a state reset the test needed between runs on a reused environment was refused by the permission classifier for a subagent — the same class as the teardown command — and only completed when the parent performed it.
- Proposed change: State in the parent-orchestration section that the parent, never a worker subagent, spawns review gates; that a re-requested gate handoff must carry the prior verdict, its blocker, and what changed since; and that classifier-blocked operations such as environment teardown and test-state resets are parent-only, so a subagent should stop and ask rather than route around them.

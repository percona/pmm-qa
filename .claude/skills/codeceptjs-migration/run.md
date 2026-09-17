# Migration Phase Contracts

What each worker phase does and what it returns. The parent's steps 1, 2a and 3, gate ownership and the timeline are in `orchestration.md`; workers do not read it.

Every phase edits control's worktree and commits nothing there; only the parent commits on control, and only the tracker. Publication (step 7) moves the work to a branch cut from `origin/main` in an isolated worktree.

Environment contract: reuse the prepared local PMM, never recreate or clean it, pass the parent's `PMM_UI_URL` and `ADMIN_PASSWORD` to every command, never edit `e2e_tests/.env`. Never send a request with a wrong password: Grafana blocks `admin` after 5 failed logins in a rolling 5-minute window, for basic auth and the UI form alike, and every retry re-arms it. Read the password state from `/srv/logs/grafana.log` in the pmm-server container or `provisioning-artifacts/`. `/v1/server/readyz` is unauthenticated and proves nothing about credentials; the oracle is one call to `/v1/users/me` (200 correct, 401 wrong).

Search contract: the Grep tool, an explicit path scope, an explicit `output_mode`.

## 2. Discover and migrate

The writer:

1. reads the source test and applies the worth-porting gate to every scenario (`SKILL.md` Before migrating), recording the evidence;
2. resolves every name the source destructures in `Scenario`, `Before` and `After` (`async ({ I, somePage }) =>`) through the `include` map in `codeceptjs-e2e/codeceptConfigHelper.js`; injection is not an import, so nothing else lists these files;
3. opens the resolved files and follows their `require` chains: hooks, page objects, `custom_steps.js`, helpers, API objects, test data;
4. greps `e2e_tests/pages`, `api`, `helpers`, `fixtures` and `tests` for the page or feature name to find reusable Playwright files;
5. opens and verifies the actual target candidates;
6. derives environment setup from source behavior;
7. migrates the test to native Playwright;
8. checks destination selectability per scenario;
9. runs `bash .claude/scripts/check-migration-conventions.sh` on every changed file, fixes every failure, and pastes the output in the handoff;
10. runs static validation.

Step 8, against jobs as they exist today (coverage YAML is edited only at step 5b):

- Per job, `npx playwright test --list --grep '<expression>'` over the migrated titles. Identify each job's runner by its `uses:` line, not by its input key: `nightly-e2e-tests-matrix.yml` keys its Playwright job `tags_for_tests` and maps it onto the runner's `pmm_test_flag`. Report the CodeceptJS and Playwright job counts.
- A scenario matching no job is `destinationTagNeeded: true`; the report names the tag or job the runner must add. A tag no `.github` job selects is checked against the consumer table in `branch-workflow.md` Workflow coverage before it is called unconsumed, and named in the report either way. Naming the tag or job the runner must add resolves the need; the writer edits no workflow and adds no tag to a title. Do not return `MIGRATION_READY` while any scenario's need is unresolved.
- A scenario that matches: state that job's `setup_services` against your derived `setupServices`; a mismatch is a wrong bucket or a job that cannot execute what it selects.
- A single `--list --grep` over the `|`-union of every expression is valid only to prove the negative (zero matches). Once anything matches, fall back to the per-job loop. State which form was used.

Step 10: if a migrated tag does not already appear under `e2e_tests`, run `python support_scripts/generate_readme.py` then `--check` from the repository root before returning; there is no npm script for it. It rewrites the `qa-integration`, `e2e_tests` and `cli` READMEs; a change outside `e2e_tests/README.md` is pre-existing drift, not this migration's.

Leave the changes uncommitted and report the changed paths.

Writer output: `MIGRATION_READY`, `BLOCKED`, or `STATIC_FAILED`.

## 4. Initial review and MCP verification

The reviewer independently:

1. re-derives the source's linked files through the `codeceptConfigHelper.js` include map and `require` chains, and the target's reusable files by grep;
2. compares all source behavior with the migrated implementation;
3. confirms nothing is missing or weakened;
4. re-derives the writer's per-scenario selectability check;
5. verifies every new or changed locator through MCP against the prepared environment, counting over the fully rendered DOM (`locator-fix.md` Lazy rendering);
6. fixes locator definitions only when live DOM evidence proves the correction;
7. reruns static validation after locator changes.

Review the working tree, not a commit range; locator fixes stay uncommitted. Non-locator findings return to the writer, and changed code is reviewed again.

Reviewer output: `READY_TO_RUN`, `REVIEW_FAILED`, or `LOCATOR_FIX_REQUIRED`.

## 5. Execute

The runner, against the prepared environment with the same credential pair:

- new target file with only migrated scenarios: run the complete file once;
- appended existing file: run the migrated scenarios, then the complete file;
- `targetMode: already-covered`: run the existing target file or matched titles as regression evidence.

Run in declaration order unless the source proves the scenarios independent. A test that reads state by index needs that state reset before a run on a reused environment; a file whose `beforeEach` restores its own precondition needs no external reset. If a reset is classifier-refused, stop and ask the parent.

Failure routing:

- locator failure: reviewer;
- migration logic failure: writer;
- environment or product failure: run the unmigrated source against the same environment first. If the source passes where the migration fails, the failure is the migration's; otherwise keep `in-progress` and record the reason;
- stale environment state: reset and rerun, no review needed.

Any code change is reviewed again before rerunning. Never clean or recreate the environment after a failure.

## 5b. Cut the publish branch, move the work, add coverage

After execution passes and before the final review, the runner cuts the worktree and branch from `origin/main`, moves control's uncommitted changes across, commits them, then retires the source and edits workflow coverage in that worktree. Commands and coverage rules: `branch-workflow.md`, sections Cut the publish branch and Workflow coverage, applied in full.

## 6. Final review

Once the publish branch carries the code, the retirement and the coverage, the parent spawns the reviewer for a complete review of that branch plus the execution evidence.

Reviewer output: `FINAL_REVIEW_PASS` or `FINAL_REVIEW_FAILED`.

## Gate ledger

Both gates. The parent passes the path of `.claude/migration-observations/<row>-<slug>.gates.yaml`; read it before any other work and append one entry before returning:

```yaml
- gate: initial | final
  attempt: 1
  rowsCovered: []   # the tracker row this gate covers
  subject:
    kind: worktree | branch   # initial gate is always worktree; final gate is branch, except worktree in test-run mode
    startRef:       # kind: branch only: the branch HEAD sha, measured before any review work
    endRef:         # kind: branch only: the branch HEAD sha again, measured immediately before returning; must equal startRef for a passing verdict
  verdict: READY_TO_RUN | REVIEW_FAILED | LOCATOR_FIX_REQUIRED | STALE_SUBJECT | FINAL_REVIEW_PASS | FINAL_REVIEW_FAILED
  blockers:
    - id: B1
      claim:
      evidence:
      status: open | fixed-by:<commit-or-note> | withdrawn
  advisories: []
  conventionScriptOutput: |   # verbatim, on a passing entry
  shape: {}                   # the populated shape block, on a passing entry
```

Parse-check the file before returning; a locator written bare (`getByRole('button', { name: 'x' })`) is a YAML mapping-value error, so quote every value holding a `:`. Store the evidence itself on a passing entry, not a summary; a re-spawned gate has no transcript and recovers nothing except through this file.

Scope:

- No entry for this gate: attempt 1, the full `audit-checklist.md`.
- Last entry not a pass with `open` blockers: those ids plus what changed on the subject since its `endRef`. `withdrawn` items are not re-derived unless their code changed. Only `open` items and the delta are in scope, whatever a prose handoff asks.
- Delta undeterminable (no `endRef` to diff): stop and report the gap; do not re-derive everything.

Subject stability, `kind: branch` only: measure HEAD before any review work and again before returning. If they differ, record both, return `STALE_SUBJECT`, never a pass. A worktree subject omits the refs and never returns `STALE_SUBJECT`; the parent's invariant that nothing writes to a subject under a live gate is its only protection.

## 7. Publish

Only after `FINAL_REVIEW_PASS`, the runner:

1. revalidates the publish worktree (`branch-workflow.md` Revalidate, every time; the migration scripts are control-only and invoked by absolute path);
2. pushes, opens the PR against `main`, and attaches the Actions run (`branch-workflow.md` Push and open the PR, Attach CI execution);
3. on control's own checkout, updates the tracker row to `done` with the PR link and commits and pushes only the tracker (`branch-workflow.md` Tracker completion and cleanup);
4. restores control's worktree to clean and verifies `git status --short` is empty.

Do not merge the publish branch into control. `done` means the PR was opened.

## 8. Cleanup

Run `node provisioning/setup.ts --teardown` on every terminal path after provisioning begins: success, provisioning failure, test failure, review failure, publication failure, or blocker. Remove the publish worktree (`git worktree remove ../pmm-qa-publish`) once the PR is opened, and leave control's worktree clean.

On a terminal path before publication, control's worktree still holds the uncommitted work: say so in the handoff and do not discard it. Teardown is classifier-blocked inside a subagent: when refused, report it and leave the environment for the parent.

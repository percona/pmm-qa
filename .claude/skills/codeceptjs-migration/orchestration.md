# Migration Orchestration (parent only)

The parent agent's half of the workflow: row selection, preflight, provisioning, gate ownership, and the phase timeline. Worker subagents do not read this file - their phase contracts are in `run.md`, and the canonical sequence below is the single copy of it.

Run exactly one batch at a time, where a batch is one row by default and may be several rows only under section Batch mode. That batch owns one local Docker PMM environment from the moment provisioning starts until PR creation. Do not clean or recreate that environment inside the workflow. Within a batch, rows are still migrated one at a time and each gets its own writer pass and its own live proof - batching changes what is published together, never what is verified independently.

Migration work happens and is tested in the control branch's own worktree. What is committed where, and why, is owned by `branch-workflow.md` section What is committed where - read it before this file if you have not already.

Step 7 (Publish) touches that second ref via an isolated `git worktree`; control's own checkout is never switched away from, through the entire workflow.

Use WSL/Git Bash for `.claude/scripts/*.sh`; keep shell scripts LF-only and run `bash -n .claude/scripts/*.sh` after editing them.

## Parent orchestration

The parent agent coordinates writer, reviewer, and runner subagents. To avoid idle time:

- Launch each subagent and **wait on its task completion notification** (or poll its transcript every 10-15s). Do **not** use long `Await` sleeps with regex patterns on terminal output.
- **The parent, and only the parent, spawns review gates.** A worker subagent that spawns another subagent and then blocks waiting for its reply deadlocks. Do not give the runner, or any worker, the job of requesting a review: the runner returns its execution evidence and stops, and the parent spawns the reviewer.
- **Never run two reviewers against the same commit.** Before spawning a gate, confirm no reviewer is still live for it. Reviewer cost is roughly flat per spawn regardless of scope, so the only lever on gate cost is spawning fewer of them; a duplicated final review is the largest single avoidable cost in this workflow.
- **A `STALE_SUBJECT` verdict is not a failure and is never a pass.** It comes only from the final gate, and means the publish branch moved underneath the reviewer, so the verdict cannot apply to anything. Do not treat it as `FINAL_REVIEW_FAILED` and route it to the writer; re-spawn the same gate, scoped to the delta between the ledger entry's `startRef` and the branch's current HEAD. If you are seeing it repeatedly, something is committing to the publish branch while the gate is live - stop doing that first.
- **The initial gate has no staleness detection, so the invariant is yours to hold.** Its subject is control's uncommitted worktree, which has no ref to compare against (`run.md` section Gate ledger explains why the phase `.patch` hash cannot substitute). Nothing may write to control's worktree while an initial gate is live - no writer re-spawn, no parent state reset, no unrelated edit. A gate that silently reviewed a tree you changed underneath it will report a pass on work nobody checked.
- **A re-requested gate reads its own gate ledger (section Gate ledger, below) before doing anything else.** Include the ledger path in the handoff, but do not rely on retyping the prior verdict into prose - the ledger is what the reviewer is required to check itself, precisely so a parent omission cannot cause a full re-derivation of an unchanged finding.
- Enforce gates strictly: no execution before `READY_TO_RUN`, no publish branch before execution passes, no final review before the code and its workflow coverage are committed on that branch, no push or PR before `FINAL_REVIEW_PASS`, and no tracker `done` before a PR exists. There are no exceptions: every row gets both gates, in this order. A structure that drops the initial gate would contradict `SKILL.md` Required outcome items 2 and 3, which are authoritative.
- **Nothing the migration produces is committed on control.** If a subagent reports a commit SHA on control for migration code, that is a defect: have it reset the commit and leave the change in the worktree.
- Overlap only where gates allow: provisioning runs in the background while the writer migrates (step 2a); static review can start while PMM provisions; MCP locator checks begin after readyz passes. Everything else is serial. Candidates and their verdicts live in `parallelization-ledger.md`; do not add an overlap that is not recorded there as `implemented`.
- Reuse one local PMM environment per batch (one row by default); never recreate it mid-workflow. Within a batch, reset test state between rows rather than reprovisioning - see section Batch mode.
- Never edit `e2e_tests/.env` during migration. Use `PMM_UI_URL=https://127.0.0.1/` and `ADMIN_PASSWORD=admin` unless the local provisioning command selected different values, and pass the same pair to every review and execution command.
- **Operations a subagent is not permitted to perform belong to the parent.** Environment teardown and test-state resets - for example emptying the Grafana annotation table between runs on a reused environment - are refused by the permission classifier inside a subagent. A subagent must stop and ask rather than route around the refusal by another means; the parent performs the operation and resumes it.
- Locator verification goes through the Playwright MCP server, which `.mcp.json` declares repo-level so every subagent inherits it. `node .claude/scripts/verify-migration-locator.mjs help-export-logs` is not a general fallback - it hardcodes `/pmm-ui/help` on every code path and supports only `getByRole` plus an optional `a[href=...]`. Use it for that one preset; if MCP is unavailable, stop and report it rather than checking a different page.
- Once the background provisioning command starts in step 2a, if the workflow stops before the runner is invoked (including a provisioning failure or an exhausted writer/reviewer loop), the parent runs `node provisioning/setup.ts --teardown` before stopping. The runner owns cleanup for every path it reaches in step 8.
- Maintain this migration's timeline at `.claude/migration-observations/<row>-<slug>.md`; see section Phase timeline. The parent creates it in step 1 and appends rows for provisioning, gate transitions, and publish. Each subagent appends its own row before returning.
- After each subagent phase completes, `.claude/hooks/migration-phase-observe.sh` requests a `skill-gardener` Capture pass for that phase. The hook fires when a subagent is launched, not when it finishes, so treat it as a reminder rather than a signal. Batch the passes to the end of the migration whenever another subagent is still live - editing skill files underneath a running subagent is worse than a late capture.
- Do not rely on the `PostToolUse`/`Skill` hook for this workflow. It fires against the `Skill` tool call, which for an inline-loading skill returns as soon as the instructions load.
- Record the tracker `in-progress` commit SHA in the handoff so a resumed session can recover which row is active. It is a marker only; it no longer defines a commit range, because nothing is cherry-picked.
- **Checkpoint the uncommitted worktree after each phase** to `.claude/migration-observations/<row>-<slug>.patch`, using the exact command form in `branch-workflow.md` section Checkpointing uncommitted work - `git add -N` over currently-existing paths, then `git diff HEAD --binary -M --output=`. Do not improvise a `git diff > file` variant; every part of that form is load-bearing. That directory is gitignored, so this is a recovery point and not a commit. Delete it once the PR is open. Without it a multi-hour run has nothing to fall back on.
- **Restore control's worktree to clean after publication.** The migration's edits are still sitting there; leaving them means the next migration starts on top of them.

## 1. Select and prepare

On the control branch, first check whether another tracker row is already `in-progress`; stop and report the conflict if so. Then check whether **any** migration PR is currently open; stop and report if even one is. Third, ensure Node.js 22.18 or newer and Docker are available and inspect the fixed local resources the provisioner uses: `pmm-server`, `client_container`, `pmm-data`, the `pmm-qa` network, and engine-labeled containers and volumes. Treat every matching resource as foreign unless this migration created it earlier in the same run; stop instead of adopting, replacing, or tearing down another environment.

All three are preflight stop conditions, so all three run here - before the `origin/main` merge, both graph refreshes, and the `in-progress` tracker commit. A foreign environment found at step 2a instead would strand a committed `in-progress` row behind a provision that cannot start. Match on the `migrate(<scope>):` title prefix every migration PR uses, not on a full-text title search:

```bash
gh pr list --repo percona/pmm-qa --state open --json number,title --jq '[.[] | select(.title | startswith("migrate("))]'
```

`--search 'migrate in:title'` is wrong here: GitHub tokenizes the query, so it also matches unrelated PRs such as "Migrate QA cloud agents to Claude Code" and "PMM-7: Migrate upgrade tests". Since this step stops the workflow, one such PR blocks every future row with a reason that is not true.

The nightly Playwright matrix and `e2e_tests/README.md` are touched by every migration PR, so starting a new row while one is open is what produces the second conflicting PR - the cap is one open migration PR in total, which means zero open before a new row starts. Land or otherwise close the open PR before selecting a new row. Note that a batch (section Batch mode) produces one PR for several rows, which is how throughput is recovered under this cap rather than by allowing a second PR. Only once both checks are clear, merge `origin/main` into control - merging before this check risks mixing an unrelated merge commit into an already-active migration's history.

`tracker.md` runs to tens of kilobytes. Never read it whole: select the row with a scoped `grep`/`head` over the status column, and read only that row plus whichever header section you actually need.

Before selecting a row, check the tracker for drift against the filesystem: list `codeceptjs-e2e/tests/**/*_test.js` and diff it against the tracker's `Source` column. Any file with no matching row is untracked drift - append it as a new `pending` row (Bucket/Env/Setup left blank pending confirmation from its `Before`/`BeforeSuite`/`Data(...)` hooks, Notes noting it was added by drift check) in its own tracker-only commit before proceeding. In test-run mode, report the drift without editing the tracker. Do not silently skip untracked files.

Use this extraction verbatim rather than improvising one. `grep -P` is not reliably available here, and a `sed` backslash expression fails outright on Windows - either way the call exits with an empty result that reads exactly like a valid "no drift" answer:

```bash
comm -23 <(find codeceptjs-e2e/tests -name '*_test.js' | sort -u) \
         <(grep -oE 'codeceptjs-e2e/tests/[A-Za-z0-9_/.-]+_test\.js' \
             .claude/skills/codeceptjs-migration/tracker.md | sort -u)   # untracked drift
comm -13 <(find codeceptjs-e2e/tests -name '*_test.js' | sort -u) \
         <(grep -oE 'codeceptjs-e2e/tests/[A-Za-z0-9_/.-]+_test\.js' \
             .claude/skills/codeceptjs-migration/tracker.md | sort -u)   # tracked but absent
```

No `sed`, no path post-processing. Compare both directions and state the two counts.

Check practices freshness: read `@playwright/test` from `e2e_tests/package.json` and compare it with `verifiedAgainst` in `playwright-practices.md`. If they differ, stop and refresh that file against the Playwright release notes before migrating; a stale practices file silently authorizes outdated idiom for every later row.

Select the first `pending` tracker row - `tracker.md`'s status legend already excludes B13 rows from `pending` (they carry `blocked-infra`), so no separate bucket check is needed here. Refresh and commit both `e2e_tests/graphify-out/` and `codeceptjs-e2e/graphify-out/` per `graphify.md`, then change the selected row to `in-progress` in a separate tracker-only commit. Follow `branch-workflow.md` for the exact preflight commands. Record that commit's SHA as the active-row marker.

Do not begin migration work until the control merge and both graph refreshes are complete. Confirm the worktree is clean first - a previous migration that failed to restore it leaves edits that would be swept into this migration's patch. From here everything the migration produces stays uncommitted in control's worktree until publish (step 7).

Create this migration's timeline file (`mkdir -p .claude/migration-observations` first; the directory is gitignored and may not exist) and record the selection, the confirmed bucket, and the active-row marker commit.

## Test-run mode

The parent may explicitly designate a run as test-only (dry run). In that mode, use the existing graphs read-only and skip only:

- the tracker `pending` -> `in-progress` -> `done` status writes and Notes updates;
- the control-branch graph refreshes and commits;
- Stage 5b and 7 (publish branch, source retirement, workflow-coverage commit, push, and PR); and
- the step 1 open-migration-PR check, which exists to prevent a publish-branch collision that cannot occur when no publish branch is cut. The `in-progress` and foreign-resource checks still apply.

Because 5b is skipped, the final gate's subject is control's worktree rather than a branch. It then follows the initial gate's rule: `kind: worktree`, no `startRef`/`endRef`, and `STALE_SUBJECT` is never returned.

All other steps, including provisioning, review, `READY_TO_RUN`, execution, and `FINAL_REVIEW_PASS`, still apply unchanged. Test-run mode never skips a gate; it only skips tracker, graph-refresh, and publication side effects. Workflow coverage is designed and its greps verified as usual, but not committed, since there is no publish branch to commit it on.

## Batch mode

**Status: defined but not enabled.** `parallelization-ledger.md` records this candidate as `needs-evidence, trial-gated`, and the rule above ("do not add an overlap that is not recorded there as `implemented`") therefore forbids using batch mode as routine practice. Do not batch rows by default. Batch mode may be used only when the parent explicitly designates a run as a batch-mode trial, which must record per-row phase timings and any cross-row state contamination on the timeline. After two such trials the ledger row moves to `implemented` or `unsafe`; until then, every migration is a single-row batch.

Provisioning overlap with the writer is already free - it cost zero net wall clock on the one migration measured. What is not free is the per-row cost that does not shrink with diff size: the final gate, the publish phase, the two graph refreshes, and the PR itself. Batch mode amortizes that fixed cost across several rows that already share a provisioned environment, instead of paying it once per row.

Eligibility: consecutive `pending` rows (after any reordering needed so rows sharing a `Setup` string are adjacent) whose `Setup` column is character-for-character identical, capped at 5 rows per batch. Do not batch across a bucket boundary and do not batch a row whose test selects state by index on a reused environment (for example anything like `verifyAnnotations`) with any other row - state from one row's proof run must not leak into the next row's.

Procedure: provision once for the whole batch. For each row in the batch, in turn: run the writer, the initial review gate, and the row's own live execution against the shared environment, exactly as a single-row migration would - each row still gets its own independent proof. Do not cut a publish worktree per row. Once every row in the batch has passed its own initial review and execution, cut one publish worktree and branch, move every row's changes across, commit the retirement and workflow coverage for the whole batch, run one final review covering all rows, and open one PR listing every migrated row. Update every row's tracker status together, in one tracker-only commit, once the PR is open.

State reset between rows in a batch must be explicit and recorded on the timeline (for example a Grafana annotation table reset) - do not assume one row's proof run left the environment in the state the next row's proof run needs.

Tracker and recovery bookkeeping for a batch:

- All rows in the batch go `pending` -> `in-progress` together, in one tracker-only commit, before any writer starts. That commit is the batch's active-row marker; record every row number it covers in the handoff and on the timeline. The step 1 "is another row already in-progress" check treats the whole batch as one occupant - several rows `in-progress` at once is expected inside a batch and a defect outside one.
- Each row keeps its own recovery checkpoint at `.claude/migration-observations/<row>-<slug>.patch`, snapshotted after that row's own phases, never a single shared patch for the batch. Scope each row's checkpoint to that row's own exclusive paths plus, for any shared path it touched, only that row's hunks.
- Maintain one timeline file per row, as usual, plus one gate-ledger entry per gate spawn recording which rows that gate covered.
- **Classify every changed path before publishing, because rows in a batch routinely share files.** A path is *row-exclusive* if exactly one row in the batch changed it (typically the migrated test and any POM or helper only it needs). A path is *batch-shared* if two or more rows changed it - which is the normal case for the workflow-coverage YAML (each row appends a tag) and for `e2e_tests/README.md` (the pre-commit hook regenerates it for every commit touching `e2e_tests/tests/**/*.ts`), and can also happen for a helper or API client two rows both extend.
- **Do not batch two rows that edit the same region of a shared code file.** Overlapping hunks in one helper cannot be separated later, so the rows cannot be dropped independently. Compare each row's changed-path list against the others' after its writer pass; on an overlapping-hunk collision, split the batch rather than continuing.
- If one row fails and cannot be fixed, drop just that row - but never by restoring a batch-shared path, which would erase the surviving rows' changes to it. Restore only that row's *exclusive* paths, then **recompute** each batch-shared path for the surviving set: re-derive the coverage YAML from the survivors' tags, and let the pre-commit hook regenerate `README.md`. Revert the dropped row's tracker row to `pending` with a Notes entry, and re-verify selectability for the survivors afterwards, since the coverage YAML changed. Do not fail the whole batch for one row, and do not carry a known-broken row into the shared PR.

## 2a. Start provisioning in the background

This runs before step 2 and overlaps it. Provisioning is the long pole and the environment bucket is already known: the tracker row proposes it and step 1 confirms it against the source's `Before`/`BeforeSuite` hooks and `Data(...)`. Waiting for the writer first wastes that time.

The parent, not the writer, owns the confirmation, and the tracker's `Setup` is a planned default that is regularly wrong. Derive the real set from the services the source's data rows, hooks, and shell commands actually name, then correct the tracker row when it differs - a row can just as easily name a database the test never touches as omit one it needs.

The local-resource inspection that gates provisioning is a step 1 preflight check, not a step 2a one - see step 1. Do not repeat it here; by this point it has already passed.

Start `provisioning/setup.ts` in the background with the confirmed setup and launch the writer immediately. Record the exact provisioning command and the start time in the handoff and on the timeline. From this moment the teardown obligation is live: any terminal path runs `node provisioning/setup.ts --teardown`.

If the writer's derived `setupServices`/`setupClient` contradicts the confirmed bucket, tear down, re-provision with the corrected setup, and record the mismatch on the timeline. That record is the evidence that decides whether this overlap keeps paying for itself.

## 3. Wait for the environment and verify it

After `MIGRATION_READY`, wait for the step 2a background provision to finish. Do not start a second one.

The provisioning command runs from control's worktree and accepts the tracker's existing `--database` grammar. Omit tracker-only `-h`/`--help` no-op values. Examples:

```bash
node provisioning/setup.ts
node provisioning/setup.ts --database ps=8.4 --database psmdb
node provisioning/setup.ts --db client
node provisioning/setup.ts --database ps=8.4 --db client
```

Use no database arguments for server-only setup. Append `--db client` whenever the confirmed setup includes `setupClient: true`, including alongside database arguments; it represents a distinct standalone node.

`PMM_DEBUG=1` is a provisioner default, matching every other PMM test environment in this repository, so source tests that assert on log volume work without extra flags. Override it only when a test needs quieter logs: `--server-env PMM_DEBUG=0`.

Then verify the prepared environment:

```bash
PMM_UI_URL="${PMM_UI_URL:-https://127.0.0.1/}" ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}" bash .claude/scripts/run-migration-single-test.sh '<target-test-file>' --prepare-only
```

After this step, all later review and execution commands must reuse the same `PMM_UI_URL` and `ADMIN_PASSWORD`. If the environment becomes unreachable, keep the tracker `in-progress`, record the blocker and `provisioning-artifacts/` path in Notes, and stop instead of recreating it.

## Phase timeline

One file per migration at `.claude/migration-observations/<row>-<slug>.md`, appended to and never rewritten. It is local evidence, gitignored, and excluded from the publish PR. Prune to the last ten migrations.

It exists because a subagent's internals are invisible to the parent, which receives only a final YAML block. Without it, `skill-gardener` has nothing to audit for the writer, reviewer, and runner phases, and no basis for judging whether a step can be overlapped.

```markdown
# <row> <source> -> <target>

| phase | started | ended | gate | loop | retries | notes |
| --- | --- | --- | --- | --- | --- | --- |
| provision | 14:02 | 14:41 | ready | 1 | 1 | first attempt failed, stale container from a prior run |
| writer | 14:02 | 14:31 | MIGRATION_READY | 1 | 0 | 3 static-validation reruns |
```

Times come from `date -Is`, truncated to `HH:MM`. Each phase adds one row plus one short line saying what cost time and what it was blocked on; a phase cannot be judged parallelizable without that. Record no raw command transcript, no secrets, and no environment credentials.

## Gate ledger

Every gate spawn appends one entry to `.claude/migration-observations/<row>-<slug>.gates.yaml`. The parent creates that file alongside the timeline file in step 1 (same gitignore, same pruning) and includes its path in every gate handoff. The reviewer reads and appends to it itself.

The entry schema and the scoping rule the reviewer must follow live in `run.md` section Gate ledger, because the reviewer reads `run.md` and must not read this file. Do not restate the schema here.

The parent's own obligations: create the file in step 1; pass its path on every gate spawn; never spawn a second gate for a subject while one is still live for it; and treat a `FINAL_REVIEW_FAILED` entry whose blockers are all still `open` as a signal to route work to the writer or runner, not to re-spawn the same gate unchanged.

## Canonical sequence

```text
pending
-> check no other row is in-progress (a whole batch counts as one occupant)
-> check no migration PR is open
-> merge main into control
-> refresh target graph on control
-> refresh source graph on control
-> in-progress (tracker-only commit; marks the active row)
-> refreshed graph discovery (read-only)
-> inspect local resources, then start provisioning in the background
   |
   +-- concurrently: migration, directly on control
   |
-> wait for the provisioned environment, verify with --prepare-only
-> initial review
-> MCP locator verification
-> test execution or already-covered regression against the same local PMM environment
   (everything so far is UNCOMMITTED in control's worktree)
-> cut isolated worktree + publish branch from origin/main
-> move the migrated code across, commit it there
-> retire source + commit workflow coverage, there
-> final review, over the publish branch
-> revalidate in that worktree
-> push, PR opened
-> tracker done on control, restore control's worktree clean
-> tear down the local PMM environment and the publish worktree
```

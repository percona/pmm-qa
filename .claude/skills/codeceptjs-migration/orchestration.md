# Migration Orchestration (parent only)

The parent agent's half of the workflow: row selection, preflight, provisioning, gate ownership, and the phase timeline. Worker subagents do not read this file - their phase contracts are in `run.md`, and the canonical sequence below is the single copy of it.

Run exactly one migration at a time. One selected migration owns one local Docker PMM environment from the moment provisioning starts until PR creation. Do not clean or recreate that environment inside the workflow.

All working-phase steps (writer, provisioning, review, execution, workflow coverage, final review, source retirement) happen directly on the control branch's own worktree - no separate migration branch exists until publish time. Step 7 (Publish) touches a second ref via an isolated `git worktree`; control's own checkout is never switched away from, through the entire workflow.

Use WSL/Git Bash for `.claude/scripts/*.sh`; keep shell scripts LF-only and run `bash -n .claude/scripts/*.sh` after editing them.

## Parent orchestration

The parent agent coordinates writer, reviewer, and runner subagents. To avoid idle time:

- Launch each subagent and **wait on its task completion notification** (or poll its transcript every 10-15s). Do **not** use long `Await` sleeps with regex patterns on terminal output.
- **The parent, and only the parent, spawns review gates.** A worker subagent that spawns another subagent and then blocks waiting for its reply deadlocks. Do not give the runner, or any worker, the job of requesting a review: the runner returns its execution evidence and stops, and the parent spawns the reviewer.
- **Never run two reviewers against the same commit.** Before spawning a gate, confirm no reviewer is still live for it. Reviewer cost is roughly flat per spawn regardless of scope, so the only lever on gate cost is spawning fewer of them; a duplicated final review is the largest single avoidable cost in this workflow.
- **A re-requested gate handoff must carry the prior verdict, its blocker, and what changed since.** A gate re-requested as though it were a fresh review re-derives the whole checklist to rediscover one unchanged finding, and cannot move.
- Enforce gates strictly: no execution before `READY_TO_RUN`, no workflow-coverage commit before execution passes, no final review before coverage is committed, no publish before `FINAL_REVIEW_PASS`, and no tracker `done` before a PR exists.
- Overlap only where gates allow: provisioning runs in the background while the writer migrates (step 2a); static review can start while PMM provisions; MCP locator checks begin after readyz passes. Everything else is serial. Candidates and their verdicts live in `parallelization-ledger.md`; do not add an overlap that is not recorded there as `implemented`.
- Reuse one local PMM environment per migration; never recreate it mid-workflow.
- Never edit `e2e_tests/.env` during migration. Use `PMM_UI_URL=https://127.0.0.1/` and `ADMIN_PASSWORD=admin` unless the local provisioning command selected different values, and pass the same pair to every review and execution command.
- **Operations a subagent is not permitted to perform belong to the parent.** Environment teardown and test-state resets - for example emptying the Grafana annotation table between runs on a reused environment - are refused by the permission classifier inside a subagent. A subagent must stop and ask rather than route around the refusal by another means; the parent performs the operation and resumes it.
- For MCP locator fallback, run `node .claude/scripts/verify-migration-locator.mjs help-export-logs` against the prepared environment.
- Once the background provisioning command starts in step 2a, if the workflow stops before the runner is invoked (including a provisioning failure or an exhausted writer/reviewer loop), the parent runs `node provisioning/setup.ts --teardown` before stopping. The runner owns cleanup for every path it reaches in step 8.
- Maintain this migration's timeline at `.claude/migration-observations/<row>-<slug>.md`; see section Phase timeline. The parent creates it in step 1 and appends rows for provisioning, gate transitions, and publish. Each subagent appends its own row before returning.
- After each subagent phase completes, `.claude/hooks/migration-phase-observe.sh` requests a `skill-gardener` Capture pass for that phase. The hook fires when a subagent is launched, not when it finishes, so treat it as a reminder rather than a signal. Batch the passes to the end of the migration whenever another subagent is still live - editing skill files underneath a running subagent is worse than a late capture.
- Do not rely on the `PostToolUse`/`Skill` hook for this workflow. It fires against the `Skill` tool call, which for an inline-loading skill returns as soon as the instructions load.
- Record the `migration-start` commit SHA (the "mark row in-progress" commit, see `branch-workflow.md`) in the handoff so it survives a resumed session - it is what defines this migration's cherry-pick range at publish time.

## 1. Select and prepare

On the control branch, first check whether another tracker row is already `in-progress`; stop and report the conflict if so. Only once clear, merge `origin/main` into control - merging before this check risks mixing an unrelated merge commit into an already-active migration's history.

`tracker.md` runs to tens of kilobytes. Never read it whole: select the row with a scoped `grep`/`head` over the status column, and read only that row plus whichever header section you actually need.

Before selecting a row, check the tracker for drift against the filesystem: list `codeceptjs-e2e/tests/**/*_test.js` and diff it against the tracker's `Source` column. Any file with no matching row is untracked drift - append it as a new `pending` row (Bucket/Env/Setup left blank pending confirmation from its `Before`/`BeforeSuite`/`Data(...)` hooks, Notes noting it was added by drift check) in its own tracker-only commit before proceeding. In test-run mode, report the drift without editing the tracker. Do not silently skip untracked files.

The drift-check extraction must use the Grep tool or an ERE pattern, and must not post-process paths through `sed`. `grep -P` is not reliably available in this environment, and on Windows a `sed` backslash expression fails outright - either way the call still exits with an empty result that reads exactly like a valid "no drift" answer. Compare both directions and state the two counts.

Check practices freshness: read `@playwright/test` from `e2e_tests/package.json` and compare it with `verifiedAgainst` in `playwright-practices.md`. If they differ, stop and refresh that file against the Playwright release notes before migrating; a stale practices file silently authorizes outdated idiom for every later row.

Select the first `pending` tracker row that is not in B13. Always skip B13 rows. Refresh and commit both `e2e_tests/graphify-out/` and `codeceptjs-e2e/graphify-out/` per `graphify.md`, then change the selected row to `in-progress` in a separate tracker-only commit. Follow `branch-workflow.md` for the exact preflight commands. Record that commit's SHA as `migration-start`.

Do not begin migration work until the control merge and both graph refreshes are complete. All migration work happens directly on control from here - no branch is created until publish (step 7).

Create this migration's timeline file (`mkdir -p .claude/migration-observations` first; the directory is gitignored and may not exist) and record the selection, the confirmed bucket, and `migration-start`.

## Test-run mode

The parent may explicitly designate a run as test-only (dry run). In that mode, use the existing graphs read-only and skip only:

- the tracker `pending` -> `in-progress` -> `done` status writes and Notes updates;
- the control-branch graph refreshes and commits; and
- Stage 7 (Publish): source retirement, cherry-pick, commit, push, and PR.

All other steps, including provisioning, review, `READY_TO_RUN`, execution, workflow coverage, and `FINAL_REVIEW_PASS`, still apply unchanged. Test-run mode never skips a gate; it only skips tracker, graph-refresh, and publication side effects.

## 2a. Start provisioning in the background

This runs before step 2 and overlaps it. Provisioning is the long pole and the environment bucket is already known: the tracker row proposes it and step 1 confirms it against the source's `Before`/`BeforeSuite` hooks and `Data(...)`. Waiting for the writer first wastes that time.

The parent, not the writer, owns the confirmation, and the tracker's `Setup` is a planned default that is regularly wrong. Derive the real set from the services the source's data rows, hooks, and shell commands actually name, then correct the tracker row when it differs - a row can just as easily name a database the test never touches as omit one it needs.

Before starting anything, ensure Node.js 22.18 or newer and Docker are available, then inspect the fixed local resources the provisioner uses: `pmm-server`, `client_container`, `pmm-data`, the `pmm-qa` network, and engine-labeled containers and volumes. Treat every matching resource as foreign unless this migration created it earlier in the same run; stop instead of adopting, replacing, or tearing down another environment. This inspection happens before the background start, never after it.

Then start `provisioning/setup.ts` in the background with the confirmed setup and launch the writer immediately. Record the exact provisioning command and the start time in the handoff and on the timeline. From this moment the teardown obligation is live: any terminal path runs `node provisioning/setup.ts --teardown`.

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

## Canonical sequence

```text
pending
-> check no other row is in-progress
-> merge main into control
-> refresh target graph on control
-> refresh source graph on control
-> in-progress (this commit = migration-start)
-> refreshed graph discovery (read-only)
-> inspect local resources, then start provisioning in the background
   |
   +-- concurrently: migration, directly on control
   |
-> wait for the provisioned environment, verify with --prepare-only
-> initial review
-> MCP locator verification
-> test execution or already-covered regression against the same local PMM environment
-> workflow coverage, committed on control
-> final review, over committed code and committed coverage
-> retire source, directly on control
-> cut isolated worktree + publish branch from origin/main
-> cherry-pick migration-start..control onto publish branch
-> purify + revalidate
-> PR opened
-> done
-> tear down the local PMM environment and the publish worktree
```

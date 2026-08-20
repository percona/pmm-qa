# Simple Migration Workflow

Run exactly one migration at a time. One selected migration owns one local Docker PMM environment from the moment provisioning starts until PR creation. Do not clean or recreate that environment inside the workflow.

All working-phase steps (writer, provisioning, review, execution, final review, source retirement, workflow-coverage edits) happen directly on the control branch's own worktree — no separate migration branch exists until publish time. Step 7 (Publish) touches a second ref via an isolated `git worktree`; control's own checkout is never switched away from, through the entire workflow.

Use WSL/Git Bash for `.claude/scripts/*.sh`; keep shell scripts LF-only and run `bash -n .claude/scripts/*.sh` after editing them.

## Parent orchestration

The parent agent coordinates writer, reviewer, and runner subagents. To avoid idle time:

- Launch each subagent and **wait on its task completion notification** (or poll its transcript every 10-15s). Do **not** use long `Await` sleeps with regex patterns on terminal output.
- Enforce gates strictly: no execution before `READY_TO_RUN`, no publish before `FINAL_REVIEW_PASS`, no tracker `done` before a PR exists.
- Overlap only where gates allow: provisioning runs in the background while the writer migrates (step 2a); static review can start while PMM provisions; MCP locator checks begin after readyz passes. Everything else is serial. Candidates and their verdicts live in `parallelization-ledger.md`; do not add an overlap that is not recorded there as `implemented`.
- Reuse one local PMM environment per migration; never recreate it mid-workflow.
- Never edit `e2e_tests/.env` during migration. Use `PMM_UI_URL=https://127.0.0.1/` and `ADMIN_PASSWORD=admin` unless the local provisioning command selected different values, and pass the same pair to every review and execution command.
- For MCP locator fallback, run `node .claude/scripts/verify-migration-locator.mjs help-export-logs` against the prepared environment.
- Once the background provisioning command starts in step 2a, if the workflow stops before the runner is invoked (including a provisioning failure or an exhausted writer/reviewer loop), the parent runs `node provisioning/setup.ts --teardown` before stopping. The runner owns cleanup for every path it reaches in step 8.
- Maintain this migration's timeline at `.claude/migration-observations/<row>-<slug>.md`; see section Phase timeline. The parent creates it in step 1 and appends rows for provisioning, gate transitions, and publish. Each subagent appends its own row before returning.
- After each subagent phase completes, `.claude/hooks/migration-phase-observe.sh` requests a `skill-gardener` Capture pass for that phase. Run it before moving on. Invoke Capture manually for any phase the hook did not cover, including provisioning, and once more when the whole migration ends.
- Do not rely on the `PostToolUse`/`Skill` hook for this workflow. It fires against the `Skill` tool call, which for an inline-loading skill returns as soon as the instructions load, and no capture pass has ever been recorded for `codeceptjs-migration` despite completed migrations. The per-phase hook above is what covers this skill.
- Record the `migration-start` commit SHA (the "mark row in-progress" commit, see `branch-workflow.md`) in the handoff so it survives a resumed session — it is what defines this migration's cherry-pick range at publish time.

## 1. Select and prepare

On the control branch, first check whether another tracker row is already `in-progress`; stop and report the conflict if so. Only once clear, merge `origin/main` into control — merging before this check risks mixing an unrelated merge commit into an already-active migration's history.

Before selecting a row, check the tracker for drift against the filesystem: list `codeceptjs-e2e/tests/**/*_test.js` and diff it against the tracker's `Source` column. Any file with no matching row is untracked drift - append it as a new `pending` row (Bucket/Env/Setup left blank pending confirmation from its `Before`/`BeforeSuite`/`Data(...)` hooks, Notes noting it was added by drift check) in its own tracker-only commit before proceeding. In test-run mode, report the drift without editing the tracker. Do not silently skip untracked files.

The drift-check extraction must use the Grep tool or an ERE pattern. `grep -P` is not reliably available in this environment and a failed `-P` call still exits with an empty result that reads as a valid "no drift" answer.

Check practices freshness: read `@playwright/test` from `e2e_tests/package.json` and compare it with `verifiedAgainst` in `playwright-practices.md`. If they differ, stop and refresh that file against the Playwright release notes before migrating; a stale practices file silently authorizes outdated idiom for every later row.

Select the first `pending` tracker row that is not in B13. Always skip B13 rows. Refresh and commit both `e2e_tests/graphify-out/` and `codeceptjs-e2e/graphify-out/`, then change the selected row to `in-progress` in a separate tracker-only commit. Follow `branch-workflow.md` for the exact preflight commands. Record that commit's SHA as `migration-start`.

Do not begin migration work until the control merge and both graph refreshes are complete. All migration work happens directly on control from here — no branch is created until publish (step 7).

Create this migration's timeline file (`mkdir -p .claude/migration-observations` first; the directory is gitignored and may not exist) and record the selection, the confirmed bucket, and `migration-start`.

## Test-run mode

The parent may explicitly designate a run as test-only (dry run). In that mode, use the existing graphs read-only and skip only:

- the tracker `pending` -> `in-progress` -> `done` status writes and Notes updates;
- the control-branch graph refreshes and commits; and
- Stage 7 (Publish): source retirement, cherry-pick, commit, push, and PR.

All other steps, including provisioning, review, `READY_TO_RUN`, execution, and `FINAL_REVIEW_PASS`, still apply unchanged. Test-run mode never skips a gate; it only skips tracker, graph-refresh, and publication side effects.

## 2a. Start provisioning in the background

This runs before step 2 and overlaps it. Provisioning is the long pole and the environment bucket
is already known: the tracker row proposes it and step 1 confirms it against the source's
`Before`/`BeforeSuite` hooks and `Data(...)`. Waiting for the writer first wastes that time.

The parent, not the writer, owns the confirmation. Before starting anything, ensure Node.js 22.18
or newer and Docker are available, then inspect the fixed local resources the provisioner uses:
`pmm-server`, `client_container`, `pmm-data`, the `pmm-qa` network, and engine-labeled containers
and volumes. Treat every matching resource as foreign unless this migration created it earlier in
the same run; stop instead of adopting, replacing, or tearing down another environment. This
inspection happens before the background start, never after it.

Then start `provisioning/setup.ts` in the background with the confirmed setup and launch the
writer immediately. Record the exact provisioning command and the start time in the handoff and on
the timeline. From this moment the teardown obligation is live: any terminal path runs
`node provisioning/setup.ts --teardown`.

If the writer's derived `setupServices`/`setupClient` contradicts the confirmed bucket, tear down,
re-provision with the corrected setup, and record the mismatch on the timeline. That record is the
evidence that decides whether this overlap keeps paying for itself.

## 2. Discover and migrate

The writer:

1. reads the source test;
2. queries the existing source graph with `graphify query`/`graphify path`/`graphify explain`, or a targeted filter as described in `.claude/skills/graphify/references/query.md` (no graph generation and never loading the full `graph.json`); CodeceptJS fixture injection (`async ({ I, somePage }) => ...`) is not a static import, so graphify's AST pass will not have an edge for it — always also check the scenario's injected parameter names directly against `codeceptjs-e2e/tests/**/pages/*.js` regardless of what the graph shows;
3. opens and verifies the actual linked source files;
4. queries the refreshed `e2e_tests/graphify-out/graph.json` to find reusable Playwright files (no graph generation);
5. opens and verifies the actual target candidates;
6. derives environment setup from source behavior;
7. migrates the test to native Playwright; and
8. runs static validation.

Writer output: `MIGRATION_READY`, `BLOCKED`, or `STATIC_FAILED`.

## 3. Wait for the environment and verify it

After `MIGRATION_READY`, wait for the step 2a background provision to finish. Do not start a
second one.

The provisioning command runs from control's worktree and accepts the tracker's existing
`--database` grammar. Omit tracker-only `-h`/`--help` no-op values. Examples:

```bash
node provisioning/setup.ts
node provisioning/setup.ts --database ps=8.4 --database psmdb
node provisioning/setup.ts --db client
node provisioning/setup.ts --database ps=8.4 --db client
```

Use no database arguments for server-only setup. Append `--db client` whenever the confirmed setup includes `setupClient: true`, including alongside database arguments; it represents a distinct standalone node.

`PMM_DEBUG=1` is a provisioner default, matching every other PMM test environment in this
repository, so source tests that assert on log volume work without extra flags. Override it only
when a test needs quieter logs: `--server-env PMM_DEBUG=0`.

Then verify the prepared environment:

```bash
PMM_UI_URL="${PMM_UI_URL:-https://127.0.0.1/}" \
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}" \
bash .claude/scripts/run-migration-single-test.sh \
  '<target-test-file>' \
  --prepare-only
```

After this step, all later review and execution commands must reuse the same `PMM_UI_URL` and `ADMIN_PASSWORD`. If the environment becomes unreachable, keep the tracker `in-progress`, record the blocker and `provisioning-artifacts/` path in Notes, and stop instead of recreating it.

## 4. Initial review and MCP verification

The reviewer independently:

1. queries the existing source and refreshed target graphs to derive dependency lists (no graph generation);
2. compares all source behavior with the migrated implementation;
3. confirms nothing is missing or weakened;
4. verifies every new or changed locator through MCP against the prepared PMM environment;
5. fixes locator definitions only when live DOM evidence proves the correction; and
6. reruns static validation after locator changes.

Reviewer output: `READY_TO_RUN`, `REVIEW_FAILED`, or `LOCATOR_FIX_REQUIRED`.

Non-locator findings return to the writer. Any changed code must be reviewed again.

## 5. Execute

The runner executes the migrated scenarios or existing coverage against the prepared local environment, reusing the same `PMM_UI_URL`/`ADMIN_PASSWORD` for every proof and regression command.

- For a new target file containing only migrated scenarios, run the complete file once.
- For an appended existing target file, first run only the migrated scenarios, then run the complete target file.
- For `targetMode: already-covered`, skip the new-scenario proof run and run the existing target file or matched existing test titles as regression evidence.

Failure routing:

- locator failure -> reviewer;
- migration logic failure -> writer;
- environment or product failure -> keep `in-progress` and record the reason.

Any code change requires the relevant review again before rerunning. Do not clean or recreate the environment after a failure.

## 6. Final review

After required tests pass, the reviewer performs a final complete review of the final code and execution evidence.

Reviewer output: `FINAL_REVIEW_PASS` or `FINAL_REVIEW_FAILED`.

## 7. Publish

Only after `FINAL_REVIEW_PASS`, the runner:

1. retires the selected CodeceptJS source according to repository discovery rules, committed directly on control;
2. updates workflow coverage per `branch-workflow.md`, committed directly on control;
3. adds an isolated `git worktree` for the publish branch, built from `origin/main`;
4. in that worktree, checks every file touched in `migration-start..<control-branch>` against `origin/main` for cross-migration dependencies, then cherry-picks `migration-start..<control-branch>` onto the publish branch;
5. purifies (confirms no `tracker.md`, `parallelization-ledger.md`, `graphify-out/`, or `.claude/migration-observations/` paths landed) and revalidates (lint/typecheck/build/test) the freshly cherry-picked worktree, every time, not only when a conflict occurred;
6. pushes the publish branch, opens a PR targeting `main`, and attaches the E2E tests Matrix Actions run URL per `branch-workflow.md`; and
7. returns to control's own checkout (never switched away — only the isolated publish worktree used a different branch), updates the tracker row to `done` with the PR link and pre-migration graph-refresh result, then commits and pushes only the tracker change.

Do not merge the publish branch into control. A later merge of `main` into control receives the migration after its PR merges.

For this workflow, `done` means the PR was opened successfully.

## 8. Cleanup

Run `node provisioning/setup.ts --teardown` on every terminal path after provisioning begins: success, provisioning failure, test failure, review failure, publication failure, or blocker. This removes the migration's provisioned containers, volumes, and network. Also remove the publish worktree (`git worktree remove ../pmm-qa-publish`) once the PR is opened.

## Phase timeline

One file per migration at `.claude/migration-observations/<row>-<slug>.md`, appended to and never
rewritten. It is local evidence, gitignored, and excluded from the publish PR. Prune to the last
ten migrations.

It exists because a subagent's internals are invisible to the parent, which receives only a final
YAML block. Without it, `skill-gardener` has nothing to audit for the writer, reviewer, and runner
phases, and no basis for judging whether a step can be overlapped.

```markdown
# <row> <source> -> <target>

| phase | started | ended | gate | loop | retries | notes |
| --- | --- | --- | --- | --- | --- | --- |
| provision | 14:02 | 14:41 | ready | 1 | 1 | first attempt failed, stale container from a prior run |
| writer | 14:02 | 14:31 | MIGRATION_READY | 1 | 0 | 3 static-validation reruns |

- provision: blocked on image pull for 11m.
- writer: blocked on nothing; 3 reruns were self-inflicted, lint fixed one line at a time.
```

Times come from `date -Is`, truncated to `HH:MM`. Each phase adds one row plus one short line
saying what cost time and what it was blocked on; a phase cannot be judged parallelizable without
that. Record no raw command transcript, no secrets, and no environment credentials.

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
-> final review
-> retire source, directly on control
-> update workflow coverage, directly on control
-> cut isolated worktree + publish branch from origin/main
-> cherry-pick migration-start..control onto publish branch
-> purify + revalidate
-> PR opened
-> done
-> tear down the local PMM environment and the publish worktree
```

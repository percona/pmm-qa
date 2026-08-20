# Simple Migration Workflow

Run exactly one migration at a time. One selected migration owns one local Docker PMM environment from review provisioning until PR creation. Do not clean or recreate that environment inside the workflow.

All working-phase steps (writer, provisioning, review, execution, final review, source retirement, workflow-coverage edits) happen directly on the control branch's own worktree — no separate migration branch exists until publish time. Step 7 (Publish) touches a second ref via an isolated `git worktree`; control's own checkout is never switched away from, through the entire workflow.

Use WSL/Git Bash for `.claude/scripts/*.sh`; keep shell scripts LF-only and run `bash -n .claude/scripts/*.sh` after editing them.

## Parent orchestration

The parent agent coordinates writer, reviewer, and runner subagents. To avoid idle time:

- Launch each subagent and **wait on its task completion notification** (or poll its transcript every 10-15s). Do **not** use long `Await` sleeps with regex patterns on terminal output.
- Enforce gates strictly: no execution before `READY_TO_RUN`, no publish before `FINAL_REVIEW_PASS`, no tracker `done` before a PR exists.
- Overlap only where gates allow: static review can start while PMM provisions; MCP locator checks begin after readyz passes.
- Reuse one local PMM environment per migration; never recreate it mid-workflow.
- Never edit `e2e_tests/.env` during migration. Use `PMM_UI_URL=https://127.0.0.1/` and `ADMIN_PASSWORD=admin` unless the local provisioning command selected different values, and pass the same pair to every review and execution command.
- For MCP locator fallback, run `node .claude/scripts/verify-migration-locator.mjs help-export-logs` against the prepared environment.
- Once step 3's provisioning command starts, if the workflow stops before the runner is invoked (including a provisioning failure or an exhausted writer/reviewer loop), the parent runs `node provisioning/setup.ts --teardown` before stopping. The runner owns cleanup for every path it reaches in step 8.
- After each subagent phase (writer, provisioning, reviewer, runner) completes, invoke the `skill-gardener` skill in Capture mode against that step's observable actions before moving to the next phase. This is in addition to, not a replacement for, the automated post-skill review pass that fires once the whole `codeceptjs-migration` skill call ends.
- Record the `migration-start` commit SHA (the "mark row in-progress" commit, see `branch-workflow.md`) in the handoff so it survives a resumed session — it is what defines this migration's cherry-pick range at publish time.

## 1. Select and prepare

On the control branch, first check whether another tracker row is already `in-progress`; stop and report the conflict if so. Only once clear, merge `origin/main` into control — merging before this check risks mixing an unrelated merge commit into an already-active migration's history.

Before selecting a row, check the tracker for drift against the filesystem: list `codeceptjs-e2e/tests/**/*_test.js` and diff it against the tracker's `Source` column. Any file with no matching row is untracked drift - append it as a new `pending` row (Bucket/Env/Setup left blank pending confirmation from its `Before`/`BeforeSuite`/`Data(...)` hooks, Notes noting it was added by drift check) in its own tracker-only commit before proceeding. In test-run mode, report the drift without editing the tracker. Do not silently skip untracked files.

Select the first `pending` tracker row that is not in B13. Always skip B13 rows. Refresh and commit both `e2e_tests/graphify-out/` and `codeceptjs-e2e/graphify-out/`, then change the selected row to `in-progress` in a separate tracker-only commit. Follow `branch-workflow.md` for the exact preflight commands. Record that commit's SHA as `migration-start`.

Do not begin migration work until the control merge and both graph refreshes are complete. All migration work happens directly on control from here — no branch is created until publish (step 7).

## Test-run mode

The parent may explicitly designate a run as test-only (dry run). In that mode, use the existing graphs read-only and skip only:

- the tracker `pending` -> `in-progress` -> `done` status writes and Notes updates;
- the control-branch graph refreshes and commits; and
- Stage 7 (Publish): source retirement, cherry-pick, commit, push, and PR.

All other steps, including provisioning, review, `READY_TO_RUN`, execution, and `FINAL_REVIEW_PASS`, still apply unchanged. Test-run mode never skips a gate; it only skips tracker, graph-refresh, and publication side effects.

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

## 3. Provision once locally for review

After `MIGRATION_READY`, ensure Node.js 22.18 or newer and Docker are available. The provisioner uses fixed local resources, including `pmm-server`, `client_container`, `pmm-data`, the `pmm-qa` network, and engine-labeled containers and volumes. Inspect them before provisioning. Treat every matching resource as foreign unless this migration created it earlier in the same run; stop instead of adopting, replacing, or tearing down another environment.

From control's worktree, run `provisioning/setup.ts` once with the source-derived setup. It accepts the tracker's existing `--database` grammar. Omit tracker-only `-h`/`--help` no-op values. Examples:

```bash
node provisioning/setup.ts
node provisioning/setup.ts --database ps=8.4 --database psmdb
node provisioning/setup.ts --db client
node provisioning/setup.ts --database ps=8.4 --db client
```

Use no database arguments for server-only setup. Append `--db client` whenever the writer derived `setupClient: true`, including alongside database arguments; it represents a distinct standalone node. Record the exact provisioning command in the handoff.

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
5. purifies (confirms no tracker/`graphify-out/` paths landed) and revalidates (lint/typecheck/build/test) the freshly cherry-picked worktree, every time, not only when a conflict occurred;
6. pushes the publish branch, opens a PR targeting `main`, and attaches the E2E tests Matrix Actions run URL per `branch-workflow.md`; and
7. returns to control's own checkout (never switched away — only the isolated publish worktree used a different branch), updates the tracker row to `done` with the PR link and pre-migration graph-refresh result, then commits and pushes only the tracker change.

Do not merge the publish branch into control. A later merge of `main` into control receives the migration after its PR merges.

For this workflow, `done` means the PR was opened successfully.

## 8. Cleanup

Run `node provisioning/setup.ts --teardown` on every terminal path after provisioning begins: success, provisioning failure, test failure, review failure, publication failure, or blocker. This removes the migration's provisioned containers, volumes, and network. Also remove the publish worktree (`git worktree remove ../pmm-qa-publish`) once the PR is opened.

## Canonical sequence

```text
pending
-> check no other row is in-progress
-> merge main into control
-> refresh target graph on control
-> refresh source graph on control
-> in-progress (this commit = migration-start)
-> refreshed graph discovery (read-only)
-> migration, directly on control
-> provision once
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

# Simple Migration Workflow

Run exactly one migration at a time. One selected migration owns one PMM environment from review provisioning until PR creation. Do not clean or recreate that environment inside the workflow.

Use WSL/Git Bash for `.cursor/scripts/*.sh`; keep shell scripts LF-only and run `bash -n .cursor/scripts/*.sh` after editing them.

## Parent orchestration

The parent agent coordinates writer, reviewer, and runner subagents. To avoid idle time:

- Launch each subagent and **wait on its task completion notification** (or poll its transcript every 10–15s). Do **not** use long `Await` sleeps with regex patterns on terminal output.
- Enforce gates strictly: no execution before `READY_TO_RUN`, no publish before `FINAL_REVIEW_PASS`, no tracker `done` before a PR exists.
- Overlap only where gates allow: static review can start while PMM provisions; MCP locator checks begin after readyz passes.
- Reuse one PMM environment per migration (`CLEAN_ENVIRONMENT=false` after the first `--prepare-only`).
- Never edit `e2e_tests/.env` during migration; `run-migration-single-test.sh` exports `PMM_MIGRATION=1` and `PMM_UI_URL=http://127.0.0.1/`.
- For MCP locator fallback, run `node .cursor/scripts/verify-migration-locator.mjs help-export-logs` against the prepared environment.

## 1. Select

Select one `pending` tracker row and change it to `in-progress`.

If another row is already `in-progress`, stop and report the conflict.

## Test-run mode

The parent may explicitly designate a run as test-only (dry run). In that mode, skip only:

- the tracker `pending` -> `in-progress` -> `done` status writes and Notes updates;
- Stage 7 (Publish): source retirement, `graphify . --update`, commit, push, and PR.

All other steps, including provisioning, review, `READY_TO_RUN`, execution, and `FINAL_REVIEW_PASS`, still apply unchanged. Test-run mode never skips a gate; it only skips the tracker/publish side effects.

## 2. Discover and migrate

The writer:

1. reads the source test;
2. queries the existing `codeceptjs-e2e/graphify-out/graph.json` to find linked source files (no graph generation);
3. opens and verifies the actual linked source files;
4. queries the existing `e2e_tests/graphify-out/graph.json` to find reusable Playwright files (no graph generation);
5. opens and verifies the actual target candidates;
6. derives environment setup from source behavior;
7. migrates the test to native Playwright; and
8. runs static validation.

Writer output: `MIGRATION_READY`, `BLOCKED`, or `STATIC_FAILED`.

## 3. Provision once for review

After `MIGRATION_READY`, provision the migration environment once:

```bash
./.cursor/scripts/run-migration-single-test.sh \
  '<target-test-file>' \
  '<setup-services>' \
  <setup-client> \
  --prepare-only
```

This starts Docker, PMM Server, optional standalone PMM Client, and optional `pmm-framework.py` services, then exits before Playwright execution.

After this step, all later commands in this migration must reuse the same environment with `CLEAN_ENVIRONMENT=false`. If reuse cannot reach PMM, keep the tracker `in-progress`, record the blocker in Notes, and stop instead of recreating the environment.

## 4. Initial review and MCP verification

The reviewer independently:

1. queries the existing source and target graphs to derive dependency lists (no graph generation);
2. compares all source behavior with the migrated implementation;
3. confirms nothing is missing or weakened;
4. verifies every new or changed locator through MCP against the prepared PMM environment;
5. fixes locator definitions only when live DOM evidence proves the correction; and
6. reruns static validation after locator changes.

Reviewer output: `READY_TO_RUN`, `REVIEW_FAILED`, or `LOCATOR_FIX_REQUIRED`.

Non-locator findings return to the writer. Any changed code must be reviewed again.

## 5. Execute

The runner executes the migrated scenarios or existing coverage against the prepared environment. Use `CLEAN_ENVIRONMENT=false` for every proof and regression command.

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

1. retires the selected CodeceptJS source according to repository discovery rules;
2. updates workflow coverage per `branch-workflow.md`;
3. checks that only migration-related code, source-retirement, and workflow files are included;
4. commits and pushes the migration branch;
5. opens a PR targeting `main`;
6. merges the frozen migration branch into control;
7. runs `graphify . --update` from `e2e_tests/` on control, then deletes generated graph files except `graph.json` and `manifest.json`; and
8. updates the tracker row to `done` with the PR link, then commits and pushes the tracker and target graph artifacts on control.

For this workflow, `done` means the PR was opened successfully.

## Canonical sequence

```text
pending
-> in-progress
-> existing graph discovery (read-only)
-> migration
-> provision once
-> initial review
-> MCP locator verification
-> test execution or already-covered regression with CLEAN_ENVIRONMENT=false
-> final review
-> retire source
-> update workflow coverage
-> e2e_tests graphify --update
-> PR opened
-> done
```

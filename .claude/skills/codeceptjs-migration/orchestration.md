# Migration Orchestration (parent only)

The parent's half of the workflow: row selection, preflight, provisioning, gate ownership, and the phase timeline. Workers read `run.md`, not this file.

Run exactly one row at a time. The row owns one local Docker PMM environment from the moment provisioning starts until PR creation; never clean or recreate it inside the workflow. Migration work happens uncommitted in control's worktree (`branch-workflow.md` What is committed where); control's checkout is never switched away from, publication uses an isolated `git worktree`. Run `.claude/scripts/*.sh` under Git Bash or WSL, keep them LF-only, and `bash -n` them after editing.

## Parent rules

**Subagents**

- Launch each subagent and wait on its completion notification; no long sleeps polling terminal output.
- Only the parent spawns review gates. A worker that spawns a subagent and waits on it deadlocks: the runner returns its evidence and stops, the parent spawns the reviewer.
- Operations the permission classifier refuses inside a subagent (environment teardown, test-state resets such as emptying the Grafana annotation table) are the parent's. The subagent stops and asks; the parent performs it and resumes the subagent. The parent is refused too for some of them: in row 12 `DELETE /v1/inventory/nodes/<id>?force=true` and `pmm-admin config --force` were both denied in the parent session, while `node provisioning/setup.ts --teardown` ran there. Then stop and hand the user the exact command; never reword it to get past the classifier.
- Each subagent appends its row to the timeline before returning. `.claude/hooks/migration-phase-observe.sh` fires at subagent launch, not completion, so treat it as a reminder; batch `skill-gardener` capture passes to the end of the migration while any subagent is live. Do not rely on the `PostToolUse`/`Skill` hook, which fires as soon as an inline skill loads.

**Gates**

- Order is fixed and every row gets both gates: no execution before `READY_TO_RUN`, no publish branch before execution passes, no final review before code and coverage are committed on that branch, no push or PR before `FINAL_REVIEW_PASS`, no tracker `done` before a PR exists.
- Never two reviewers on the same subject at once. Confirm no gate is live before spawning one; reviewer cost is flat per spawn, so fewer spawns is the only lever.
- Nothing writes to control's worktree while an initial gate is live: no writer re-spawn, no state reset, no unrelated edit. The initial gate has no staleness detection of its own.
- `STALE_SUBJECT` (final gate only) means the publish branch moved under the reviewer. It is neither a pass nor a failure: re-spawn the same gate scoped to the delta between the ledger entry's `startRef` and the branch HEAD, and stop whatever is committing to the branch. These re-spawns do not count as attempts.
- A gate return without evidence is not a verdict. Reject a return whose `conventionScriptOutput` is missing, or whose `shape` block has empty `newNames`, `worthPortingGate`, `assertionMutationProof` or `locatorLadder` while the diff has new names, scenarios, assertions or locators; re-spawn scoped to the missing evidence. To verify a finding yourself, widen its scope (drop the path filter, count the whole repository), never re-run its command.
- Five attempts per gate, counted by the ledger's `attempt`. After a fifth non-pass: keep the row `in-progress`, run teardown, report the open blockers verbatim with the ledger path. A five-round disagreement is a rule conflict for a human.
- Pass the gate ledger path (`.claude/migration-observations/<row>-<slug>.gates.yaml`) on every gate spawn; the reviewer reads and appends it itself (`run.md` section Gate ledger). A `FINAL_REVIEW_FAILED` entry whose blockers are all `open` routes work to the writer or runner, not to a re-spawn.
- Overlap only what `parallelization-ledger.md` records as `implemented`: provisioning in the background while the writer migrates, static review while PMM provisions, MCP checks after readyz. Everything else is serial.

**Environment and control**

- Never edit `e2e_tests/.env`. Pass `PMM_UI_URL` (default `https://127.0.0.1/`) and `ADMIN_PASSWORD` (default `admin`, non-default for UI-login tests, see step 3) explicitly in every handoff and command, with `PMM_MIGRATION=1` so `.env` cannot override them.
- Locator verification uses the Playwright MCP server declared repo-level in `.mcp.json`. `node .claude/scripts/verify-migration-locator.mjs help-export-logs` is that one preset only (hardcodes `/pmm-ui/help`, `getByRole` plus optional `a[href=...]`). If MCP is unavailable, stop and report.
- If a subagent reports a commit SHA on control for migration code, have it reset the commit and leave the change in the worktree.
- Once provisioning starts, any terminal path before the runner is invoked runs `node provisioning/setup.ts --teardown` from the parent. The runner owns cleanup on every path it reaches.
- Record the tracker `in-progress` commit SHA in the handoff as the active-row marker.
- Restore control's worktree to clean after publication (`branch-workflow.md` Tracker completion and cleanup).

## 1. Select and prepare

Three preflight checks on control, before the `origin/main` merge and the `in-progress` commit. Stop and name the one that tripped:

1. another tracker row `in-progress`;
2. any migration PR open. The cap is zero open before a new row starts, because every migration PR touches the nightly matrix and `e2e_tests/README.md`:

```bash
gh pr list --repo percona/pmm-qa --state open --json number,title --jq '[.[] | select(.title | startswith("migrate("))]'
```

   Not `--search 'migrate in:title'`, which matches unrelated titles containing the word.

3. Node.js older than 22.18, Docker unavailable, or a fixed local resource already present: `pmm-server`, `pmm-data`, the `pmm-qa` network, engine-labeled containers and volumes, or `client_container` (never created by `provisioning/`; it means a foreign `qa-integration` environment). Treat any match as foreign unless this run created it; never adopt, replace or tear one down.

Then merge `origin/main` into control (`branch-workflow.md` Control branch preflight). If the merge stops with `fatal: refusing to merge unrelated histories`, the clone is shallow: confirm with `git rev-parse --is-shallow-repository`, repair with `git fetch --unshallow origin`, merge again. Never `--allow-unrelated-histories`.

`tracker.md` is tens of kilobytes; never read it whole. Select with a scoped `grep`/`head` over the status column and read only that row and the header section you need.

Check tracker drift with exactly this form (`grep -P` and `sed` backslash expressions fail silently here and read as "no drift"):

```bash
comm -23 <(find codeceptjs-e2e/tests -name '*_test.js' | sort -u) \
         <(grep -oE 'codeceptjs-e2e/tests/[A-Za-z0-9_/.-]+_test\.js' \
             .claude/skills/codeceptjs-migration/tracker.md | sort -u)   # untracked drift
comm -13 <(find codeceptjs-e2e/tests -name '*_test.js' | sort -u) \
         <(grep -oE 'codeceptjs-e2e/tests/[A-Za-z0-9_/.-]+_test\.js' \
             .claude/skills/codeceptjs-migration/tracker.md | sort -u)   # tracked but absent
```

State both counts. Append each untracked file as a `pending` row (Bucket/Env/Setup blank until confirmed from its hooks and `Data(...)`) in its own tracker-only commit; in test-run mode, report without editing.

Compare `@playwright/test` in `e2e_tests/package.json` with `verifiedAgainst` in `playwright-practices.md`; if they differ, refresh that file against the release notes before migrating.

Select the first `pending` row (the legend already excludes `blocked-infra` rows), mark it `in-progress` in a tracker-only commit (`branch-workflow.md` Starting the migration), and record the SHA. Create the timeline and gate-ledger files (`mkdir -p .claude/migration-observations`, gitignored) recording the selection, confirmed bucket and marker commit.

## Test-run mode

When the parent designates a dry run, skip only: tracker status writes, step 5b and 7 (publish branch, retirement, coverage commit, push, PR), and the open-PR preflight check. Every gate still runs. The final gate's subject is then control's worktree: `kind: worktree`, no `startRef`/`endRef`, never `STALE_SUBJECT`. Coverage is designed and its greps verified but not committed.

## 2a. Start provisioning in the background

Before launching the writer. The parent confirms the bucket: the tracker's `Setup` is a planned default that is regularly wrong, so derive the real service set from what the source's `Before`/`BeforeSuite` hooks, `Data(...)` rows and shell commands name, correct the tracker row if it differs, and cross-check against the destination Playwright job's `setup_services`, never the retiring CodeceptJS job's (a union grep over-provisions).

Start `provisioning/setup.ts` in the background with the confirmed setup, launch the writer immediately, and record the exact command and start time on the timeline. From this moment the teardown obligation is live. If the writer's `setupServices`/`setupClient` contradicts the confirmed bucket, tear down, re-provision, and record the mismatch on the timeline.

## 3. Wait for the environment and verify it

After `MIGRATION_READY`, wait for the step 2a provision; never start a second one. The command runs from control's worktree with the tracker's `--database` grammar and no `-h`/`--help` values; no database arguments means server-only:

```bash
node provisioning/setup.ts
node provisioning/setup.ts --database ps=8.4 --database psmdb
```

`--db client` does not exist; `node provisioning/setup.ts --help` is the authority. A source with `setupClient: true` (host `pmm-admin`/`pmm-agent`) needs the CI client install, Linux-only, under WSL2 or in CI, and the timeline records which:

```bash
sudo bash pmm3-client-setup.sh --pmm_server_ip 127.0.0.1 --client_version <v> --admin_password <p> --use_metrics_mode no
```

That script registers the node as `PMM_AGENT_SETUP_NODE_NAME=client_container_$((1 + $RANDOM % 9999))` (line 66) while an argument-less `pmm-admin config` registers under the machine hostname, so the two create different nodes and a conflict predicted from the script's name is wrong. The hostname node never pre-exists on a fresh runner, which is why such a test is green in CI and still fails its own second local run.

Inside `wsl -d <distro> -- bash -lc '<string>'` nothing `$`-shaped in that string can be trusted: a variable assigned and read there returns empty, `$?` returns `0` after a command that failed, and `${PIPESTATUS[0]}` returns empty, though `$(...)` does run in WSL. Capture the status outside instead (`out=$(wsl ...); rc=$?`, verified by `exit 7` giving `7`), or redirect to a log and count its markers.

A test that logs in through the UI needs a non-default admin password: with `admin`, PMM shows an "Update your password" interstitial whose URL matches neither `help` nor `home-dashboard`, so the login page objects time out. CI avoids it with `ADMIN_PASSWORD: 'admin-password'` in every runner workflow. `provisioning/setup.ts --admin-password` is not the fix (agent registrations then fail with "Invalid username or password"). Provision with the default, change it with `PUT /graph/api/user/password` `{oldPassword,newPassword,confirmNew}`, verify once with `/v1/users/me`, and hand the new value to every later phase. This is an environment precondition, not a migration defect.

`PMM_DEBUG=1` is the provisioner default; override with `--server-env PMM_DEBUG=0` only when a test needs quieter logs.

Verify:

```bash
PMM_UI_URL="${PMM_UI_URL:-https://127.0.0.1/}" ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}" bash .claude/scripts/run-migration-single-test.sh '<target-test-file>' --prepare-only   # path relative to e2e_tests/, not the repo root
```

Every later command reuses this pair. If the environment becomes unreachable, keep the row `in-progress`, record the blocker and `provisioning-artifacts/` path on the timeline, and stop.

## Phase timeline

One file per migration at `.claude/migration-observations/<row>-<slug>.md`, appended and never rewritten, gitignored, excluded from the PR, pruned to the last ten migrations:

```markdown
# <row> <source> -> <target>

| phase | started | ended | gate | loop | retries | notes |
| --- | --- | --- | --- | --- | --- | --- |
| provision | 14:02 | 14:41 | ready | 1 | 1 | first attempt failed, stale container from a prior run |
| writer | 14:02 | 14:31 | MIGRATION_READY | 1 | 0 | 3 static-validation reruns |
```

Read `date -Is` before writing a row and truncate it to `HH:MM`; an estimated time is always wrong and costs a correcting edit. The parent opens no row for a phase a worker will record, and each worker appends its own closed row: the two conventions collided in rows 11 and 12. Close an open row in place; never append a parallel one or insert mid-table. One row per phase plus one line on what cost time. No command transcripts, secrets or credentials.

## Canonical sequence

```text
pending
-> check no other row is in-progress
-> check no migration PR is open
-> merge main into control
-> in-progress (tracker-only commit; marks the active row)
-> linked-file discovery
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

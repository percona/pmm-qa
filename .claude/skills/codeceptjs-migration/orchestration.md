# Migration Orchestration (parent only)

The parent's half of the workflow: row selection, preflight, provisioning, gate ownership, and the phase timeline. Workers read `run.md`, not this file.

Run exactly one row at a time; a batch from step 1b counts as one row. The row owns one CHAOS VM from the moment provisioning starts until PR creation; never clean or recreate it inside the workflow. Migration work happens uncommitted in control's worktree (`branch-workflow.md` What is committed where); control's checkout stays on control for the whole row, publication uses an isolated `git worktree`; only after cleanup is it switched to the publish branch so the app's PR panel shows the PR (`branch-workflow.md` Tracker completion and cleanup). The skill and scripts exist only on control, so a run starts with `git switch CodeceptJS-migration` on a clean tree. Run `.claude/scripts/*.sh` with bash on the runner host, keep them LF-only, and `bash -n` them after editing.

`.claude/scripts/migration.sh` does the mechanical steps; the sections below say what each one checks and what stays judgement:

| Step | Command |
| --- | --- |
| 1 preflight checks 1-3 (plus no unpushed commits on control), `origin/main` merge, drift counts, Playwright version, next `pending` row | `migration.sh preflight` |
| 1 the row's Setup, from step 2a | `migration.sh set-setup <row> '<--database ...>'` |
| 1 `in-progress` marker | `migration.sh mark <row> in-progress` |
| 2a the VM's `--database` list from the CI job each source scenario's tags select (no job printed means a retag is needed) | `migration.sh setup [--args] <source>` |
| 3 credentials, services and QAN rows per service the source names | `migration.sh env-check <service-prefix>...` |
| 5b publish worktree, move the work, `npm ci` | `migration.sh publish-branch <branch>` |
| 5b and 6 selectability of every workflow expression, base vs branch, and nightly shard counts | `migration.sh selection [extra-grep]...` |
| 7 revalidation, and whether the tested copy is unchanged | `migration.sh revalidate <file>...` |
| 7 push, PR, runner dispatch, `Run:` line | `migration.sh publish <title> <body> <flag> <setup>` |
| 7 tracker `done`: PR, Opened date and dashboard data in one commit | `migration.sh mark <row> done <pr-url>` |
| 1 Merged dates for rows whose source left `origin/main` (preflight runs it) | `migration.sh merged` |
| any: rebuild the gh-pages Migration tab's data, uncommitted | `migration.sh dashboard` |

## Parent rules

**Subagents**

- Launch each subagent and wait on its completion notification; no long sleeps polling terminal output.
- A subagent with no transcript progress for 10 minutes is likely parked on a permission prompt: in row 37 a read-only `git rev-parse` sat 60 minutes on one. Unattended, stop the row and report the command instead of waiting.
- Only the parent spawns review gates. A worker that spawns a subagent and waits on it deadlocks: the runner returns its evidence and stops, the parent spawns the reviewer.
- Operations the permission classifier refuses inside a subagent (environment teardown, test-state resets such as emptying the Grafana annotation table) are the parent's. The subagent stops and asks; the parent performs it and resumes the subagent. The parent is refused too for some of them: in row 12 `DELETE /v1/inventory/nodes/<id>?force=true` and `pmm-admin config --force` were both denied in the parent session, while `chaos-pmm.sh down` runs there. Then stop and hand the user the exact command; never reword it to get past the classifier.
- Unattended, the parent runs step 7's `migration.sh publish` itself after `FINAL_REVIEW_PASS`; the runner returns once the publish branch is committed. Never re-run a command a subagent was refused: stop and report it.
- Link every migration PR to the session. Attended, call `mcp__ccd_pr__bind_pr` (load it through `ToolSearch`); a scheduled session refuses it, and the cleanup switch to the publish branch links it instead. The report puts the PR URL first either way.
- Each subagent appends its row to the timeline before returning. `.claude/hooks/migration-phase-observe.sh` fires at subagent launch, not completion, so treat it as a reminder; batch `skill-gardener` capture passes to the end of the migration while any subagent is live. Do not rely on the `PostToolUse`/`Skill` hook, which fires as soon as an inline skill loads.

**Gates**

- Order is fixed and every row gets both gates: no execution before `READY_TO_RUN`, no publish branch before execution passes, no final review before code and coverage are committed on that branch, no push or PR before `FINAL_REVIEW_PASS`, no tracker `done` before a PR exists.
- Never two reviewers on the same subject at once. Confirm no gate is live before spawning one; reviewer cost is flat per spawn, so fewer spawns is the only lever.
- Nothing writes to control's worktree while an initial gate is live: no writer re-spawn, no state reset, no unrelated edit. The initial gate has no staleness detection of its own.
- `STALE_SUBJECT` (final gate only) means the publish branch moved under the reviewer. It is neither a pass nor a failure: re-spawn the same gate scoped to the delta between the ledger entry's `startRef` and the branch HEAD, and stop whatever is committing to the branch. These re-spawns do not count as attempts.
- A gate return without evidence is not a verdict. Reject a return whose `conventionScriptOutput` is missing, or whose `shape` block has empty `newNames`, `worthPortingGate`, `assertionMutationProof` or `locatorLadder` while the diff has new names, scenarios, assertions or locators; re-spawn scoped to the missing evidence. To verify a finding yourself, widen its scope (drop the path filter, count the whole repository), never re-run its command.
- A repeat attempt of the same gate goes to the reviewer that returned the previous one, through `SendMessage` with the open ids and the delta, so it does not re-read the skill. Spawn a fresh reviewer only when that one is unreachable, and always for the final gate after an initial one. The ledger stays the record either way.
- The final gate reuses the initial gate's MCP locator verification and mutation proof for every file `cmp` shows byte-identical to what the initial gate checked on the same environment; it re-runs MCP only for locators added or changed since. Pass that `cmp` result in the spawn.
- Five attempts per gate, counted by the ledger's `attempt`. After a fifth non-pass: keep the row `in-progress`, run teardown, report the open blockers verbatim with the ledger path. A five-round disagreement is a rule conflict for a human.
- Pass the gate ledger path (`.migration-observations/<row>-<slug>.gates.yaml`) on every gate spawn; the reviewer reads and appends it itself (`run.md` section Gate ledger). A `FINAL_REVIEW_FAILED` entry whose blockers are all `open` routes work to the writer or runner, not to a re-spawn.
- Overlap only what `migration/parallelization-ledger.md` records as `implemented`: provisioning in the background while the writer migrates, static review while PMM provisions, MCP checks after readyz. Everything else is serial.

**Environment and control**

- A run writes nothing under `.claude/` (skills, agents, scripts, hooks), for any reason: Claude Code asks for approval on every such write, even in auto mode, and an unanswered prompt parks the unattended session until it is released. A gate that trips, a `STOP:` from `migration.sh`, a script that looks wrong or a rule that seems to block the row is the run's result: send a `PushNotification` naming it, with the change you would propose, and end the run; the skill and its scripts change in attended sessions only. Run state lives in `migration/` (tracker, parallelization ledger) and `.migration-observations/`; tracker cells change only through `migration.sh set-setup`, `mark` and `merged`.
- Never edit `e2e_tests/.env`. Pass the run id, `PMM_UI_URL` and `ADMIN_PASSWORD` (the VM's URL and per-run password, from `chaos-pmm.sh env <run_id>`, see step 3) explicitly in every handoff and command, with `PMM_MIGRATION=1` so `.env` cannot override them. `chaos-pmm.sh test` gives the run on the VM its own on-box pair.
- Locator verification uses the Playwright MCP server declared repo-level in `.mcp.json`. `node .claude/scripts/verify-migration-locator.mjs help-export-logs` is that one preset only (hardcodes `/pmm-ui/help`, `getByRole` plus optional `a[href=...]`). If MCP is unavailable, stop and report.
- If a subagent reports a commit SHA on control for migration code, have it reset the commit and leave the change in the worktree.
- Once provisioning starts, any terminal path before the runner is invoked runs `bash .claude/scripts/chaos-pmm.sh down <run_id>` from the parent and closes the Playwright MCP browser (`mcp__playwright__browser_close`). The runner owns cleanup on every path it reaches.
- Record the tracker `in-progress` commit SHA in the handoff as the active-row marker.
- Restore control's worktree to clean after publication (`branch-workflow.md` Tracker completion and cleanup).

## 1. Select and prepare

Four preflight checks on control, before the `origin/main` merge and the `in-progress` commit. Stop and name the one that tripped:

1. another tracker row `in-progress`;
2. any migration PR open. The cap is zero open before a new row starts, because every migration PR touches the nightly matrix and `e2e_tests/README.md`:

```bash
gh pr list --repo percona/pmm-qa --state open --json number,title --jq '[.[] | select(.title | startswith("migrate("))]'
```

   Not `--search 'migrate in:title'`, which matches unrelated titles containing the word. Also run `ListAgents`: another session sharing this worktree will stage or revert files under you, so agree paths with it or stop.

3. Node.js older than 22.18 on the runner host, or `CHAOS_TOKEN` unset (the session is not on a CHAOS runner; never fall back to Docker on the host). `chaos-vm.sh list` shows every pmm-qa VM: one this run did not create is foreign; never adopt, reuse or tear one down.

4. the selected row's source has an active scenario without a `PMM-T` id and no `zephyr_*` tool loads through `ToolSearch` (`select:mcp__plugin_pmm-qa_zephyr-bot__zephyr_create_test_case`). With the tool loaded, the writer looks up the matching case or creates one (`SKILL.md` Title, tags, ids) and the new key goes into the title; without it, ask the user, or unattended skip to the next pending row whose scenarios all carry ids and report the skipped row.

Then merge `origin/main` into control (`branch-workflow.md` Control branch preflight). If the merge stops with `fatal: refusing to merge unrelated histories`, the clone is shallow: confirm with `git rev-parse --is-shallow-repository`, repair with `git fetch --unshallow origin`, merge again. Never `--allow-unrelated-histories`.

`migration/tracker.md` is tens of kilobytes; never read it whole. Select with a scoped `grep`/`head` over the status column and read only that row and the header section you need.

Check tracker drift with exactly this form (`grep -P` and `sed` backslash expressions fail silently here and read as "no drift"):

```bash
comm -23 <(find codeceptjs-e2e/tests -name '*_test.js' | sort -u) \
         <(grep -oE 'codeceptjs-e2e/tests/[A-Za-z0-9_/.-]+_test\.js' \
             migration/tracker.md | sort -u)   # untracked drift
comm -13 <(find codeceptjs-e2e/tests -name '*_test.js' | sort -u) \
         <(grep -oE 'codeceptjs-e2e/tests/[A-Za-z0-9_/.-]+_test\.js' \
             migration/tracker.md | sort -u)   # tracked but absent
```

State both counts. Append each untracked file as a `pending` row (Bucket/Env/Setup blank until confirmed from its hooks and `Data(...)`) in its own tracker-only commit; in test-run mode, report without editing.

Compare `@playwright/test` in `e2e_tests/package.json` with `verifiedAgainst` in `playwright-practices.md`; if they differ, an attended session refreshes that file against the release notes before migrating; an unattended run reports the drift and ends.

Select the first `pending` row (the legend already excludes `blocked-infra` rows), mark it `in-progress` in a tracker-only commit (`branch-workflow.md` Starting the migration), and record the SHA. Create the timeline and gate-ledger files (`mkdir -p .migration-observations`, gitignored) recording the selection, confirmed bucket and marker commit.

## 1b. Batch small rows

Before the `in-progress` commit, estimate the row's diff: test lines plus new POM, API and helper lines, source retirement excluded. Under 200 lines, add the next `pending` row whose confirmed setup provisions the same environment, and keep adding while the batch estimate stays under 200. Skip a candidate with a different setup; never re-provision mid-batch.

A batch runs as one row:

- one tracker commit marks every row `in-progress`; one timeline and one gate ledger, named after the first row;
- one writer spawn migrates every row, and each gate (initial review, runner, final review) is one spawn covering the whole batch;
- every row's tests still run and pass, and every row still gets its own worth-porting and coverage evidence;
- one publish branch `migrate-<category>-<first-test-name>`, one PR listing every source, every row marked `done` with that PR's URL.

Once the writer returns, measure the real size (`git diff --numstat` plus untracked new files) and record estimate and actual on the timeline. An actual over 200 does not split the batch.

## Test-run mode

When the parent designates a dry run, skip only: tracker status writes, step 5b and 7 (publish branch, retirement, coverage commit, push, PR), and the open-PR preflight check. Every gate still runs. The final gate's subject is then control's worktree: `kind: worktree`, no `startRef`/`endRef`, never `STALE_SUBJECT`. Coverage is designed and its greps verified but not committed.

## 2a. Start provisioning in the background

Before launching the writer, take the setup from CI, not from the tracker's `Setup` (a planned default that is regularly wrong): `bash .claude/scripts/migration.sh setup <source>` matches each scenario's tags to the Playwright job that selects it (else the CodeceptJS job that runs it today), takes one job per scenario, copies that job's `setup_services` whole, and on the shared nightly server takes one shard argument per service the scenario names. Read its per-scenario lines, then add by hand only a database for a scenario it marks `NO job selects it` and one an existing target file you will modify needs (the services it filters on, `docker exec`s into or registers). Run it before step 1's `in-progress` commit and write the final list into the row's `Setup` with `migration.sh set-setup`.

Name the run `mig-<row>-$(date +%m%d%H%M)` (a batch takes its first row). Start `bash .claude/scripts/chaos-pmm.sh up <run_id> $(bash .claude/scripts/migration.sh setup --args <source>) <hand-added args>` with `run_in_background`: VM creation, cloud-init, Node and the server image took 16 minutes on the first measured run, databases extra. A failed `up` is retried once under a new run id, after `chaos-pmm.sh down` on the failed one. Then launch the writer immediately, and record the run id, exact command and start time on the timeline. From this moment the teardown obligation is live. If the writer's `setupServices`/`setupClient` contradicts the confirmed bucket, tear down, re-provision, and record the mismatch on the timeline.

## 3. Wait for the environment and verify it

After `MIGRATION_READY`, wait for the step 2a provision; never start a second one. The command runs from control's worktree with the tracker's `--database` grammar; no database arguments means server-only:

```bash
bash .claude/scripts/chaos-pmm.sh up <run_id>
bash .claude/scripts/chaos-pmm.sh up <run_id> --database ps=8.4 --database psmdb
```

`pmm-framework --help` and `--list-databases` are the authority for arguments (`chaos-pmm.sh ssh <run_id> /root/pmm-qa/qa-integration/pmm_qa/pmm-framework/pmm-framework --help`). The VM pulls the prebaked database images from GHCR, as CI does. A Nomad test needs `PMM_ENABLE_NOMAD=1` in the environment and `--nomad` in the arguments. A source with `setupClient: true` (host `pmm-admin`/`pmm-agent`) needs the CI client install on the VM:

```bash
bash .claude/scripts/chaos-pmm.sh ssh <run_id> 'cd /root/pmm-qa/qa-integration/pmm_qa && bash pmm3-client-setup.sh --pmm_server_ip 127.0.0.1 --client_version <v> --admin_password "$(cat /root/admin_password)" --use_metrics_mode no'
```

That script registers the node as `PMM_AGENT_SETUP_NODE_NAME=client_container_$((1 + $RANDOM % 9999))` (line 66) while an argument-less `pmm-admin config` registers under the machine hostname, so the two create different nodes and a conflict predicted from the script's name is wrong. The hostname node never pre-exists on a fresh runner, which is why such a test is green in CI and still fails its own second run on the same VM.

A test that logs in through the UI needs a non-default admin password: with `admin`, PMM shows an "Update your password" interstitial and the login page objects time out. `chaos-pmm.sh up` sets a random per-run password (kept on the VM at `/root/admin_password`) and passes it to pmm-framework. `eval "$(bash .claude/scripts/chaos-pmm.sh env <run_id>)"` exports it with the VM's `PMM_UI_URL` on the runner host; verify once with `/v1/users/me` and hand the same pair to every later phase.

Verify:

```bash
bash .claude/scripts/chaos-pmm.sh test <run_id> '<target-test-file>' --prepare-only   # path relative to e2e_tests/, not the repo root
```

`--prepare-only` proves only the server. Then prove the agents and data: in every provisioned container (`chaos-pmm.sh ssh <run_id> docker exec <container> pmm-admin status`) `pmm-admin status` shows `Connected : true` and `pmm-admin list` shows every agent `Running`. For a QAN row, poll `POST /v1/qan/metrics:getReport` (`group_by: queryid`, the test's time range) until `total_rows` exceeds the source's largest item-count branch, and record the count on the timeline. A poll whose own command fails stops with that error; it never reads as "no data yet".

When the writer returns `targetMode: appended` on a file whose other tests need databases not yet provisioned (the services they filter on or `docker exec` into), add them to the running VM with `chaos-pmm.sh up <run_id> --database ...` before spawning the runner: the runner's whole-file run needs them, and pmm-framework picks free host ports, so a second PS topology joins cleanly. The tracker `Setup` and the CI dispatch carry the union.

Every later command reuses this pair. If the environment becomes unreachable, keep the row `in-progress`, record the blocker and the framework log directory it printed on the timeline, and stop.

## Phase timeline

One file per migration at `.migration-observations/<row>-<slug>.md` (outside `.claude/`, whose writes stop an unattended run for approval even in auto mode), appended and never rewritten, gitignored, excluded from the PR, pruned to the last ten migrations:

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
-> estimate the diff; under 200 lines, batch the next same-setup pending rows
-> in-progress (tracker-only commit; marks the active row)
-> linked-file discovery
-> check CHAOS access, then start the CHAOS VM in the background
   |
   +-- concurrently: migration, directly on control
   |
-> wait for the provisioned environment, verify with --prepare-only
-> initial review
-> MCP locator verification
-> test execution or already-covered regression on the same CHAOS VM
   (everything so far is UNCOMMITTED in control's worktree)
-> cut isolated worktree + publish branch from origin/main
-> move the migrated code across, commit it there
-> retire source + commit workflow coverage, there
-> final review, over the publish branch
-> revalidate in that worktree
-> push, PR opened
-> tracker done on control, restore control's worktree clean
-> tear down the CHAOS VM, the Playwright MCP browser and the publish worktree
```

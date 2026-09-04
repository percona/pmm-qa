# Branch and PR Workflow

Migration work **happens and is tested** on the control branch's worktree, and is **never committed there**. Control commits only what is genuinely control-only: the `origin/main` merge, both graph refreshes, the two tracker status changes, and branch-local gardener lesson entries. The migrated code is moved to a fresh branch cut from `origin/main`, committed there, reviewed there, and PR'd against `main`. Control receives it later through an ordinary `merge origin/main`.

Committing the code on control as well would author the same content twice and then take delivery of it a third time on the next merge from `main`. That is what produced cross-branch conflicts and what made a scrubbing step necessary; neither exists in this model.

## What is committed where

| Content | Branch |
| --- | --- |
| `origin/main` merge, `e2e_tests/graphify-out/`, `codeceptjs-e2e/graphify-out/` | control |
| tracker row `in-progress`, tracker row `done` | control |
| `.claude/skill-lessons-migration/` entries, and any target edit the user approves from one | control |
| migrated Playwright test, POMs, helpers, API clients, fixtures | publish branch |
| workflow-coverage YAML | publish branch |
| CodeceptJS source retirement | publish branch |

Nothing appears in both columns. The graphs and tracker never reach a PR because they are never on the branch, not because a later step removes them.

## Control branch preflight

Before starting a migration, check whether another tracker row is already `in-progress`; stop and report the conflict if so - do this check before touching `main`, since merging while a row is active would mix an unrelated merge commit into that migration's history.

Only once no row is `in-progress`, update the control branch from `main` and resolve any conflicts:

```bash
git switch <control-branch>
git fetch origin main
git merge origin/main
```

Confirm the worktree is clean before starting. A previous migration that failed to restore it leaves edits that would otherwise be swept into this migration's patch.

Refresh each graph through the `graphify` skill's update flow, not a bare `graphify . --update` - see `graphify.md` for why, and for the `--code-only` trap. Then clean and commit each one separately.

Playwright target graph, from `e2e_tests/`:

```bash
cd e2e_tests
# refresh via the graphify skill's update flow
find graphify-out -type f ! -name graph.json ! -name manifest.json -delete
rm -rf graphify-out/20*/
cd ..
git add e2e_tests/graphify-out/
git commit -m "chore(graphify): refresh Playwright graph"
```

Then the CodeceptJS source graph, from `codeceptjs-e2e/`:

```bash
cd codeceptjs-e2e
# refresh via the graphify skill's update flow
find graphify-out -type f ! -name graph.json ! -name manifest.json -delete
rm -rf graphify-out/20*/
cd ..
git add codeceptjs-e2e/graphify-out/
git commit -m "chore(graphify): refresh CodeceptJS graph"
```

The `rm -rf` removes the dated backup directory a curated-graph rebuild leaves behind; its own `graph.json`/`manifest.json` survive the name-based `find` and would otherwise land in the commit.

If a refresh produces no changes, do not create an empty commit for it.

## Starting the migration

Recommended PR-branch name, used at publish time:

```text
migrate-<category>-<test-name>
```

On control, change the selected tracker row to `in-progress` and commit that tracker-only change:

```bash
git add .claude/skills/codeceptjs-migration/tracker.md
git commit -m "chore(migration): mark <test-name> in progress"
```

Since only one row is ever `in-progress` at a time, this commit marks which row is active. It no longer defines a commit range - there is no range to cherry-pick.

From here the writer's edits, any reviewer locator fixes, and everything else the migration produces stay **uncommitted** in control's worktree until publication.

## Checkpointing uncommitted work

A migration runs for hours across several subagents with nothing committed, so give it a recovery point. After each phase, snapshot the working tree:

```bash
git add -N -- <paths...>
git diff HEAD --binary -M --output=.claude/migration-observations/<row>-<slug>.patch -- <paths...>
```

`git add -N` is still required: `git diff HEAD` sees staged content, but a genuinely untracked new file is invisible to any `git diff` form unless it is marked with intent-to-add first. `--binary` is required or a changed binary file (for example an `image-renderer` snapshot baseline) produces an unappliable stub. `-M` is required or a `git mv` (the source retirement) is invisible to the diff entirely. `--output=` is required instead of a shell redirect or a pipe: on this Windows/PowerShell setup a `>` redirect or a `|` pipe re-encodes the bytes with a UTF-8 BOM and CRLF line endings, and `git apply` accepts the corrupted patch silently. `git diff --output=` writes the bytes itself and is safe in any shell. `.claude/migration-observations/` is gitignored, so this is a checkpoint and not a commit. Note the snapshot on the timeline and delete it once the PR is open.

Every path in the `add -N` pathspec must exist on disk right now, under its current name. `git add -N` fails on the whole invocation if even one listed path does not exist - for example the pre-rename name of a file `git mv` already renamed - and when it fails, none of the paths in that call get intent-to-add, including ones that were otherwise fine; the checkpoint then silently omits every genuinely new file with no error surfaced downstream. List only the paths `git status --short` shows right now (their current names, not any name a file used to have), not a remembered list from earlier in the phase.

`git add -N` leaves intent-to-add entries in the index, and they persist. That is why the cleanup at the end restores `--staged` as well as `--worktree`: without it a new file that was snapshotted and then removed shows up as a staged deletion on control.

Verified only for a new file, a modified file, a modified binary file, and a `git mv` rename - the four shapes this workflow actually produces. Not verified for a merge conflict inside the applied patch; see "Move the work across" below for that failure mode.

## Before publication

Do not cut the publish branch until:

- initial review passed;
- MCP locator verification passed;
- migrated scenario execution passed; and
- target-file regression passed when required.

Source retirement, workflow coverage, and the final review all happen **on the publish branch**, because the gate has to verify committed content: a coverage plan described in prose is not something a reviewer can check, and a gate that cannot see what it is judging fails, gets re-requested, and fails again on an unchanged tree.

## Cut the publish branch

After execution passes. Use an isolated `git worktree` so control's own checkout is never switched away from.

```bash
git fetch origin main
git worktree add ../pmm-qa-publish -b migrate-<category>-<test-name> origin/main
cd ../pmm-qa-publish/e2e_tests && npm ci && cd -
```

`npm ci` is a prerequisite of committing at all, not just of revalidation: the pre-commit hook shells into `e2e_tests/node_modules/lint-staged` and fails with `MODULE_NOT_FOUND` until the install completes.

### Check for cross-migration dependencies first

For each path this migration touched, check `origin/main`:

```bash
git -C <control-worktree> add -N .
git -C <control-worktree> diff --name-only
git show origin/main:<path>
```

A path absent from `origin/main` depends on an earlier still-unmerged sibling migration - typically a shared helper. Decide explicitly whether to carry the full file into this PR or hold.

**File existence is not enough - compare the hunks.** A file can exist on `origin/main` while the specific block this migration edits does not, because a sibling's unmerged PR introduced it. The existence check reports the path as present and says nothing. So for each changed path also look at the region being edited (`git show origin/main:<path>` and find the block). When the block is missing, the choice is the same as for a missing file: create it in this PR scoped to this migration's own needs, or hold. Do not import the sibling's version of the block - that pulls an unmerged migration's CI changes into this PR and can reference tags with no tests behind them.

### Move the work across

Apply control's working-tree changes into the publish worktree, restricted to the paths this migration actually touched:

```bash
git -C <control-worktree> add -N -- <paths...>
git -C <control-worktree> diff HEAD --binary -M --output=<tmpfile> -- <paths...>
git -C ../pmm-qa-publish apply --3way <tmpfile>
```

List the paths explicitly rather than taking the whole diff, so an unrelated edit sitting in control's worktree cannot ride along. Never pipe the diff into `apply` and never redirect it with `>` - write it with `--output=` and apply from that file, for the same reason given in "Checkpointing uncommitted work" above.

Write the commit body from `git diff origin/main HEAD --stat` plus the per-file diffs, never from the phase handoff - a phase report names what the writer intended, the diff names what landed. Confirm every symbol you name with a scoped Grep before writing it. Row 4's body named an API method that did not exist and POM sections that were byte-identical to `origin/main`; both were falsifiable in about 30 seconds each, and missing them cost a full amend cycle after the final gate had passed.

A patch that fails to apply at all is the same cross-migration dependency surfacing earlier and more legibly than a merge conflict would. Resolve it the same way, before the PR exists. A patch that *appears* to apply can still be wrong: `git apply --3way` can land conflict markers in a file and still exit non-zero for that file while other files in the same patch apply cleanly - check `git -C ../pmm-qa-publish status --short` for `U` entries and `git -C ../pmm-qa-publish grep -n '^<<<<<<< '` for stray markers before committing anything in the publish worktree.

### Retire the source and add coverage, here

Both happen in the publish worktree, as commits on the publish branch.

Retirement, when the repository excludes renamed files from CodeceptJS discovery:

```bash
git mv codeceptjs-e2e/tests/<path>/<name>_test.js \
       codeceptjs-e2e/tests/<path>/<name>_migrated.js
```

Verify the retired source no longer matches CodeceptJS test discovery, and do not retire unrelated files. Retiring the test does not retire what it shared: page objects, API clients, and helpers the source used are often still called by other CodeceptJS tests; check each for remaining callers and keep it if any exist.

Control keeps the un-retired source until `main` merges back. That is correct - control is the testing branch, and the retirement belongs to the PR.

Then commit workflow coverage, per the section below.

### Revalidate, every time

Rerun static validation (lint/typecheck/build) and the migrated test itself in the publish worktree before pushing. A migration can call something an unmerged sibling added to a shared file without touching that file itself, which no dependency check above will catch.

Most of `.claude/` - `settings.json`, `hooks/`, `agents/`, and most of `scripts/` (`pmm-ui-login.js`, `pw-record.js`, `pw-screenshot.js`, `skill-gardener-counter.sh`, and their `lib/`) - is on `origin/main` and present in this worktree. Only four migration-specific scripts are control-only and therefore absent here: `check-migration-conventions.sh`, `run-migration-single-test.sh`, `verify-migration-locator.mjs`, and `validate-migration-scripts.sh` - along with the `codeceptjs-migration` skill and its three agents, which also exist only on control. Where one of those four scripts is still needed against files in this worktree, invoke it by its absolute path on the control worktree, pointed at the target file's path here, rather than assuming a local copy: `bash "<control-worktree>/.claude/scripts/check-migration-conventions.sh" ../pmm-qa-publish/e2e_tests/tests/<file>.test.ts`. For `run-migration-single-test.sh`, invoke the test runner directly instead, against the same live environment and the same credential pair:

```bash
cd ../pmm-qa-publish/e2e_tests
PMM_MIGRATION=1 PMM_UI_URL='https://127.0.0.1/' ADMIN_PASSWORD='admin' npx playwright test <target-test-file> --workers=1
```

Also run `python support_scripts/generate_readme.py --check` from the publish worktree's root. There is no npm script for it; `npm run readme:check` does not exist and its missing-script exit 1 reads like a failing check.

If the test selects state by index, empty that state before this run as well - it is a second run against the same environment.

## Workflow coverage

Committed on the publish branch, before the final review, so the gate can verify it.

Preserve every original CodeceptJS scenario tag in the migrated Playwright test. A destination execution tag may be added, but it must not replace or remove a source tag.

Leave existing CodeceptJS jobs and grep expressions unchanged, unless this migration is the one that empties them - see below.

### First: enumerate what consumes the source today

Every coverage decision below depends on this, so establish it before deciding anything.

Name the **workflow file**, never the word "nightly" - it denotes two different workflows. `e2e-tests-matrix.yml` carries both a `pull_request` trigger and a `schedule: cron '0 2 * * *'`, so its jobs run nightly too; `nightly-e2e-tests-matrix.yml` is `workflow_dispatch`-only, fired by Jenkins against an externally-managed PMM Server. Both run on a nightly cadence by different mechanisms. State each candidate job's trigger block as read, and check for a job-level `if:` gate rather than assuming a scheduled job is gated.

Consumers also exist **outside** `.github/workflows/`. `codeceptjs-e2e/package.json` defines per-tag scripts (`e2e:grafana-pr` runs `codeceptjs run -c pr.codecept.js --grep '@grafana-pr'`) plus a catch-all `e2e` script that excludes only `@not-ui-pipeline`/`@not-pr-pipeline`. Nothing inside pmm-qa invokes those, so the caller is cross-repository - percona/grafana CI running PMM's suite. Such a script invokes CodeceptJS only, so retiring the source drops coverage a new Playwright job cannot restore.

So for each migrated tag, state either its consumers or that a cross-repository caller could not be ruled out. **A tag with no workflow consumer must not be reported as having no consumer** - that is what makes a live tag look decorative.

When two coverage shapes are arguable, stop reasoning in prose and read the precedent: `git log -- .github/workflows/` and the last migration's actual diff shows which surfaces the previous retirement moved and why.

If retiring this source leaves a CodeceptJS job's grep expression selecting zero remaining active scenarios, delete that job in this same PR, in the same commit as the Playwright coverage that replaces it. Do not leave it in place "unchanged": both CI runners treat an empty test selection as a passing job (the launchable-subset gate skips every downstream step, and the run step itself ends `|| true`), so an emptied job does not fail or warn - it reports green forever while testing nothing, and nothing later in this process, or in CI, will ever flag it. Check every job the retired source's tags feed, not only the one job this migration happens to be touching.

Count that selection the way CodeceptJS does, because the obvious count is wrong twice over. It is a count of scenarios whose **title carries one of that job's grep tags**, not of scenarios in the file, and the matcher must catch `Scenario.skip(`, `xScenario(` and `Data(...).Scenario(` as well as `Scenario(`. Two figures come out of it and they license different decisions: the tagged count reproduces what CI selects, and the active count decides whether the job may stay. Row 5 was miscounted three separate times - 6 with a bare `Scenario(` matcher, 22 by counting whole files, against a true 11 tagged of which 6 active. An under-count deletes a job that still tests something; an over-count leaves a vacuous job reporting green forever.

For Playwright coverage, add it on the surfaces the enumeration above showed the *source* actually runs on. Only when the source is genuinely in a nightly grep does the append-to-nightly default apply; appending otherwise manufactures nightly coverage that never existed while leaving the surface the source really ran on with zero Playwright coverage once the tag retires - the exact "coverage vanishes on retirement" failure these rules exist to prevent.

On a surface the source genuinely ran on, and only there, append the migrated tag to that surface's existing `test_execution_playwright` matrix entry. Do not add a new Playwright job block: that job and its counter are already established on `main`, and adding coverage should be a one-line tag append to the existing `tags_for_tests` matrix entry. Two cases are not this case, and both take a new job rather than an append: no Playwright job of any kind exists yet for this migration's CI surface, or the surface is `fb-e2e-suite.yml`, which has no `test_execution_playwright` entry to append to - see The FB-suite case below. In either, mirror the retiring CodeceptJS job's setup verbatim.

When there is no retiring job to mirror - the source is kept, or the new job needs no database - the server-only value is `setup_services: '-h'`, as used by `fb-e2e-suite.yml`'s `alerting` job. Omitting the input is **not** equivalent: `runner-e2e-tests-playwright.yml` falls back to `''`, so `pmm-framework` runs with no arguments at all.

`expected_test_jobs` in `nightly-e2e-tests-matrix.yml` is the number of nightly test-execution jobs the setup shards wait for, matched by the `"test execution / "` name prefix in `runner-e2e-tests-codeceptjs-remote-nightly-setup.yml`. Both CodeceptJS and Playwright test-execution jobs count toward it. So:

- **Appending a tag** to an existing matrix entry changes no job count - leave the counter alone. This is the normal case, and it is why appending is preferred over adding an entry.
- **Adding** a nightly consumer (a new matrix entry or a new prefixed job) increments the count, and **deleting** one - including deleting a CodeceptJS job this migration emptied - decrements it. In either case the counter must be updated in the same commit to match reality. Leaving it too high makes the setup shards wait for a job that no longer exists and then fail the run on a timeout; leaving it too low lets the shards finish and tear down their environment while a real consumer is still running.
- A job in `fb-e2e-suite.yml` is not fed by these setup shards and carries no such counter, so adding or deleting one there does not affect `expected_test_jobs`.

Count the nightly consumers after your edit and state the before/after number in the handoff rather than reasoning about the delta. Locate the counter mechanically instead of reasoning about your own edit - `grep -rn expected_test_jobs .github/workflows/` finds the single literal and the comment naming its consumers in one command, and it settles which workflow owns it, which is the question that gets answered wrong when framed as "did I add a job?".

### The FB-suite case

`fb-e2e-suite.yml` is a separate surface with its own rules, and it is the one most easily lost: it is not fed by the nightly setup shards, carries no `expected_test_jobs` counter, and - unlike the matrix workflows - has no `test_execution_playwright` entry to append to at all. Coverage there is per-job.

Almost every `@fb-*` tag is selected by a **CodeceptJS** job in that file (`grep -n "tags_for_tests" .github/workflows/fb-e2e-suite.yml`). Retiring a source off the `_test.js` discovery glob removes that source's scenarios from such a job while leaving the job itself green, because the job's grep still matches the other files carrying the same tag. Nothing fails, nothing warns, and the tag keeps appearing in CI job names - so the loss is invisible in exactly the place the `@fb-` prefix exists to guarantee coverage.

So when any migrated scenario carries a tag selected by a CodeceptJS job in `fb-e2e-suite.yml`:

- add a Playwright job to `fb-e2e-suite.yml` for that tag, mirroring the retiring source's `setup_services`. The `alerting` job there is the precedent for calling `runner-e2e-tests-playwright.yml` from this file; copy its shape, including `launchable_confidence` and the `pmm_qa_branch` expression;
- leave the CodeceptJS job in place unless retirement emptied it completely - it normally still has live files behind the same grep; and
- state the tag's FB consumers, before and after the edit, in the handoff.

Do not treat "the `@fb-settings` job still runs" as evidence of coverage. The question is whether *this migration's scenarios* are still selected somewhere in that file, which only `--list --grep` against the job's own expression answers.

### Check selectability per scenario and across every consumer

A source file's scenarios rarely all carry the same tags, so the file's union of tags is not what CI selects on. Verify with `npx playwright test --list --grep '<expression>'` in both directions:

- every migrated scenario is now selected by some Playwright job; and
- every tag the edited job already carried still selects exactly what it selected before.

Bound the reverse direction first. Run `git diff --name-status origin/main HEAD -- e2e_tests/tests/`: when it shows no modified test file (only additions), no existing expression's selection can change except by newly matching the added file, so the whole reverse check reduces to listing each existing expression once and confirming zero hits for that filename. Do not re-derive per-scenario selections for expressions nothing could have moved.

Then widen the check beyond the job you just edited: tags are reused across many tracker rows, so a migrated scenario's tag can already be selected by a job you never touched - one that was written for an earlier, different migration and may not provision what this scenario needs. For each tag on each migrated scenario, enumerate every job across `.github/workflows/` whose `pmm_test_flag`/`tags_for_tests` would select it (`grep -n "pmm_test_flag\|tags_for_tests" .github/workflows/*.yml`), and for every consumer found - not only the one this migration edited - confirm its `setup_services` actually covers what the scenario needs. Selection is not the same claim as executability: a scenario can be correctly *selected* by a job whose environment cannot make it *pass*.

A migrated scenario that matches no destination grep is coverage that vanishes the moment the source is retired, and nothing about a green test run reveals it. A migrated scenario selected by a job that cannot supply its required services is worse: it may fail (swallowed by the `|| true` on the run step, reading as flake) or silently pass while asserting less than the source did.

**When the edit newly selects tests outside the migrated file, run them.** Widening a grep can pull in existing tests that no job selects today. Selection evidence is not execution evidence, and the `|| true` hides the difference - a newly-selected test the job's environment cannot support fails silently and reads as flake rather than as a coverage defect this migration introduced. Run the **edited job's own full grep expression** once, at the job's own worker count, rather than only the newly-selected tests - it costs one run instead of two, discharges the same obligation, and reproduces exactly what CI will select and the order and concurrency it runs at, which a per-file run cannot. Report that command as the coverage-edit execution evidence.

### Fixing a non-tip commit message after the final gate

`git rebase -i` is unavailable in this environment. To correct the message of a commit that is not the branch tip:

```bash
git checkout --detach <commit>
git commit --amend -F <msgfile>      # preserves the original author and author date
git cherry-pick <old-tip>
git branch -f <branch> HEAD
git checkout <branch>
```

A passing final gate is only valid for the tree it reviewed, so prove the rewrite was message-only **before** pushing, with all three checks - an empty top-level diff alone does not show the intermediate commit's tree survived:

```bash
git diff <old-tip> <new-tip>                      # must be empty
git rev-parse <old-tip>^{tree} <new-tip>^{tree}   # must match
git rev-parse <old-commit>^{tree} <new-commit>^{tree}   # must match at the amended commit too
git log -1 --format=%B <new-tip>                  # tip message unchanged
```

## Push and open the PR

Only after `FINAL_REVIEW_PASS`, from the publish worktree:

```bash
git push -u origin HEAD
gh pr create \
  --base main \
  --head "$(git branch --show-current)" \
  --title "migrate(<category>): <test-name> CodeceptJS to Playwright" \
  --body-file <scratchpad>/migration-pr.md
```

The PR body must include:

- source path;
- actual target path;
- migrated scenarios and preserved tags;
- source and target files queried from existing graphs;
- setup used;
- static validation result;
- MCP locator verification result;
- execution commands and results;
- workflow-coverage changes and their grep verification;
- final review result.

## Attach CI execution

PRs to `main` auto-trigger `e2e-tests-matrix.yml`. After `gh pr create`, resolve the workflow run and link it on the PR:

```bash
PR_NUM=$(gh pr view --json number -q .number)
RUN_URL=$(gh run list --workflow e2e-tests-matrix.yml --branch "$(git branch --show-current)" --limit 1 --json url -q '.[0].url')
[ -n "$RUN_URL" ] && gh pr comment "$PR_NUM" --body "GitHub Actions: ${RUN_URL}"
```

Include the run URL in the tracker Notes. Do not wait for CI to finish before marking `done`.

## Tracker completion and cleanup

After the PR exists, on control's own checkout (never switched away from - only the isolated publish worktree touched a different branch):

1. update the row to `done`;
2. record the PR URL or number, GitHub Actions run URL, actual target and setup, review, MCP, test, and pre-migration graph-refresh results;
3. commit and push only the tracker change - edit the row as an **anchored substring replacement**, never a whole-file rewrite. `tracker.md` is LF-only and a naive whole-file write flips all 164 lines to CRLF on this Windows setup. Before staging, require `git diff --numstat -- <tracker>` to show `1 1` and a zero carriage-return count from `python -c "print(open('<tracker>','rb').read().count(bytes([13])))"`. Do not reach for a shell CR literal here: it does not survive quoting or a heredoc, and a grep left holding an empty pattern reports every line as a match, which reads as a total CRLF flip that never happened; and
4. restore control's worktree to clean.

Step 4 is not optional. The migration's edits are still sitting there uncommitted, and leaving them means the next migration starts on top of them and sweeps them into its own patch:

```bash
git -C <control-worktree> restore --staged --worktree -- <paths...>
git -C <control-worktree> status --short
```

`restore --staged --worktree` on its own is both necessary and sufficient here, and it depends on the intent-to-add entries from `git add -N` still being in the index. Do not `git reset` those entries first: `reset` turns an intent-to-add new file back into a plain untracked file, and `restore` then fails on it with `pathspec ... did not match any file(s) known to git` and aborts the **entire** invocation - so the new file survives and every other path in the same pathspec is left un-restored too. Verified: with the entries intact, one `restore --staged --worktree` deletes intent-to-add new files (binaries included), reverts modified files, exits 0, and leaves `git status --short` empty.

Do not use `git clean -fd` here either, even scoped to specific paths. If the migration created a new directory, `clean -fd` removes the whole directory rather than an enumerated file list, and it will delete anything else placed there since - with no backup, because by this point the `.patch` checkpoint has already been deleted and nothing was ever committed on control. If a path still shows after the restore, inspect it by name before removing it.

Verify the status output is empty before reporting completion.

Do not merge the publish branch into control. After the migration PR merges into `main`, a later `main` merge into control delivers it.

Remove the publish worktree as part of terminal-path cleanup, alongside `provisioning/setup.ts --teardown`:

```bash
git worktree remove ../pmm-qa-publish
```

If the PR opened but the control-branch tracker update failed, report publication as incomplete and do not claim completion.

# Branch and PR Workflow

Migration work **happens and is tested** on the control branch's worktree, and is **never committed there**. Control commits only what is genuinely control-only: the `origin/main` merge, both graph refreshes, and the two tracker status changes. The migrated code is moved to a fresh branch cut from `origin/main`, committed there, reviewed there, and PR'd against `main`. Control receives it later through an ordinary `merge origin/main`.

Committing the code on control as well would author the same content twice and then take delivery of it a third time on the next merge from `main`. That is what produced cross-branch conflicts and what made a scrubbing step necessary; neither exists in this model.

## What is committed where

| Content | Branch |
| --- | --- |
| `origin/main` merge, `e2e_tests/graphify-out/`, `codeceptjs-e2e/graphify-out/` | control |
| tracker row `in-progress`, tracker row `done` | control |
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
git add -N .
git diff > .claude/migration-observations/<row>-<slug>.patch
```

`git add -N` is required or new files are absent from the diff. `.claude/migration-observations/` is gitignored, so this is a checkpoint and not a commit. Note the snapshot on the timeline and delete it once the PR is open.

`git add -N` leaves intent-to-add entries in the index, and they persist. That is why the cleanup at the end restores `--staged` as well as `--worktree`: without it a new file that was snapshotted and then removed shows up as a staged deletion on control.

Verified round-trip: a diff carrying one new file and one modified file, taken this way from control, applies cleanly with `git apply --3way` into a worktree cut from `origin/main` and produces the expected `A` and `M` entries.

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
git -C <control-worktree> add -N .
git -C <control-worktree> diff -- <paths...> | git -C ../pmm-qa-publish apply --3way
```

List the paths explicitly rather than taking the whole diff, so an unrelated edit sitting in control's worktree cannot ride along. Then commit in the publish worktree.

A patch that does not apply is the same cross-migration dependency surfacing earlier and more legibly than a merge conflict would. Resolve it the same way, before the PR exists.

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

`.claude/scripts/` is control-only tooling and is correctly absent from a worktree cut from `origin/main`, so `run-migration-single-test.sh` does not exist here. Invoke the test runner directly, against the same live environment and the same credential pair:

```bash
cd ../pmm-qa-publish/e2e_tests
PMM_MIGRATION=1 PMM_UI_URL='https://127.0.0.1/' ADMIN_PASSWORD='admin' npx playwright test <target-test-file> --workers=1
```

If the test selects state by index, empty that state before this run as well - it is a second run against the same environment.

## Workflow coverage

Committed on the publish branch, before the final review, so the gate can verify it.

Preserve every original CodeceptJS scenario tag in the migrated Playwright test. A destination execution tag may be added, but it must not replace or remove a source tag.

Leave existing CodeceptJS jobs and grep expressions unchanged, including when no active CodeceptJS scenario remains for a migrated tag.

For Playwright coverage:

- append the migrated tag to an existing Playwright job when its `setup_services` is sufficient; or
- create a Playwright job with the required setup when no compatible job exists.

Do not create a new Playwright job when an existing job provides the required setup.

**Check selectability per scenario, not per file.** A source file's scenarios rarely all carry the same tags, so the file's union of tags is not what CI selects on. Verify with `npx playwright test --list --grep '<expression>'` in both directions:

- every migrated scenario is now selected by some Playwright job; and
- every tag the edited job already carried still selects exactly what it selected before.

A migrated scenario that matches no destination grep is coverage that vanishes the moment the source is retired, and nothing about a green test run reveals it.

Two traps worth checking explicitly. A grep expression containing `|` is compiled as a regular expression by `e2e_tests/launchable-prepare.js`; if it were string-matched the subset would be empty and the whole job would skip while still reporting green. And a matrix entry that counts its consumers (`expected_test_jobs`) stays correct only if you append a tag to an existing entry rather than adding a second one.

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
3. commit and push only the tracker change; and
4. restore control's worktree to clean.

Step 4 is not optional. The migration's edits are still sitting there uncommitted, and leaving them means the next migration starts on top of them and sweeps them into its own patch:

```bash
git -C <control-worktree> restore --staged --worktree -- <paths...>
git -C <control-worktree> clean -fd -- <new-paths...>
git -C <control-worktree> status --short
```

Verify the status output is empty before reporting completion.

Do not merge the publish branch into control. After the migration PR merges into `main`, a later `main` merge into control delivers it.

Remove the publish worktree as part of terminal-path cleanup, alongside `provisioning/setup.ts --teardown`:

```bash
git worktree remove ../pmm-qa-publish
```

If the PR opened but the control-branch tracker update failed, report publication as incomplete and do not claim completion.

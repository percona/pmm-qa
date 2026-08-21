# Branch and PR Workflow

All migration work happens directly on the control branch - no separate branch is created during the working phase. Only at publish time is a fresh branch cut, built by cherry-picking the migration's own commits onto `origin/main`. The PR targets `main`.

## Control branch preflight

Before starting a migration, check whether another tracker row is already `in-progress`; stop and report the conflict if so - do this check before touching `main`, since merging while a row is active would mix an unrelated merge commit into that migration's history.

Only once no row is `in-progress`, update the control branch from `main` and resolve any conflicts:

```bash
git switch <control-branch>
git fetch origin main
git merge origin/main
```

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

If a refresh produces no changes, do not create an empty commit for it. Keep both graph commits on the control branch; they must not appear in the migration PR. Refresh both graphs only during control preflight. Never regenerate either graph during writer/reviewer/runner work.

## Starting the migration

Recommended PR-branch name (used only at publish time, see "Cut the publish branch" below):

```text
migrate-<category>-<test-name>
```

On control, change the selected tracker row to `in-progress` and commit that tracker-only change:

```bash
git switch <control-branch>
git add .claude/skills/codeceptjs-migration/tracker.md
git commit -m "chore(migration): mark <test-name> in progress"
```

Record this commit's SHA as `migration-start` - write it into the handoff/notes so a resumed session can recover it (e.g. via `git log --grep "mark <test-name> in progress"` on control) rather than relying on it staying in an agent's working memory. Since only one row is ever `in-progress` at a time, this commit unambiguously marks where this migration's own commits begin.

All subsequent work - writer's migration commit(s), any reviewer locator-fix commits, source retirement, workflow-coverage edits - lands as ordinary commits directly on control's worktree, on top of `migration-start`. No branch is created for any of this.

## Before publication

Do not retire the source, cut the publish branch, or open a PR until:

- initial review passed;
- MCP locator verification passed;
- migrated scenario execution passed;
- target-file regression passed when required;
- workflow coverage is **committed** on control; and
- final review returned `FINAL_REVIEW_PASS`.

Workflow coverage is committed before the final review, not after it. The gate has to verify committed YAML: a coverage plan described in prose is not something a reviewer can check, and a gate that cannot see what it is judging fails, gets re-requested, and fails again on the identical commit.

## Workflow coverage

Committed on control after execution passes and **before** the final review, so the gate can verify it.

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

## Source retirement

Retire only the selected CodeceptJS source after final review, as a commit directly on control.

When the repository excludes renamed files from CodeceptJS discovery, use:

```bash
git mv codeceptjs-e2e/tests/<path>/<name>_test.js \
       codeceptjs-e2e/tests/<path>/<name>_migrated.js
```

Before committing, verify that the retired source no longer matches CodeceptJS test discovery. Do not retire unrelated files.

Retiring the test does not retire what it shared. Page objects, API clients, and helpers the source used are often still called by other CodeceptJS tests; check each one for remaining callers and keep it if any exist.

## Cut the publish branch

Only after `FINAL_REVIEW_PASS` and the source-retirement/workflow-coverage commits are in place. Do this in an isolated `git worktree` so control's own checkout is never switched away from at all, through the entire workflow.

```bash
git fetch origin main
git worktree add ../pmm-qa-publish -b migrate-<category>-<test-name> origin/main
```

Install dependencies in the fresh worktree first:

```bash
cd ../pmm-qa-publish/e2e_tests && npm ci && cd -
```

This is a prerequisite of the cherry-pick itself, not just of revalidation: the pre-commit hook shells into `e2e_tests/node_modules/lint-staged`, so `git cherry-pick --continue` fails with `MODULE_NOT_FOUND` until the install completes.

In that worktree, before cherry-picking, check every file this migration touched for a cross-migration dependency: for each path in `git diff --name-only migration-start <control-branch>`, run `git show origin/main:<path>` - any that don't exist there yet depend on an earlier still-unmerged sibling migration (e.g. a shared helper file). Decide explicitly whether to carry the full file into this PR or hold, same judgment call as before, just made proactively instead of discovering it mid-cherry-pick.

**File existence is not enough - compare the hunks.** A file can exist on `origin/main` while the specific block this migration edits does not, because a sibling's unmerged PR introduced it. The existence check reports the path as present, says nothing, and the cherry-pick conflicts anyway. So for each changed path also diff the touched region against `origin/main` (`git diff origin/main migration-start -- <path>` and read the context lines, or `git show origin/main:<path>` and look for the block each commit edits). When the block is missing, the choice is the same one as for a missing file: create it in this PR scoped to this migration's own needs, or hold. Do not import the sibling's version of the block - that pulls an unmerged migration's CI changes into this PR and can reference tags with no tests behind them.

Cherry-pick this migration's own commit range onto the fresh branch:

```bash
git cherry-pick migration-start..<control-branch>
```

This range excludes the tracker/graph-refresh commits by construction - they sit before `migration-start` or come after publish. Resolve any conflicts (expected class: the same shared-file cross-migration dependency, now surfacing as an ordinary content conflict instead of a modify/delete).

**Purify, don't just verify.** Even though tracker/graph commits are outside the cherry-picked range, confirm none of their paths landed anyway (e.g. via conflict-resolution side effects):

```bash
git status --short
git diff --check
git diff --name-only origin/main...HEAD
```

If a tracker or `graphify-out/` path appears, restore it from `origin/main` and fold the fix into the cherry-picked commits before proceeding: `git restore --source=origin/main -- <path>`. The final diff must contain no tracker or `graphify-out/` files - this check confirms that, it is not the only safeguard.

**Revalidate, every time**, not only when a cherry-pick conflict occurred: rerun static validation (lint/typecheck/build) and the migrated test itself against this freshly cherry-picked worktree before pushing. A migration can call something an unmerged sibling migration added to a shared file without touching that file itself - invisible to both the file-existence check and to cherry-pick, since nothing conflicts.

`.claude/scripts/` is control-only tooling and is correctly absent from a worktree cut from `origin/main`, so `run-migration-single-test.sh` does not exist here. Invoke the test runner directly instead, against the same live environment and the same credential pair:

```bash
cd ../pmm-qa-publish/e2e_tests
PMM_MIGRATION=1 PMM_UI_URL='https://127.0.0.1/' ADMIN_PASSWORD='admin' npx playwright test <target-test-file> --workers=1
```

If the test selects state by index, empty that state before this run as well - it is a second run against the same environment.

Push and open the PR from the publish worktree:

```bash
git push -u origin HEAD
gh pr create \
  --base main \
  --head "$(git branch --show-current)" \
  --title "migrate(<category>): <test-name> CodeceptJS to Playwright" \
  --body-file /tmp/migration-pr.md
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
- final review result.

## Attach CI execution

PRs to `main` auto-trigger `e2e-tests-matrix.yml`. After `gh pr create`, resolve the workflow run and link it on the PR:

```bash
PR_NUM=$(gh pr view --json number -q .number)
RUN_URL=$(gh run list --workflow e2e-tests-matrix.yml --branch "$(git branch --show-current)" --limit 1 --json url -q '.[0].url')
[ -n "$RUN_URL" ] && gh pr comment "$PR_NUM" --body "GitHub Actions: ${RUN_URL}"
```

Include the run URL in the tracker Notes. Do not wait for CI to finish before marking `done`.

## Tracker completion

After the PR exists, return to control's own checkout (it was never switched away from - only the isolated publish worktree touched a different branch) and:

1. update the row to `done`;
2. record the PR URL or number, GitHub Actions run URL, actual target and setup, review, MCP, test, and pre-migration graph-refresh results; and
3. commit and push only the tracker change.

Do not merge the publish branch into control - control already has this migration's code from having done the work there directly. After the migration PR merges into `main`, a later `main` merge into control reconciles it.

Remove the publish worktree as part of terminal-path cleanup, alongside `provisioning/setup.ts --teardown`:

```bash
git worktree remove ../pmm-qa-publish
```

If the PR opened but the control-branch tracker update failed, report publication as incomplete and do not claim completion.

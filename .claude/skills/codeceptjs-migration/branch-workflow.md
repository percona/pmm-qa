# Branch and PR Workflow

Migration work happens and is tested in the control branch's worktree and is never committed there. The migrated code moves to a fresh branch cut from `origin/main`, is committed, reviewed and PR'd there, and reaches control later through an ordinary `merge origin/main`.

## What is committed where

| Content | Branch |
| --- | --- |
| `origin/main` merge | control |
| tracker row `in-progress`, tracker row `done` | control |
| `.claude/skill-lessons-migration/` entries, and any target edit the user approves from one | control |
| migrated Playwright test, POMs, helpers, API clients, fixtures | publish branch |
| workflow-coverage YAML | publish branch |
| CodeceptJS source retirement | publish branch |

Nothing appears in both columns.

## Control branch preflight

Stop if another tracker row is `in-progress`. Otherwise:

```bash
git switch <control-branch>
git fetch origin main
git merge origin/main
git status --short        # must be empty before the migration starts
```

## Starting the migration

Mark the row on control in a tracker-only commit; it identifies the active row:

```bash
git add .claude/skills/codeceptjs-migration/tracker.md
git commit -m "chore(migration): mark <test-name> in progress"
```

Everything the migration produces from here stays uncommitted in control's worktree until publication. Publish branch name: `migrate-<category>-<test-name>`.

## Before publication

Cut the publish branch only after initial review, MCP locator verification, migrated-scenario execution and, when required, target-file regression have all passed. Source retirement, workflow coverage and the final review happen on the publish branch, so the gate reviews committed content.

## Cut the publish branch

```bash
git fetch origin main
git worktree add ../pmm-qa-publish -b migrate-<category>-<test-name> origin/main
cd ../pmm-qa-publish/e2e_tests && npm ci && cd -
```

`npm ci` is a prerequisite of committing, not only of revalidation.

### Check for cross-migration dependencies first

For each path this migration touched:

```bash
git -C <control-worktree> add -N .
git -C <control-worktree> diff --name-only
git ls-tree --name-only origin/main -- <path>     # empty output = absent
```

Use `git ls-tree`, never `git show origin/main:<path>`, which reports every path as absent on this shell (`AGENTS.md` section Shell and tooling notes). A path absent from `origin/main`, or a file present whose edited block is absent, belongs to an unmerged sibling migration: create what this migration needs scoped to itself, or hold. Never import the sibling's version.

### Move the work across

```bash
git -C <control-worktree> add -N -- <paths...>
git -C <control-worktree> diff HEAD --binary -M --output=<tmpfile> -- <paths...>
git -C ../pmm-qa-publish apply --3way <tmpfile>
```

List the paths `git status --short` shows now, under their current names; one missing path fails the whole `add -N` and the diff silently omits every new file. `--binary` keeps binaries appliable, `-M` keeps the `git mv` retirement visible, and `--output=` is the only safe way to write the patch: `>` and `|` corrupt it. A patch that fails to apply is a cross-migration dependency; resolve it before the PR exists. After applying, check `git -C ../pmm-qa-publish status --short` for `U` entries and `git -C ../pmm-qa-publish grep -n '^<<<<<<< '` before committing.

### Retire the source and add coverage, here

```bash
git mv codeceptjs-e2e/tests/<path>/<name>_test.js \
       codeceptjs-e2e/tests/<path>/<name>_migrated.js
```

Verify the retired file no longer matches CodeceptJS discovery. Retire only this source: page objects, API clients and helpers it used usually still have other CodeceptJS callers; check each and keep it if any exist. Control keeps the un-retired source until `main` merges back. Then commit workflow coverage per the section below.

### Revalidate, every time

In the publish worktree, before pushing:

1. `bash "<control-worktree>/.claude/scripts/check-migration-conventions.sh" <every changed file, workflow YAML included>`. The migration scripts and skill exist only on control; invoke them by absolute path. The diff-scoped checks compare against `origin/main` inside the worktree and refuse to run without that ref.
2. Static validation (lint, typecheck, build) and `python support_scripts/generate_readme.py --check` from the worktree root (there is no npm script for it).
3. The migrated test, against the parent's live environment and credential pair:

```bash
cd ../pmm-qa-publish/e2e_tests
PMM_MIGRATION=1 PMM_UI_URL='<parent's PMM_UI_URL>' ADMIN_PASSWORD='<parent's ADMIN_PASSWORD>' \
  npx playwright test <target-test-file> --workers=1
```

`PMM_MIGRATION=1` stops `e2e_tests/.env` from overriding both values (`playwright.config.ts` does `dotenv.config({ override: !process.env.PMM_MIGRATION })`). The password is the parent's, frequently not `admin`. If the test selects state by index, empty that state first; this is a second run against the same environment.

`.claude/hooks/lint-changed.sh` runs `actionlint` on the PR behind the `Lint` check, so a workflow edit is schema-checked in CI even when `actionlint` is unavailable locally; do not report it as unverified.

A commit the parent adds to the publish branch has had no reviewer: name it as parent-authored in the final-gate handoff so the gate checks it.

## Commit messages

Write every message with `git commit -F -` and a quoted heredoc, never `-m "..."` (bash command-substitutes backticks inside `-m`). Subject: `<type>(<scope>): <summary>`; `update` is not a subject.

This repository squash-merges, and the squash body is the concatenation of the branch's commit messages, not the PR body. So:

- Write each body from `git diff origin/main HEAD --stat` and the per-file diffs, never from a phase handoff. Confirm every symbol, number, filename, trigger and line reference against the tree with a scoped Grep before the final gate; a message-only amend after the gate moves HEAD and costs a fresh gate.
- Correct a false clause in an already-pushed non-tip commit body in the next commit's body, naming the commit and quoting the clause. Never force-push for it. Amending the tip is allowed but cancels an in-flight CI matrix.
- Re-read the PR body against `git diff -M origin/main..HEAD` before requesting review and after every push. Do not hand-trim the pre-filled bullets in the merge box.

To fix a non-tip message when a rewrite is unavoidable (`git rebase -i` is unavailable):

```bash
git checkout --detach <commit>
git commit --amend -F <msgfile>
git cherry-pick <old-tip>
git branch -f <branch> HEAD
git checkout <branch>
git diff <old-tip> <new-tip>                              # empty
git rev-parse <old-tip>^{tree} <new-tip>^{tree}           # equal
git rev-parse <old-commit>^{tree} <new-commit>^{tree}     # equal
git log -1 --format=%B <new-tip>                          # unchanged
```

All four checks must pass before pushing; a final gate is valid only for the tree it reviewed.

## Workflow coverage

Committed on the publish branch before the final review. Preserve every source tag in the migrated title; a destination tag may be added, never substituted. Leave existing CodeceptJS jobs and greps unchanged unless this migration empties them.

### 1. Enumerate what consumes the source today

Name the workflow file, never "nightly": `e2e-tests-matrix.yml` runs on `pull_request` and `schedule: cron '0 2 * * *'`; `nightly-e2e-tests-matrix.yml` is `workflow_dispatch`-only, fired by Jenkins against an externally-managed server. State each candidate job's trigger block as read and check for a job-level `if:`.

Consumers also live outside `.github/workflows/`. Re-derive before relying on the table:

```bash
# Jenkins: every CodeceptJS and Playwright grep in PMM's pipelines
git clone -q --depth 1 --filter=blob:none --sparse https://github.com/Percona-Lab/jenkins-pipelines.git <scratch>/jp   && git -C <scratch>/jp sparse-checkout set pmm/v3   && grep -rnoE "(codeceptjs run|playwright test)[^'\"]*--grep [\"'][^\"']+[\"']" <scratch>/jp/pmm/v3/*.groovy
# percona/grafana: runs pmm-qa on every Grafana PR
curl -sf https://raw.githubusercontent.com/percona/grafana/main/.github/workflows/ui-tests.yml | grep -nE 'grafana-pr|--grep'
```

| Tag | Consumer | Playwright side |
| --- | --- | --- |
| `@gssapi-nightly` | Jenkins `pmm3-ui-tests-nightly-gssapi.groovy` (cron, GSSAPI-enabled server) | `Run Playwright UI Tests` stage, same grep, once the jenkins-pipelines PR adding it merges; before that, retiring the source loses GSSAPI coverage |
| `@grafana-pr` | `percona/grafana` `.github/workflows/ui-tests.yml` | already runs `npx playwright test --grep @grafana-pr --pass-with-no-tests` beside `npm run e2e:grafana-pr` |
| `@qan`, `@nightly`, `@menu` | Jenkins `pmm3-ui-tests-nightly.groovy`, CodeceptJS only | dead: no cron, no caller in `pmm/`, last builds failed in under a second. The live nightly is `pmm3-ui-tests-nightly-gha.groovy`, which dispatches `nightly-e2e-tests-matrix.yml` |
| `@ami-upgrade`, `@ami-ovf-*`, `@pmm-upgrade`, `@pmm-migration`, `@pmm-pre-migration` | Jenkins upgrade and migration pipelines | none; the first migrated test carrying one needs a Playwright step in that pipeline before the source retires |

For each migrated tag, name every consumer or state that a cross-repository caller could not be ruled out. A tag in this table is never reported as "no consumer". When two coverage shapes are arguable, read the precedent: `git log -- .github/workflows/` and the last migration's diff.

Count the source's active scenarios per tag, matching `Scenario(`, `Scenario.skip(`, `xScenario(` and `Data(...).Scenario(`, and cross-check against a plain tag grep; a `^`-anchored regex without `m` under-counts. If retirement leaves a job's grep with no active matches, delete the job in the same commit as the replacement coverage.

### 2. Choose the coverage shape

- **Source runs under a `test_execution_playwright` matrix entry's surface:** append the tag to that entry's existing `tags_for_tests`. Do not add a job block.
- **No Playwright job exists for the surface, or the surface is `fb-e2e-suite.yml`:** add a job mirroring the retiring CodeceptJS job's `setup_services` verbatim. In `fb-e2e-suite.yml` copy the `alerting` job's shape, including `launchable_confidence` and the `pmm_qa_branch` expression; leave the CodeceptJS job unless retirement emptied it; do not also add the tag to `e2e-tests-matrix.yml`, which already calls `fb-e2e-suite.yml` as `fb_tests`.
- **This migration retires the last CodeceptJS consumer of a runner workflow:** convert the runner in place, same filename and server-setup steps. Point the install at `e2e_tests/`, swap `codeceptjs run` for `npx playwright test --grep`, set any URL the harness needs, and pass the selection input to the runner's `pmm_test_flag` (a matrix may keep `tags_for_tests` as its key, as the nightly workflow does). Add a parallel runner only when the old one has other callers, and name them.
- **No retiring job to mirror and no database needed:** `setup_services: '-h'`. Omitting the input makes `runner-e2e-tests-playwright.yml` run `pmm-framework` with no arguments.
- **Only the source's real surfaces.** Appending to nightly a scenario the source never ran nightly manufactures coverage while leaving its real surface at zero.

Safety rules for every workflow edit:

- Never write `${{ env.X }}` inside `run:`; read the job's `env:` as a shell variable (`--grep "$PMM_TEST_FLAG"`). Pre-existing interpolations in untouched lines are not this PR's business.
- Before widening a grep, `--list --grep` the current and widened expressions and account for every test in the difference; prefer a narrower sub-bucket tag (`@valkey-nightly`, `@pbm-nightly`) retagged in this PR over a wider grep.
- `@nightly` is the Playwright nightly alternation on `main`; confirm on `origin/main` and check what it selects before adding to it.
- Never route a load-generating test at the shared Jenkins-managed nightly server; FB and PR CI only.
- A new runner assembled from two parents: diff their `env:` blocks as parsed YAML across workflow, job and step level. A key in both parents and absent from the child is a defect (`CLIENT_VERSION` missing makes `pmm-framework` test stock `3-dev-latest`); a key in one parent is usually machinery deliberately not ported, so say which. Also confirm every `${{ env.X }}` the child references is declared; systemd `Environment=` lines in heredocs and `. /etc/os-release` variables are expected false positives.

### 3. Keep `expected_test_jobs` true

`grep -rn expected_test_jobs .github/workflows/` finds the single counter in `nightly-e2e-tests-matrix.yml`; it is the number of `"test execution / "` jobs the setup shards wait for, CodeceptJS and Playwright alike. Appending a tag changes nothing. Adding or deleting a nightly matrix entry or prefixed job changes it by one, in the same commit. `fb-e2e-suite.yml` jobs are not counted. State the before and after count in the handoff.

### 4. Check selectability per scenario and across every consumer

With `npx playwright test --list --grep '<expression>'`, in both directions:

- every migrated scenario is selected by some Playwright job whose `setup_services` covers what it needs (`grep -n "pmm_test_flag\|tags_for_tests" .github/workflows/*.yml` lists every selecting job; selection is not executability);
- every expression an edited job already carried selects exactly what it did before. If `git diff --name-status origin/main HEAD -- e2e_tests/tests/` shows only additions, this reduces to confirming each existing expression has zero hits on the new filename.

Capture each selection to a sorted file and report added and removed sets with `comm -13`/`comm -23`, never two totals. Do not parse `Total: N tests` (misses `Total: 1 test`) and do not count with `git grep <rev> -- 'dir/**/*_test.js'` (`**` does not span directories); measure each count twice by different mechanisms.

When the edit newly selects tests outside the migrated file, run the edited job's full grep expression once at its own worker count and report the command; `|| true` on the run step turns an unsupported test into apparent flake.

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

The body is this template and nothing more, 25 lines and 1,500 characters at most, written from the diff. Evidence and history stay in the ledger and timeline. A body over the cap is a final-gate finding.

```markdown
Migrates `<source path>` to `<target path>`.

**Scenarios:** PMM-Txxxx, PMM-Tyyyy (N rows) - tags `@a @b` preserved.
**Setup:** `<setup_services>`; local Docker via provisioning/.
**Coverage:** <one line: which job/tag selects them now, e.g. "appended @x to nightly Playwright matrix; FB job `settings` added">.
**Retired:** `<source>_test.js` -> `_migrated.js`; <job deleted, if any>.
**Deviations:** <one line per deliberate change from the source, or "none">.
**Run:** <Actions run URL>
```

## Attach CI execution

```bash
PR_NUM=$(gh pr view --json number -q .number)
RUN_URL=$(gh run list --workflow e2e-tests-matrix.yml --branch "$(git branch --show-current)" --limit 1 --json url -q '.[0].url')
[ -n "$RUN_URL" ] && gh pr comment "$PR_NUM" --body "GitHub Actions: ${RUN_URL}"
```

The linked run must contain a job that executed the migrated scenarios: `--list --grep` its job expressions against the branch, list its jobs with `gh run view <id> --json jobs`, and name the one. A cancelled run, or one whose jobs grep other tags, is not a link. A scenario only the `@nightly` bucket selects has no PR-CI run: trigger Jenkins `pmm3-ui-tests-nightly-gha` with `PMM_QA_GIT_BRANCH=<publish branch>` and link the `nightly-e2e-tests-matrix.yml` run it dispatches, or write "no PR-CI job selects `@nightly`; executed locally, ledger `<path>`" on the `Run:` line. Do not wait for CI before marking `done`.

## Tracker completion and cleanup

On control's own checkout, after the PR exists:

1. Update the row to `done` with the PR link. Edit it as an anchored byte-level substring replacement (`CLAUDE.md` house style), require `git diff --numstat -- <tracker>` to show `1 1` and `python -c "print(open('<tracker>','rb').read().count(bytes([13])))"` to print 0, then commit and push only the tracker.
2. Restore control's worktree:

```bash
git -C <control-worktree> restore --staged --worktree -- <paths...>
git -C <control-worktree> status --short        # must be empty
```

`restore --staged --worktree` relies on the intent-to-add entries from `git add -N`; never `git reset` first (the restore then aborts on the untracked file and leaves every other path dirty), and never `git clean -fd` (it removes whole directories). Inspect any path still showing by name before removing it.

3. Do not merge the publish branch into control; the next `main` merge delivers it.
4. Remove the publish worktree alongside `provisioning/setup.ts --teardown`: `git worktree remove ../pmm-qa-publish`.

If the PR opened but the tracker update failed, report publication as incomplete.

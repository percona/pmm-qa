# Branch and PR Workflow

Migration code is created on a dedicated branch from the refreshed control branch. The PR targets `main`.

## Control branch preflight

Before starting a migration, update the control branch from `main` and resolve any conflicts:

```bash
git switch <control-branch>
git fetch origin main
git merge origin/main
```

Refresh only the Playwright target graph from `e2e_tests/`:

```bash
cd e2e_tests
graphify . --update
find graphify-out -type f ! -name graph.json ! -name manifest.json -delete
cd ..
git add e2e_tests/graphify-out/
git commit -m "chore(graphify): refresh Playwright graph"
```

If the refresh produces no changes, do not create an empty commit. Keep this graph commit on the control branch; it must not appear in the migration PR. Never regenerate `codeceptjs-e2e/graphify-out/`.

## Migration branch

Recommended name:

```text
migrate-<category>-<test-name>
```

On control, change the selected tracker row to `in-progress` and commit that tracker-only change. Then create the migration branch from the refreshed control branch:

```bash
git switch <control-branch>
git add .claude/skills/codeceptjs-migration/tracker.md
git commit -m "chore(migration): mark <test-name> in progress"
git switch -c migrate-<category>-<test-name>
```

The control branch owns tracker and target-graph maintenance. The migration branch owns only migration code, source retirement, and required Playwright workflow changes.

## Before publication

Do not commit, push, retire the source, or open a PR until:

- initial review passed;
- MCP locator verification passed;
- migrated scenario execution passed;
- target-file regression passed when required; and
- final review returned `FINAL_REVIEW_PASS`.

## Source retirement

Retire only the selected CodeceptJS source after final review.

When the repository excludes renamed files from CodeceptJS discovery, use:

```bash
git mv codeceptjs-e2e/tests/<path>/<name>_test.js \
       codeceptjs-e2e/tests/<path>/<name>_migrated.js
```

Before committing, verify that the retired source no longer matches CodeceptJS test discovery. Do not retire unrelated files.

## Workflow coverage

Preserve every original CodeceptJS scenario tag in the migrated Playwright test. A destination execution tag may be added, but it must not replace or remove a source tag.

Leave existing CodeceptJS jobs and grep expressions unchanged, including when no active CodeceptJS scenario remains for a migrated tag.

For Playwright coverage:

- append the migrated tag to an existing Playwright job when its `setup_services` is sufficient; or
- create a Playwright job with the required setup when no compatible job exists.

Do not create a new Playwright job when an existing job provides the required setup.

## Commit and PR

Commit the migration changes on the migration branch:

```bash
git status --short
git diff --check
git add <migration-related-files>
git commit -m "migrate(<category>): <test-name> to Playwright"
```

Before pushing, rebase only the migration commits onto current `origin/main`. Using the control branch as the old-base boundary excludes its graph and tracker commits from the PR:

```bash
git fetch origin main
git rebase --onto origin/main <control-branch> migrate-<category>-<test-name>
git diff --check
git diff --name-only origin/main...HEAD
```

The final diff must contain no tracker or `graphify-out/` files. If the rebase requires conflict resolution or changes migration behavior, repeat the applicable validation and final review before publication.

Push and open the PR:

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

After the PR exists, switch to the control branch and:

1. update the row to `done`;
2. record the PR URL or number, GitHub Actions run URL, actual target and setup, review, MCP, test, and pre-migration graph-refresh results; and
3. commit and push only the tracker change.

Do not merge the migration branch into control. After the migration PR merges into `main`, a later `main` merge into control brings in the migration normally.

If the PR opened but the control-branch tracker update failed, report publication as incomplete and do not claim completion.

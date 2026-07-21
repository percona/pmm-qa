# Branch and PR Workflow

Migration code is created on a dedicated branch from `main`. The PR targets `main`.

## Branch

Recommended name:

```text
migrate-<category>-<test-name>
```

Before editing migration code, verify:

```bash
git fetch origin main
git switch -c migrate-<category>-<test-name> origin/main
```

A separate control worktree may be used for tracker updates when the tracker lives on a dedicated control branch. If no separate control branch exists, update the tracker in the same migration branch.

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

When appending a scenario to an existing Playwright test file, update its title to use that file's execution tag (for example, replace `@menu` with `@new-navigation`). Reuse the existing Playwright job when its `setup_services` is sufficient; do not create a new job or retain the source tag solely for parity.

If the migrated scenarios keep a tag used by an existing CodeceptJS workflow, add or update the matching Playwright runner job in the same workflow. Preserve the existing tag bucket and `setup_services` when the intent is to keep the workflow equivalent during partial migration.

When no active CodeceptJS scenario uses a migrated tag, remove that tag from the CodeceptJS grep expression. Keep a combined CodeceptJS job when its other tag terms still have active scenarios:

```bash
rg -n "Scenario\(|Data\(.*\)\.Scenario\(" codeceptjs-e2e/tests -g "*_test.js" | rg "<tag-a>|<tag-b>"
```

Skipped CodeceptJS scenarios (`Scenario.skip`, `xScenario`) do not block removing the old runner unless the migration explicitly chooses to preserve them as future coverage.

## Commit and PR

Inspect the final diff and include only migration-related changes.

```bash
git status --short
git diff --check
git add <migration-related-files>
git commit -m "migrate(<category>): <test-name> to Playwright"
git push -u origin HEAD
```

Open the PR:

```bash
gh pr create \
  --base main \
  --head "$(git branch --show-current)" \
  --title "migrate(<category>): <test-name> CodeceptJS to Playwright" \
  --body-file /tmp/migration-pr.md
```

The PR body must include:

- source path;
- actual target path;
- migrated scenarios;
- source and target files queried from existing graphs;
- `e2e_tests/graphify-out/` updated with `graphify . --update` when changed;
- setup used;
- static validation result;
- MCP locator verification result;
- execution commands and results;
- final review result.

## Tracker completion

After the PR exists:

1. update the row to `done`;
2. record the PR URL or number;
3. record actual target and setup;
4. record review, MCP, and test results;
5. push the tracker change.

If the PR opened but the tracker update or push failed, report publication as incomplete and do not claim completion.

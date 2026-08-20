# Skill Lessons

Open, sanitized lessons awaiting review.

## .claude/skills/codeceptjs-migration/run.md — provisioning/setup.ts omits PMM_DEBUG=1 that nearly every other PMM test environment sets by default

- Added: 2026-08-20
- Evidence: A migration's execution step failed reproducibly because pmm-managed.log accumulated far fewer lines per API call than the source test's thresholds assumed. Root cause was that the local Docker provisioner (`provisioning/setup.ts`) does not set `PMM_DEBUG=1` on the server container by default, unlike codeceptjs-e2e's and e2e_tests' own docker-compose files, cli/test-setup configs, qa-integration configs, and the documented Jenkins job default. Passing the existing `--server-env PMM_DEBUG=1` flag fixed it. Cost a full provision-run-investigate-reprovision-rerun cycle.
- Proposed change: In run.md step 3 ("Provision once locally for review"), note that `--server-env PMM_DEBUG=1` may be needed to match log-verbosity-dependent thresholds, since it is not a default and every other PMM test environment in this repo sets it.

## .claude/skills/codeceptjs-migration/run.md — GitHub Desktop auto-stashes uncommitted work on CLI branch switches

- Added: 2026-08-20
- Evidence: On a machine with GitHub Desktop open/watching the repo, switching branches via CLI git (not GitHub Desktop) repeatedly diverted uncommitted migration work into a GitHub-Desktop-created stash entry instead of carrying it to the new branch as expected. `git status` on the new branch looked clean, which read as "changes lost" until `git stash list` was checked and the work was recovered. Happened on more than one branch switch in the same session.
- Proposed change: Add a note to run.md's "Parent orchestration" section: after any branch switch during the workflow, check `git stash list` for a new GitHub-Desktop-style entry (`On <branch>: !!GitHub_Desktop<...>`) before concluding work is missing, and prefer committing or explicitly stashing changes yourself before switching branches rather than relying on git's default carry-over behavior.

## .claude/skills/codeceptjs-migration/branch-workflow.md — rebase-onto-origin/main can break on files that only exist on unmerged sibling PRs

- Added: 2026-08-20
- Evidence: In one migration, the publish rebase (`git rebase --onto origin/main <fork-point> <migrate-branch>`) hit a modify/delete conflict because a helper file the migration extended had been introduced by a different, still-open migration PR and did not yet exist on `origin/main`. The same class of issue recurred separately when a tool the workflow depends on for provisioning/teardown was also found missing from `origin/main` (only discovered reactively via a `MODULE_NOT_FOUND` error when trying to run it post-rebase), because it too only existed on unmerged history.
- Proposed change: Before the publish rebase in branch-workflow.md's "Commit and PR" section, add a check: for each file the migration created or modified, confirm with `git show origin/main:<path>` whether it already exists there; if not, decide up front (carry the full file into this PR vs. wait for the sibling PR to merge) instead of discovering the conflict mid-rebase.

## .claude/skills/codeceptjs-migration/run.md — `grep -P` is not reliably available in this environment and fails silently into a false-empty result

- Added: 2026-08-20
- Evidence: Following run.md step 1's tracker-drift check ("diff codeceptjs-e2e/tests/**/*_test.js against the tracker's Source column"), a `grep -oP` regex extraction via the Bash tool on this Windows/Git-Bash environment errored ("grep: -P supports only unibyte and UTF-8 locales") but still produced a 0-line output file, which read as "the tracker has zero matching rows" — a misleading false-empty signal — before being caught and redone with the dedicated Grep tool.
- Proposed change: In run.md step 1, note that the drift-check extraction should use the Grep tool (or an ERE-compatible pattern) rather than `grep -P`, since PCRE support isn't guaranteed in this environment and a failed `-P` call can silently yield an empty result that looks like a valid "no drift" answer instead of an error.

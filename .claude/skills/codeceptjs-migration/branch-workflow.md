# Branch and PR Workflow

Migration work **happens and is tested** on the control branch's worktree, and is **never committed there**. Control commits only what is genuinely control-only: the `origin/main` merge, both graph refreshes, the two tracker status changes, and branch-local gardener lesson entries. The migrated code is moved to a fresh branch cut from `origin/main`, committed there, reviewed there, and PR'd against `main`. Control receives it later through an ordinary `merge origin/main`.

Committing the code on control too would author it twice and take delivery a third time on the next merge from `main` - the cross-branch conflicts and scrubbing step this model exists to avoid.

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

Every part of that form is load-bearing:

- `git add -N` - an untracked new file is invisible to any `git diff` form until it is marked intent-to-add.
- `--binary` - without it a changed binary file (an `image-renderer` snapshot baseline, say) produces an unappliable stub.
- `-M` - without it a `git mv` (the source retirement) is invisible to the diff entirely.
- `--output=` - never a `>` redirect or a `|` pipe; both corrupt the patch silently (`AGENTS.md` section Shell and tooling notes).

`.claude/migration-observations/` is gitignored, so this is a checkpoint, not a commit. Note the snapshot on the timeline and delete it once the PR is open.

List only the paths `git status --short` shows right now, under their current names - never a remembered list from earlier in the phase, and never the pre-rename name of a file `git mv` already renamed. One missing path fails the whole `git add -N` invocation, so no path in that call gets intent-to-add and the checkpoint silently omits every new file, with no error downstream.

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

`npm ci` is a prerequisite of committing at all, not just of revalidation (`AGENTS.md` section Shell and tooling notes).

### Check for cross-migration dependencies first

For each path this migration touched, check `origin/main`:

```bash
git -C <control-worktree> add -N .
git -C <control-worktree> diff --name-only
git ls-tree --name-only origin/main -- <path>     # empty output = absent
```

Use `git ls-tree`, never `git show origin/main:<path>`: the mangled form reports **every** path as
absent, which under the rule below reads as "this migration depends on an unmerged sibling" - the most
consequential wrong answer this check can produce (`AGENTS.md` section Shell and tooling notes).

A path absent from `origin/main` depends on an earlier still-unmerged sibling migration - typically a shared helper. Decide explicitly whether to carry the full file into this PR or hold.

**File existence is not enough - compare the hunks.** Read the region being edited with `git ls-tree` (or PowerShell); quoting `git show "origin/main:<path>"` does not defeat the mangling above. A file can exist on `origin/main` while the block this migration edits does not, because a sibling's unmerged PR introduced it - the existence check reports the path as present and says nothing.

When the block is missing, treat it as a missing file: create it in this PR scoped to this migration's own needs, or hold. Never import the sibling's version - that pulls an unmerged migration's CI changes in and can reference tags with no tests behind them.

### Move the work across

Apply control's working-tree changes into the publish worktree, restricted to the paths this migration actually touched:

```bash
git -C <control-worktree> add -N -- <paths...>
git -C <control-worktree> diff HEAD --binary -M --output=<tmpfile> -- <paths...>
git -C ../pmm-qa-publish apply --3way <tmpfile>
```

List the paths explicitly rather than taking the whole diff, so an unrelated edit sitting in control's worktree cannot ride along. Never pipe the diff into `apply` and never redirect it with `>` - write it with `--output=` and apply from that file, for the same reason given in "Checkpointing uncommitted work" above.

Before the final gate, re-measure every number, filename, trigger and line reference in each commit body against the tree and state the command used; a correct number about the wrong tag is still wrong, and a message-only amend after the gate moves HEAD and costs a fresh gate attempt. Write the commit body from `git diff origin/main HEAD --stat` plus the per-file diffs, never from the phase handoff - a phase report names what the writer intended, the diff names what landed. Confirm every symbol you name with a scoped Grep first: a body naming a method that does not exist, or a section byte-identical to `origin/main`, costs an amend cycle after the final gate has passed.

A patch that fails to apply at all is the same cross-migration dependency surfacing earlier and more legibly than a merge conflict would. Resolve it the same way, before the PR exists. A patch that *appears* to apply can still be wrong: `git apply --3way` can land conflict markers in a file and still exit non-zero for that file while other files in the same patch apply cleanly - check `git -C ../pmm-qa-publish status --short` for `U` entries and `git -C ../pmm-qa-publish grep -n '^<<<<<<< '` for stray markers before committing anything in the publish worktree.

**This repository squash-merges, and the squash body is the concatenation of the branch's commit messages - not the PR body.** A false statement in a commit body reaches `main` verbatim; the PR body does not. Consequences:

- Correct a defect in an already-pushed **non-tip** commit body in the *next* commit's body, naming the commit and quoting the false clause - squash concatenates both, so the claim and its retraction cannot be separated. Do not force-push for this. Amending a tip commit is allowed, but weigh it against cancelling an in-flight CI matrix.
- Re-read the PR body against `git diff -M origin/main..HEAD` before requesting review, and again after any push that changes what shipped. A corrective commit silently falsifies it.
- Do not hand-trim the pre-filled bullets in the merge box; that drops a retraction while keeping the claim.

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

Most of `.claude/` is on `origin/main` and present in this worktree: `settings.json`, `hooks/`, `agents/`, and `scripts/` (`pmm-ui-login.js`, `pw-record.js`, `pw-screenshot.js`, and their `lib/`).

Control-only, and therefore absent here: `check-migration-conventions.sh`, `run-migration-single-test.sh`, `verify-migration-locator.mjs`, `validate-migration-scripts.sh`, plus the `codeceptjs-migration` skill and its three agents.

Invoke any of those four scripts by absolute path on the control worktree, pointed at the target files here - never assume a local copy. Pass every changed file, workflow YAML included; the script's diff-scoped checks compare each file against `origin/main` inside its own worktree and refuse to run when that ref is missing:

```bash
bash "<control-worktree>/.claude/scripts/check-migration-conventions.sh" ../pmm-qa-publish/e2e_tests/tests/<file>.test.ts ../pmm-qa-publish/e2e_tests/pages/<pom>.ts ../pmm-qa-publish/.github/workflows/<edited>.yml
```

For `run-migration-single-test.sh`, invoke the test runner directly instead, against the same live environment and credential pair:

```bash
cd ../pmm-qa-publish/e2e_tests
PMM_MIGRATION=1 PMM_UI_URL='<the parent's PMM_UI_URL>' ADMIN_PASSWORD='<the parent's ADMIN_PASSWORD>' \
  npx playwright test <target-test-file> --workers=1
```

Both values are placeholders - use the pair the parent handed over, which is frequently NOT
`admin`. A test that logs in through the UI needs a non-default admin password (see `orchestration.md`
step 3), so hardcoding `admin` here reruns the proof against a server that will deadlock on the
default-password interstitial. `PMM_MIGRATION=1` is not decoration either: `playwright.config.ts`
does `dotenv.config({ override: !process.env.PMM_MIGRATION })`, so without it `e2e_tests/.env`
silently overrides both values - and `.env` routinely points at an unrelated remote PMM.

Before writing "could not be verified" into a PR body, check whether the repository's own CI already
covers it. `.claude/hooks/lint-changed.sh` runs `actionlint` over `.github/workflows/*.yml` behind the
`Lint` check, so a migration's workflow IS schema-checked on the PR even when `actionlint` cannot be
installed locally. A false open risk costs reviewer attention and understates the evidence.

Also run `python support_scripts/generate_readme.py --check` from the publish worktree's root. There is no npm script for it; `npm run readme:check` does not exist and its missing-script exit 1 reads like a failing check.

If the test selects state by index, empty that state before this run as well - it is a second run against the same environment.

A freshly created `git worktree` has **no `node_modules`** - run `npm ci` in its `e2e_tests/` first,
and do not read `$?` after a pipe (`AGENTS.md` section Shell and tooling notes).

If the **parent** commits a fix onto the publish branch - which is legitimate; it is the parent's branch
to correct - that commit has had no independent reviewer. Name it in the final-gate handoff as
parent-authored and unreviewed, and ask the gate to check it as critically as the rest. A gate only
scrutinises such a commit when it is told to.

## Workflow coverage

Committed on the publish branch, before the final review, so the gate can verify it.

Preserve every original CodeceptJS scenario tag in the migrated Playwright test. A destination execution tag may be added, but it must not replace or remove a source tag.

Leave existing CodeceptJS jobs and grep expressions unchanged, unless this migration is the one that empties them - see below.

### First ask whether a new runner is needed at all

When this migration retires the last CodeceptJS consumer of a **runner** workflow, the default is to
**convert that runner in place** - same filename, same server-setup steps - not to add a parallel
Playwright one beside it. Adding one leaves the original with no caller, duplicates whatever server
setup it owns, and forces a keep-or-delete argument in review that the conversion never raises.

Convert when the retired test is the runner's only consumer. Add a new runner only when the old one
still has other callers, and say which they are.

A conversion is usually three edits: point the dependency install at `e2e_tests/`, swap the
`codeceptjs run` invocation for `npx playwright test --grep`, and set any URL the harness needs.
Rename its selection input `tags_for_tests` -> `pmm_test_flag` as part of the conversion: that key is
what the per-scenario selectability check keys on, and a Playwright job left under the CodeceptJS key
is invisible to it.

### Never interpolate a workflow input into a `run:` block

`${{ env.X }}` inside `run:` is substituted into the script **before** the shell parses it, so an input
that reaches it can close the quote and execute arbitrary commands with the job's `GITHUB_TOKEN`.
Any value already declared in the job's `env:` must be read as a shell variable instead:

```yaml
run: npx playwright test --grep "$PMM_TEST_FLAG"      # not "${{ env.PMM_TEST_FLAG }}"
```

This applies to every `run:` line a migration writes or rewrites. Pre-existing interpolations in lines
the migration does not touch are repo-wide hardening, not this PR's business - say so rather than
fixing one file asymmetrically.

### Deriving a new runner workflow from two parents

When coverage requires a new workflow assembled from two existing ones, the first check is a **parsed
set diff of their `env:` blocks**, not a top-to-bottom read. Any key present in **both** parents and
absent from the child is a defect until proven otherwise: a missing `CLIENT_VERSION` makes
`pmm-framework` fall back to stock `3-dev-latest`, so an FB job goes green while testing the wrong build.

Then widen it to the real superset: **referenced but never defined**. Walk every `${{ env.X }}` in the
child and confirm X is declared. Parse with a YAML library across workflow-, job- and step-level `env:`
blocks; a line-scan or a bare grep misses step-level keys. Two false-positive classes to expect rather
than chase: systemd `Environment=` directives inside a heredoc (referenced as escaped `\${...}`, and
expanded by systemd, not the shell) and variables introduced by `. /etc/os-release`.

A key present in only ONE parent is usually inert - it belongs to machinery the child deliberately did
not port (Launchable subsetting, Zephyr reporting, CodeceptJS-only inputs). Say which, do not just drop it.

### First: enumerate what consumes the source today

Every coverage decision below depends on this, so establish it before deciding anything.

Name the **workflow file**, never the word "nightly" - it denotes two different workflows. `e2e-tests-matrix.yml` carries both a `pull_request` trigger and a `schedule: cron '0 2 * * *'`, so its jobs run nightly too; `nightly-e2e-tests-matrix.yml` is `workflow_dispatch`-only, fired by Jenkins against an externally-managed PMM Server. Both run on a nightly cadence by different mechanisms. State each candidate job's trigger block as read, and check for a job-level `if:` gate rather than assuming a scheduled job is gated.

Consumers also exist **outside** `.github/workflows/`. `codeceptjs-e2e/package.json` defines per-tag scripts (`e2e:grafana-pr` runs `codeceptjs run -c pr.codecept.js --grep '@grafana-pr'`) plus a catch-all `e2e` script that excludes only `@not-ui-pipeline`/`@not-pr-pipeline`. Nothing inside pmm-qa invokes those, so the caller is cross-repository - percona/grafana CI running PMM's suite. Such a script invokes CodeceptJS only, so retiring the source drops coverage a new Playwright job cannot restore.

So for each migrated tag, state either its consumers or that a cross-repository caller could not be ruled out. **A tag with no workflow consumer must not be reported as having no consumer** - that is what makes a live tag look decorative.

When two coverage shapes are arguable, stop reasoning in prose and read the precedent: `git log -- .github/workflows/` and the last migration's actual diff shows which surfaces the previous retirement moved and why.

When retiring a CodeceptJS source, check every job whose grep matches its title tags, not only the one this migration touches. Report the tagged and active counts, counting by tag rather than by file and matching `Scenario(`, `Scenario.skip(`, `xScenario(` and `Data(...).Scenario(`. If no active matches remain, delete the job in the same commit as the replacement Playwright coverage - empty selections otherwise pass silently.

An under-count deletes a job that still tests something; an over-count leaves a vacuous job reporting green forever. Cross-check the number against a plain tag grep before acting on it; a `^`-anchored regex without the `m` flag under-counts by an order of magnitude and nothing downstream contradicts it.

**Before widening a job's grep, list what else the new tag selects and who owns it.** `--list --grep` the current expression, then the widened one, and account for every test in the difference: any that belong to another job are being switched on by this PR. When the tag is a broad bucket other jobs' tests also carry, use a narrower sub-bucket tag (`@valkey-nightly`, `@pbm-nightly`) rather than a wider grep, and make that retag in this PR, not as a follow-up. `@nightly` is the Playwright nightly alternation on `main`; confirm on `origin/main` before editing, and check what it selects rather than adding to it (`SKILL.md` Workflow coverage). Never route a load-generating test (a 10k-request log warm-up, say) at the shared Jenkins-managed nightly server; run it in FB and PR CI only.

For Playwright coverage, add it on the surfaces the enumeration above showed the *source* actually runs on. Only when the source is genuinely in a nightly grep does the append-to-nightly default apply; appending otherwise manufactures nightly coverage that never existed while leaving the surface the source really ran on with zero Playwright coverage once the tag retires - the exact "coverage vanishes on retirement" failure these rules exist to prevent.

On a surface the source genuinely ran on, and only there, append the migrated tag to that surface's existing `test_execution_playwright` matrix entry - a one-line append to the existing `tags_for_tests` entry, since that job and its counter are already established on `main`. Do not add a new Playwright job block.

Two cases take a new job instead, both mirroring the retiring CodeceptJS job's setup verbatim: no Playwright job of any kind exists yet for this migration's CI surface, or the surface is `fb-e2e-suite.yml`, which has no `test_execution_playwright` entry to append to (see The FB-suite case below).

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
- state the tag's FB consumers, before and after the edit, in the handoff; and
- do not also add the tag to `e2e-tests-matrix.yml`: it already calls `fb-e2e-suite.yml` as `fb_tests` on every PR run, so a second entry runs the same tests twice.

Do not treat "the `@fb-settings` job still runs" as evidence of coverage. The question is whether *this migration's scenarios* are still selected somewhere in that file, which only `--list --grep` against the job's own expression answers.

### Check selectability per scenario and across every consumer

A source file's scenarios rarely all carry the same tags, so the file's union of tags is not what CI selects on. Verify with `npx playwright test --list --grep '<expression>'` in both directions:

- every migrated scenario is now selected by some Playwright job; and
- every tag the edited job already carried still selects exactly what it selected before.

Capture each `--list --grep` selection to a sorted file and report the added and removed sets from `comm -13`/`comm -23`, never two totals: a union that grows by one can hide N pre-existing overlaps, and the same two totals cannot say which files a job newly acquired. List any newly added alternative on its own as well as in the union.

Two counting forms return a plausible wrong number with exit 0: `git grep <rev> -- 'codeceptjs-e2e/tests/**/*_test.js'` (git's default pathspec `**` does not span directories; use a directory pathspec filtered with `grep '_test\.js$'`), and parsing `--list` output for `Total: N tests`, which misses the singular `Total: 1 test`. Measure every tag or file count twice by different mechanisms and state both.

Bound the reverse direction first. Run `git diff --name-status origin/main HEAD -- e2e_tests/tests/`: when it shows no modified test file (only additions), no existing expression's selection can change except by newly matching the added file, so the whole reverse check reduces to listing each existing expression once and confirming zero hits for that filename. Do not re-derive per-scenario selections for expressions nothing could have moved.

Then check **every** consumer, not just the job you edited - tags are reused across rows, so a scenario's tag can already be selected by a job written for an earlier migration that does not provision what this scenario needs. For each tag on each migrated scenario, enumerate every selecting job (`grep -n "pmm_test_flag\|tags_for_tests" .github/workflows/*.yml`) and confirm each one's `setup_services` covers what the scenario needs. Selection is not executability.

A migrated scenario that matches no destination grep is coverage that vanishes the moment the source is retired, and nothing about a green test run reveals it. A migrated scenario selected by a job that cannot supply its required services is worse: it may fail (swallowed by the `|| true` on the run step, reading as flake) or silently pass while asserting less than the source did.

**When the edit newly selects tests outside the migrated file, run them.** Run the **edited job's own full grep expression** once, at the job's own worker count - not just the newly-selected tests. That reproduces what CI selects, in CI's order and concurrency, in one run. Report the command as the coverage-edit execution evidence. Selection evidence is not execution evidence, and `|| true` masks the difference: a newly-selected test the environment cannot support reads as flake rather than as a defect this migration introduced.

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

Write every commit message with `git commit -F -` and a quoted heredoc, never `-m "..."`. Migration
messages routinely name backticked identifiers, and bash command-substitutes a backtick inside a
double-quoted `-m` argument: the message is mangled, the shell reports a syntax error from the middle of
your prose, and the leftover words are passed to git as pathspecs.

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

The PR body is this template and nothing more, 25 lines and 1,500 characters at most. Evidence, reasoning, review history, environment stories and accepted deviations stay in the ledger and the timeline; a reviewer who wants them asks. A body over the cap is a finding at the final gate.

```markdown
Migrates `<source path>` to `<target path>`.

**Scenarios:** PMM-Txxxx, PMM-Tyyyy (N rows) - tags `@a @b` preserved.
**Setup:** `<setup_services>`; local Docker via provisioning/.
**Coverage:** <one line: which job/tag selects them now, e.g. "appended @x to nightly Playwright matrix; FB job `settings` added">.
**Retired:** `<source>_test.js` -> `_migrated.js`; <job deleted, if any>.
**Deviations:** <one line per deliberate change from the source, or "none">.
**Run:** <Actions run URL>
```

Write it from the diff, not from the handoff. No emoji headings, no "worth reading" sections, no restating what the diff shows.

## Attach CI execution

PRs to `main` auto-trigger `e2e-tests-matrix.yml`. After `gh pr create`, resolve the workflow run and link it on the PR:

```bash
PR_NUM=$(gh pr view --json number -q .number)
RUN_URL=$(gh run list --workflow e2e-tests-matrix.yml --branch "$(git branch --show-current)" --limit 1 --json url -q '.[0].url')
[ -n "$RUN_URL" ] && gh pr comment "$PR_NUM" --body "GitHub Actions: ${RUN_URL}"
```

Include the run URL in the PR body. Do not wait for CI to finish before marking `done`.

## Tracker completion and cleanup

After the PR exists, on control's own checkout (never switched away from - only the isolated publish worktree touched a different branch):

1. update the row to `done`;
2. record the PR URL or number, GitHub Actions run URL, actual target and setup, review, MCP, test, and pre-migration graph-refresh results;
3. commit and push only the tracker change. Edit the row as an **anchored substring replacement**, never a whole-file rewrite, and byte-level: `open(..., 'rb')`/`replace`/`open(..., 'wb')` or `sed -i`, never Python `read_text`/`write_text`, which translate `
` to `os.linesep` on Windows and flip every line of the LF-only `tracker.md` to CRLF with only the insertion count as the tell. Before staging, require `git diff --numstat -- <tracker>` to show `1 1`, and a zero carriage-return count from `python -c "print(open('<tracker>','rb').read().count(bytes([13])))"`. Never use a shell CR literal to check this: it does not survive quoting or a heredoc, and the resulting empty grep pattern matches every line, reading as a total CRLF flip that never happened; and
4. restore control's worktree to clean.

Step 4 is not optional. The migration's edits are still sitting there uncommitted, and leaving them means the next migration starts on top of them and sweeps them into its own patch:

```bash
git -C <control-worktree> restore --staged --worktree -- <paths...>
git -C <control-worktree> status --short
```

`restore --staged --worktree` alone is necessary and sufficient, and depends on the intent-to-add entries from `git add -N` still being in the index. Never `git reset` them first: that turns an intent-to-add file back into a plain untracked one, `restore` then fails with `pathspec ... did not match any file(s) known to git`, and the **entire** invocation aborts - the new file survives and every other path goes un-restored.

With the entries intact, one `restore --staged --worktree` deletes intent-to-add new files (binaries included), reverts modified files, exits 0, and leaves `git status --short` empty.

Do not use `git clean -fd` here either, even scoped to specific paths. If the migration created a new directory, `clean -fd` removes the whole directory rather than an enumerated file list, and it will delete anything else placed there since - with no backup, because by this point the `.patch` checkpoint has already been deleted and nothing was ever committed on control. If a path still shows after the restore, inspect it by name before removing it.

Verify the status output is empty before reporting completion.

Do not merge the publish branch into control. After the migration PR merges into `main`, a later `main` merge into control delivers it.

Remove the publish worktree as part of terminal-path cleanup, alongside `provisioning/setup.ts --teardown`:

```bash
git worktree remove ../pmm-qa-publish
```

If the PR opened but the control-branch tracker update failed, report publication as incomplete and do not claim completion.

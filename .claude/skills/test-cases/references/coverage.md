# Coverage search and placement

Coverage is an assertion that would fail on the candidate defect, not a matching title, command, ticket key, Zephyr status, or setup step.

## Search order

1. Search `origin/main`, not only this checkout: the working branch can lag it by many commits, including CI restructures. `git fetch origin main` first, then read files with `git show origin/main:<path>` and list them with `git ls-tree -r --name-only origin/main`.
2. Run `git rev-parse --is-shallow-repository`. Only when it prints `false`, run `git log --all --grep PMM-XXXX` because coverage may have landed with the fix. In a shallow clone skip the log search — its empty result is not evidence of absence, so cite only the tree searches.
3. Search the exact API field, endpoint, CLI flag, metric, configuration key, or persisted value with `rg --hidden -g '!.git/**'`. Hidden paths matter: CI lanes live under `.github/`. Use only `-n`, `-l`, `-g`, and `--hidden` — `rg` recurses by default and `-r` is `--replace`, which rewrites matched text in the output to look like source. Re-run any hit whose matched text differs from the query.
4. Search the feature or page name only after identifiers.
5. Read the full setup and assertions of every plausible hit.
6. Search Zephyr with the `zephyr` skill's read-only `search`, `list`, and `get` operations.

Treat broad search results as a candidate pool. Narrow terms before classifying coverage. A skipped scenario, commented table, or loop over an empty data set is not coverage.

## Ledger

Record one row per behavior inventory entry in the notes file: the exact terms searched, the hits read, the class from the table below, and for `Covered` or `Extend` the file and assertion. Every identifier the change introduces or widens is a term: header, path, config key, flag, metric, error text. A tag or feature name alone is not a search. An entry with no row is unclassified, and an unclassified entry cannot be dropped as covered.

## Classification

| Class | Meaning | Decision |
|---|---|---|
| Covered | Existing assertion would fail on the named defect | Do not create a case; cite the key and assertion |
| Extend | Same action exists but the assertion is weaker, or fails on the defect only by chance | Add the missing assertion to that flow |
| Adjacent | Similar fixture or subject, different action or result; or a product test whose run is not confirmed | New case; reuse setup where practical. For a product test that will run on every build once merged, a Finding asking to confirm its run before sign-off may replace the case — say which you chose |
| None | No executable assertion for the behavior | New case if it passes the strong-case gate |

A `Covered` row states what the cited assertion sees on the base branch — from base-branch code, or from a CI failure recorded before the fix — and why that differs from the fixed build. A developer test that seeds only the data the old code already handled passes on the broken build and is not coverage, however close its name.

A rejected-write test that asserts only the refusal — the status code or error — is `Extend`: add the read that shows state unchanged, even when the refusal happens before the backend, because a later regression can move it after the write.

An assertion that fails on the defect only under data or timing the test does not control — a table check that trips only when a node's load happens to be zero — is `Extend`: make it deterministic.

A Zephyr `Automated` status is not coverage. Find the test that carries the key on `origin/main` and read its assertions; recent cases are routinely marked Automated before, or without, a merged test.

## PMM suites

Starting points only — confirm each against `AGENTS.md` and `origin/main` before citing or placing, because suites move during the CodeceptJS → Playwright migration.

| Behavior | Search/placement | Notes |
|---|---|---|
| UI, API, dashboard, inventory, QAN | `e2e_tests/tests/` | Active Playwright suite; preferred for new UI and API coverage |
| HA and the pmm-ha chart | `e2e_tests/tests/ha/` | Runs in `ha-e2e-tests.yml` |
| `pmm-admin` and `pmm-agent` | `cli/tests/` | Active Playwright-runner CLI suite; `e2e_tests/tests/cli/` holds a few pmm-agent runtime scenarios |
| Legacy UI | `codeceptjs-e2e/tests/` | Still holds most legacy keys; match both `*_test.js` and `*_migrated.js`. Extend an existing flow only; new UI coverage belongs in `e2e_tests/` |
| Package install or upgrade | `package_tests/` | Ansible cases; keys may appear in header comments |
| Helm chart rendering | `k8s/helm-test.bats` | BATS, run by `helm-tests.yml`; no established Zephyr-key title convention |
| Post-upgrade checks | `support_scripts/check_upgrade.py` | Driven from Jenkins upgrade jobs, not by any pmm-qa workflow |

For Playwright, page objects live in `e2e_tests/pages/`, API helpers in `e2e_tests/api/`, and endpoint constants in `e2e_tests/helpers/apiEndpoints.ts`. An endpoint constant proves availability, not coverage; find a test that calls it and asserts the result.

## Tests shipped with the implementation

A test the implementation pull request adds inside the product repository is coverage once you confirm it runs; subtract every candidate it asserts except the ticket's own reproduction (scenario-selection.md, Regression), and cite it the way you would a pmm-qa test.

Confirm from how its suite selects what to run, and name that evidence: the workflow and its trigger, the Makefile target, or the Jenkins job. `api-tests/Makefile` discovers packages with `find -name '*_test.go'`, so a new package needs no registration, but percona/pmm's `api-tests` run from Jenkins feature builds rather than on the pull request. A suite gated by an explicit list or tag covers only its listed entries. Check what the suite holds fixed for its whole run — a configuration it enables everywhere, or a flag a test passes to skip a code path, is a branch it leaves untested. A package-level unit test is not coverage for a defect in the composition of several components. A test whose run you cannot confirm is `Adjacent`.

## Effective constants

Before writing a precondition that depends on a timeout, interval, retention, serving path, base path, or cookie path, read that value's effective setting in this product's configuration. Never assume the upstream default: a case parameterized to one can pass on the broken build.

Where the value is observable only at runtime, resolve it as a design-time preflight and write the discovered value into the Precondition, or report it as a Finding. Make it a step only when that step has its own expected result.

## Execution reality

A lane is a workflow job that can run the case as written. Find it on `origin/main`: list `.github/workflows/`, then for each candidate job confirm all three —

1. it provisions the preconditions: the services, versions, and topology in `setup_services`, the `pmm-framework` arguments, or the chart values;
2. its test selection picks the case up: `pmm_test_flag` or `tags_for_tests` matches the tag the test would carry. A shard that provisions databases but selects no tests is not a lane;
3. its trigger: pull request, nightly, or dispatch only.

Search every workflow, not only the matrices — HA, Helm, CLI integration, FB, package, and per-database workflows all host lanes. Some upgrade and RC lanes live in `Percona-Lab/jenkins-pipelines`, so absence from GitHub Actions is not proof that a tag never runs.

For `Needs automation`, name the workflow file and job or matrix shard. When a case needs an estate no single job provides, split it: `Needs automation` on the job that hosts the most of it, the rest as its own case, each named. A version, dataset shape, or tool the lane must produce goes in Preconditions.

When no lane can run a deterministic, valuable case, mark it `Automation candidate — infra gap` and name the missing lane or helper, and report the gap as a Finding; record the workflow search in the notes. `Manual` is for a case that is manual by nature — a subjective or visual judgement, a race, a multi-day wait, a destructive estate — never for a missing lane.

## Zephyr

Use Zephyr only for deduplication during design. A `search` response with `truncated: true` cannot prove absence: narrow the query, constrain it to the feature folder, or use `list` on that folder. If the relay is unavailable, report that the check was skipped; if every useful scan remains capped, report deduplication as inconclusive. Skip the scan entirely when the caller will create a new case regardless of existing ones — Test Runner's automation step does. Never create or update a case during design; publishing happens only in the skill's step 10, after approval.

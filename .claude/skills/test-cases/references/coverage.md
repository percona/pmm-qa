# Coverage search and placement

Coverage is an assertion that would fail on the candidate defect, not a matching title, command, ticket key, or setup step.

## Search order

1. Run `git rev-parse --is-shallow-repository`, then `git log --all --grep PMM-XXXX` because coverage may have landed with the fix. In a shallow clone an empty result is not evidence of absence; cite only the working-tree `rg` searches.
2. Search the exact API field, endpoint, CLI flag, metric, configuration key, or persisted value with `rg --hidden -g '!.git/**'`. Hidden paths matter: CI lanes live under `.github/`. Use only `-n`, `-l`, `-g`, and `--hidden` — `rg` recurses by default and `-r` is `--replace`, which rewrites matched text in the output to look like source. Re-run any hit whose matched text differs from the query.
3. Search the feature or page name only after identifiers.
4. Read the full setup and assertions of every plausible hit.
5. Search Zephyr with the `zephyr` skill's read-only `search`, `list`, and `get` operations.

Treat broad search results as a candidate pool. Narrow terms before classifying coverage. A skipped scenario, commented table, or loop over an empty data set is not coverage.

## Classification

| Class | Meaning | Decision |
|---|---|---|
| Covered | Existing assertion would fail on the named defect | Do not create a case; cite the key and assertion |
| Extend | Same action exists but the assertion is weaker | Add the missing assertion to that flow |
| Adjacent | Similar fixture or subject, different action or result | New case; reuse setup where practical |
| None | No executable assertion for the behavior | New case if it passes the strong-case gate |

## PMM suites

| Behavior | Search/placement | Notes |
|---|---|---|
| UI, API, dashboard, inventory, QAN, HA | `e2e_tests/tests/` | Active Playwright suite; preferred for new UI and API coverage |
| `pmm-admin` and `pmm-agent` | `cli/tests/` | Active Playwright-runner CLI suite |
| CLI-backed product integration | `e2e_tests/tests/cli/` | Second CLI-related area inside the active UI/API workspace; includes pmm-agent runtime scenarios |
| Legacy UI | `codeceptjs-e2e/tests/` | Extend an existing flow only; new UI coverage belongs in `e2e_tests/` |
| Package install or upgrade | `package_tests/` | Ansible cases; keys may appear in header comments |
| Helm chart | `k8s/helm-test.bats` | BATS; no established Zephyr-key title convention |
| Post-upgrade checks | `support_scripts/check_upgrade.py` | Check before proposing another upgrade assertion |

For Playwright, page objects live in `e2e_tests/pages/`, API helpers in `e2e_tests/api/`, and endpoint constants in `e2e_tests/helpers/apiEndpoints.ts`. An endpoint constant proves availability, not coverage; find a test that calls it and asserts the result.

## Effective constants

Before writing a precondition that depends on a timeout, interval, retention, serving path, base path, or cookie path, read that value's effective setting in this product's configuration. Never assume the upstream default: a case parameterized to one can pass on the broken build.

Where the value is observable only at runtime, resolve it as a design-time preflight and write the discovered value into the Precondition, or report it as a Finding. Make it a step only when that step has its own expected result.

## Execution reality

Check the candidate test's tags against `.github/workflows/`. Some upgrade and RC lanes live in `Percona-Lab/jenkins-pipelines`, so absence from GitHub Actions is not proof that a tag never runs.

A lane must also produce the required engine/client version, dataset shape, topology, and tools. Put version and data requirements in Preconditions. If no lane can run the case at all, report that as a Finding and route the case to Manual only rather than dropping it.

## Zephyr

Use Zephyr only for deduplication during design. A `search` response with `truncated: true` cannot prove absence: narrow the query, constrain it to the feature folder, or use `list` on that folder. If the relay is unavailable, report that the check was skipped; if every useful scan remains capped, report deduplication as inconclusive. Never create or update a case during this skill.

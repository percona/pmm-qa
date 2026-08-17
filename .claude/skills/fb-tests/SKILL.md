---
name: fb-tests
description: Analyze Percona-Lab/pmm-submodules FB Tests via REST check-runs, JNKPercona build comments, flaky triage, and map failures to pmm-qa GitHub workflow runners. Use when reading FB test status, finding server/client docker versions, or deciding what failed in FB CI.
---

# PMM FB Tests

**pmm-submodules** — access via the **GitHub MCP tools** (`mcp__github__*`; see the `repos` skill's "GitHub access — MCP-first" tool map). Routine sessions have **no `gh`**, so the `gh api` recipes below are a fallback only where `gh` actually exists. **Never** `git clone` this repo.

## Collect checks

Read checks with the GitHub MCP `pull_request_read` (`method: get_check_runs`, owner `Percona-Lab`, repo `pmm-submodules`, `pullNumber: <SUBMODULES_PR>`) — it resolves the head SHA for you and returns the check runs. `gh pr checks` is GraphQL-backed and **403s** anyway. Where `gh` exists, the repo-scoped REST recipe below is an equivalent fallback; `group_by(.name) | max_by(.started_at)` keeps only the **latest** run per check (so a passing rerun supersedes its old failure):

```bash
SHA=$(gh api repos/Percona-Lab/pmm-submodules/pulls/<SUBMODULES_PR> --jq .head.sha)
gh api "repos/Percona-Lab/pmm-submodules/commits/$SHA/check-runs?per_page=100" \
  --jq '.check_runs | group_by(.name) | map(max_by(.started_at))[] | {name, status, conclusion}'
```

- **Latest FB build only** — older comments/checks are invalid
- Ignore JNKPercona "API tests have succeded/failed" comments

## JNKPercona build comment (latest only)

```bash
gh api repos/Percona-Lab/pmm-submodules/issues/<PR>/comments \
  --jq '[.[] | select(.user.login == "JNKPercona" and (.body | contains("Staging instance:"))) | {created_at, body}] | sort_by(.created_at) | .[-1]'
```

| Field in comment | Use as |
|------------------|--------|
| Server docker | `DOCKER_VERSION` / `PMM_SERVER_IMAGE` |
| Watchtower docker | `WATCHTOWER_VERSION` |
| Client tarball | `CLIENT_VERSION` |
| Client docker | **ignore** for `CLIENT_VERSION` |

## Map failures to workflows

| Failed check pattern | pmm-qa workflow | Runner |
|---------------------|-----------------|--------|
| `@* UI tests` | `fb-e2e-suite.yml` | `runner-e2e-tests-codeceptjs.yml` (legacy) or `runner-e2e-tests-playwright.yml` (`e2e_tests/`) |
| `CLI tests *` | `fb-integration-suite.yml` | `runner-integration-cli-tests.yml` |

Extract `setup_services` / `tags_for_tests` or `services_list` / `cli_tag` from the failed job inputs.

## Flaky triage

Mark each failure: **relevant** (overlaps ticket) / **flaky** / **out of scope**. Only expand manual scope for **relevant** failures.

## Green gate (FB Reporter)

Fail closed: only "green" when there's at least one check and **every** latest
check completed with a success-ish conclusion. `cancelled`, `null`, still-running,
or an empty set all read as not-green.

```bash
SHA=$(gh api repos/Percona-Lab/pmm-submodules/pulls/<PR> --jq .head.sha)
gh api "repos/Percona-Lab/pmm-submodules/commits/$SHA/check-runs?per_page=100" --jq '
  .check_runs | group_by(.name) | map(max_by(.started_at)) as $latest
  | ($latest | length) as $n
  | ([ $latest[] | select(.status=="completed" and (.conclusion|IN("success","skipped","neutral"))) ] | length) as $ok
  | if $n>0 and $ok==$n then "green" else "not-green (\($ok)/\($n) clean)" end'
```

Anything but `green` → do **not** attach the screenshot to Jira; rerun the failed
jobs and re-check first.

## Detail

See [references/fb-tests.md](references/fb-tests.md) (full templates and screenshot workflow).

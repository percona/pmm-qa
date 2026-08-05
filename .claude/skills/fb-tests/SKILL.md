---
name: fb-tests
description: Analyze Percona-Lab/pmm-submodules FB Tests via gh pr checks, JNKPercona build comments, flaky triage, and map failures to pmm-qa GitHub workflow runners. Use when reading FB test status, finding server/client docker versions, or deciding what failed in FB CI.
---

# PMM FB Tests

**pmm-submodules** — use `gh` only. **Never** `git clone` this repo.

## Collect checks

```bash
gh pr checks <SUBMODULES_PR> -R Percona-Lab/pmm-submodules
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

```bash
gh pr checks <PR> -R Percona-Lab/pmm-submodules 2>&1 | grep -E '\tfail\t'
```

Any output → do **not** attach green screenshot to Jira.

## Detail

See [references/fb-tests.md](references/fb-tests.md) (full templates and screenshot workflow).

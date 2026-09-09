# `qa-integration/`, `package_tests/`, `terraform/` — provisioning

`pmm-framework` (bash) and the Ansible playbooks stand up PMM Clients and monitored databases on the `pmm-qa` Docker network. Most suites assume they already ran, so a defect here fails every downstream job — review it harder than test code, not softer.

Entry points: [pmm-framework/README.md](../../../../qa-integration/pmm_qa/pmm-framework/README.md), [ARCHITECTURE.md](../../../../qa-integration/pmm_qa/pmm-framework/ARCHITECTURE.md).

## Bash

| Rule | Why |
|---|---|
| `set -euo pipefail` at the top | a silent failure here surfaces as a mystery test failure an hour later |
| `cd` without `\|\| exit` (SC2164) | the rest of the script runs in the wrong directory |
| Declare and assign separately (SC2155) | `local x=$(cmd)` hides the command's exit code |
| Bashism under `#!/bin/sh` (SC3xxx) | works on the dev box, fails on a different runner. Match the shebang to the syntax, or change the shebang |
| Quote every expansion | paths and versions arrive from CI inputs |
| An argument with an obvious default gets one | a new mandatory argument breaks every existing caller. Simplify the branch too — an `if/else` beats a `case` for two values |
| Renaming a file or a variable other setups source | grep the whole repo before accepting |
| Version pins in one place | scattered per-task versions make upgrades a hunt |
| Preflight checks for combinations that clash | e.g. `pdpgsql` + `pgsql` with replication |

## Timeouts and retries

- An inner `timeout` must fire **before** the wrapping `nick-fields/retry` `timeout_minutes`, or the action's tree-kill cannot signal a root-owned `sudo` child and dies with `kill EPERM` before any retry decision — a hang then becomes unretryable.
- `retry_on: 'any'`, not `'error'`, if a timeout should be retryable.
- Retry is a backstop, not the stop condition. If a loop only ends because a timeout kills it, the loop is wrong.
- A cleanup hook that must survive a partial failure keeps `|| true`; one that gates removing state must not — check which one the diff is.

## Ansible and Docker

- Idempotent tasks: a second run must not fail or duplicate.
- No secrets in playbooks, `user_data`, or committed state.
- Compose files: `docker compose config -q` validates them; there is no linter. Distinct container names per parallel job — a collision is what makes tests need `serial` mode.
- Dockerfiles (3, all under `qa-integration/pmm_psmdb-pbm_setup/`): `hadolint`.

## Terraform

- `terraform fmt -check -recursive` and `terraform validate` are clean today; keep them clean.
- No permissive default for an input that widens exposure — make it a required variable so the choice is visible at the call site.
- A throwaway instance keeps its self-destruct path intact: an `ERR` trap that tears down on failure, and the on-box TTL as the backstop.

# Skill Lessons

Open, sanitized lessons awaiting review.

## .claude/skills/codeceptjs-migration/run.md — provisioning/setup.ts omits PMM_DEBUG=1 that nearly every other PMM test environment sets by default

- Added: 2026-08-20
- Evidence: A migration's execution step failed reproducibly because pmm-managed.log accumulated far fewer lines per API call than the source test's thresholds assumed. Root cause was that the local Docker provisioner (`provisioning/setup.ts`) does not set `PMM_DEBUG=1` on the server container by default, unlike codeceptjs-e2e's and e2e_tests' own docker-compose files, cli/test-setup configs, qa-integration configs, and the documented Jenkins job default. Passing the existing `--server-env PMM_DEBUG=1` flag fixed it. Cost a full provision-run-investigate-reprovision-rerun cycle.
- Proposed change: In run.md step 3 ("Provision once locally for review"), note that `--server-env PMM_DEBUG=1` may be needed to match log-verbosity-dependent thresholds, since it is not a default and every other PMM test environment in this repo sets it.

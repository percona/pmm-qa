# .claude/skills/git-diff/SKILL.md — percona/pmm unit tests need the test Postgres on 127.0.0.1 inside the test container

- Added: 2026-09-22
- Applies to: target only
- Evidence: running the PR's own `TestChangeAgentExpectedTypes` for PMM-15191 failed with `dial tcp 127.0.0.1:5432: connect: connection refused` although `PMM_TEST_POSTGRES_ADDR`/`_USERNAME`/`_DBPASSWORD` were set; `managed/utils/testdb/db.go` hardcodes `127.0.0.1:5432`, user `postgres` and a password read from `/srv/.postgres_password`, so those variables do nothing.
- Proposed change: note that a `percona/pmm` managed-package test run needs the database reachable at `127.0.0.1:5432` from inside the test container — start `postgres` with `POSTGRES_HOST_AUTH_METHOD=trust` and run the test container with `--network container:<pg container>` — and that the `PMM_TEST_POSTGRES_*` variables are not read.

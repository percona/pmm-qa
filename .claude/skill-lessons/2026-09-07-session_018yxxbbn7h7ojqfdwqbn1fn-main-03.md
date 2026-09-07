# .claude/skills/linode-docker-provisioning/SKILL.md — `docker rm -f` on pmm-server strands a postmaster.pid and the next container fails to start

- Added: 2026-09-07
- Applies to: target only
- Evidence: recreating pmm-server with new env vars via `docker rm -f` on the same `pmm-data` volume left `/srv/postgres18/postmaster.pid` naming a PID the new container reused, PostgreSQL hit `FATAL: lock file "postmaster.pid" already exists` on every retry, and readyz served nginx 500 with nothing in the pmm-managed log.
- Proposed change: in step 2, tell recreates to `docker stop` before `docker rm`, and record the recovery (`rm /srv/postgres18/postmaster.pid`, `supervisorctl start postgresql`) as the fix for a 500 readyz after a hard-killed container.

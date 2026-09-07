# .claude/skills/linode-ha-provisioning/SKILL.md — a 401 admin login on a fresh HA cluster is usually Grafana brute-force lockout, not a stale password

- Added: 2026-09-07
- Applies to: target only
- Evidence: On a fresh cluster every admin login returned 401 `password-auth.failed`. The skill's `grafana-cli admin reset-admin-password` step printed "Admin password changed successfully" and the Grafana `user` row's `updated` timestamp moved, yet login still 401'd with the exact secret value read from `pmm-secret` and from inside the pod. Grafana's `login_attempt` table held 5 rows left by the crash-looping `pmm-ha-pmm-token-init` job; deleting them made the same credentials return 200 immediately.
- Proposed change: In the admin-login section, check and clear Grafana's `login_attempt` rows (via `psql` in a pmm pod using the pod's own `GF_DATABASE_*` env) before concluding the password is wrong, and note that a "successful" reset changing nothing observable is the signature of the lockout rather than of a wrong database.

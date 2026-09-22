# .claude/skills/linode-docker-provisioning/SKILL.md — replaying a workflow's main-server compose collides with the box's own nginx on port 443

- Added: 2026-09-22
- Applies to: target only
- Evidence: Reproducing `runner-e2e-tests-codeceptjs.yml` step by step ran `docker compose -f docker-compose.yml up -d`, whose `pmm-server` service maps host port 443; the exec-server's nginx already owns it, so the container died with `failed to bind host port 0.0.0.0:443/tcp: address already in use` and the following `readyz` wait then burned its full 300s timeout before the run continued. The failing test needed only its own `docker-compose-clickhouse.yml` (8081/8444), which came up fine.
- Proposed change: In section 5 (workflow reproduction), warn that host port 443 belongs to the box's nginx — the same reason step 2 maps 8443 — so a workflow compose publishing 443 cannot be replayed verbatim; remap it or, when the failing suite brings up its own compose on other ports, skip the workflow's main-server step entirely.

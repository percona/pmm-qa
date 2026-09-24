# .claude/skills/linode-docker-provisioning/SKILL.md — `--pmm-server-ip pmm-server` still breaks local-server setups

- Added: 2026-09-24
- Applies to: target only
- Evidence: A later session following step 3 hit the same failure with `--database psmdb`: `Failed to register pmm-agent on PMM Server: Post "https://pmm-server:443/...": connection refused`. Dropping `--pmm-server-ip` fixed it (Docker discovery uses pmm-server:8443).
- Proposed change: Same as the existing 2026-09-21 entry: omit `--pmm-server-ip` when PMM Server is the local container from step 2, and keep the flag only for a remote server on 443.

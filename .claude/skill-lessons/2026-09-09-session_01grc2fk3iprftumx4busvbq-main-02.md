# .claude/skills/linode-docker-provisioning/SKILL.md — `--pmm-server-ip 127.0.0.1` only reaches the server from host-networked setups

- Added: 2026-09-09
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: `pmm-framework --pmm-server-ip 127.0.0.1` registered `pdpgsql` fine, but `haproxy` and `pgsql` failed at "Install pmm3-client" because their own containers cannot reach the host loopback; the framework still exited after the other setup reported OK, so the failure was easy to miss.
- Proposed change: In step 3, say the server address must be reachable *from inside the client container* — use `--pmm-server-ip pmm-server` (the shared `pmm-qa` network hostname) or the VM's own IP — and that `127.0.0.1` works only for setups that run host-networked.

# .claude/skills/linode-docker-provisioning/SKILL.md — a fix keyed on the box's own state matches repro-only entities that do not exist in CI

- Added: 2026-09-09
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md and .claude/agents/investigator.md
- Evidence: a setup fix built its candidate list from local `docker ps -a` names to deregister those nodes from the PMM Server; the CI runner talks to a remote server, but the repro box runs PMM as a local container named `pmm-server`, so the script targeted the server's own node, got a 403 and reported a dirty inventory that was in fact clean. Only running it on the box surfaced this — the diff read correctly.
- Proposed change: in the verification section, state that the repro box's topology differs from CI's (PMM Server local vs remote, single host vs several shards on one server) and that a fix deriving inputs from host state — containers, hostnames, ports, mounts — must exclude the repro-only entities explicitly and be checked on the box, not just reasoned about.

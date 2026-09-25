# .claude/skills/verification-depth/SKILL.md — Query VictoriaMetrics with `curl -g` and don't restart a setup-mode pmm-client container

- Added: 2026-09-25
- Applies to: verification-depth; any skill checking PMM metrics or running pmm-client in Docker with PMM_AGENT_SETUP=1
- Evidence: `curl '…/api/v1/query?query=pg_up{collector="exporter"}'` silently returned nothing (curl URL globbing ate the braces), making a healthy exporter look down and a wait loop time out; separately, `docker start` on a pmm-client container created with PMM_AGENT_SETUP=1 and PMM_AGENT_SETUP_FORCE=1 re-registered the node and deleted its previously added services.
- Proposed change: Require `curl -g` (or `--data-urlencode query=…`) for PromQL with label matchers, and note that restarting a setup-mode pmm-client container force-re-registers the node, so services must be re-added or the container created without FORCE.

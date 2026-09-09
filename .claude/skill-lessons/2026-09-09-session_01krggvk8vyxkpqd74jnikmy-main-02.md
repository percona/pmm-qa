# .claude/skills/linode-docker-provisioning/SKILL.md — the inventory API groups by type and names the agent field `connected`, so a flat jq path silently returns nothing

- Added: 2026-09-09
- Applies to: target only
- Evidence: Checking registered inventory on a provisioned box, `jq -r '.nodes[]?'` on `/v1/inventory/nodes` and `.agents[]?` on `/v1/inventory/agents` both printed empty while a node and its agents were in fact registered — the responses are keyed by type (`.container[]`, `.generic[]`, `.remote[]`; `.pmm_agent[]`, `.mysqld_exporter[]`, …). The pmm-agent connectivity field there is `connected`, not the `is_connected` the codeceptjs inventory tests read from their own serialization.
- Proposed change: Add a short inventory-check snippet to the skill showing the type-keyed shape (`to_entries[] | .key as $k | (.value[]? | …)`) and noting that `connected` is the field name on `/v1/inventory/agents`, so an empty result reads as a wrong jq path rather than as nothing registered.

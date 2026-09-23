# .claude/skills/linode-ha-provisioning/SKILL.md — chart-only HA changes should run on 3-dev-latest, not the chart's released default image

- Added: 2026-09-23
- Applies to: .claude/skills/linode-ha-provisioning/SKILL.md, .claude/skills/test-scope/SKILL.md
- Evidence: A chart-only PMM-HA-GA ticket (fix version 3.10.0) was tested on the chart's default percona/pmm-server:3.9.1; the user asked which build was used and had it re-run on perconalab/pmm-server:3-dev-latest, since the GA chart targets the in-development server and a 3.9.1 server produced a suspect "missing route" observation.
- Proposed change: When no FB image exists (chart-only change), set server and client images to perconalab/pmm-*:3-dev-latest explicitly and state the images used in the report.

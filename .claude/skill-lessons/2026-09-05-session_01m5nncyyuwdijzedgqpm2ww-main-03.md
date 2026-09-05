# .claude/skills/fb-tests/SKILL.md — Jenkins MCP calls need `master: "pmm"` and the pmm master keeps only the last ~30 builds of high-volume jobs

- Added: 2026-09-05
- Applies to: .claude/skills/fb-tests/SKILL.md; .claude/agents/investigator.md
- Evidence: A Percona_Jenkins_MCP `get_item` without `master` failed with "No Jenkins master selected" (nine masters configured); with `master: pmm`, `get_build` for pmm3-aws-staging-start returned 404 for every build older than the latest ~30 (about one day), so historical build data for that job cannot be pulled from Jenkins at all.
- Proposed change: Note that every Percona_Jenkins_MCP call for PMM jobs must pass `master: "pmm"`, and that the pmm master's build retention is roughly 30 builds per job, so anything older than a day for busy jobs must come from Slack `#pmm-notifications` or the job's own artifacts, not from Jenkins.

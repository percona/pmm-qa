# .claude/skills/jira/SKILL.md — no path here can create Jira dashboards, gadgets, or saved filters

- Added: 2026-09-04
- Applies to: .claude/skills/jira/SKILL.md
- Evidence: A "create a Jira dashboard with a monthly chart" request led to checking both the relay action list and the Atlassian MCP tool list for a dashboard or filter action; neither exposes one (relay: create/read/search/comment/field/transitions/attach; MCP: issue, comment, link, Confluence, Compass only), so the deliverable became a chart artifact built from relay JQL counts plus manual gadget steps.
- Proposed change: Add one line under Operations stating that dashboards, gadgets and saved filters are out of reach on every path, and that the fallback is per-month JQL counts via `search` rendered as an artifact plus the manual steps (saved filter → dashboard → "Recently Created Chart" gadget, period Monthly).

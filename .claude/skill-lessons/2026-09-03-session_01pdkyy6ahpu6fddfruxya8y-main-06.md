# .claude/skills/ui-evidence/SKILL.md — PMM's own overlays only render under /pmm-ui/, so a bare /graph/ URL shows no PMM UI chrome

- Added: 2026-09-03
- Applies to: target only
- Evidence: Waiting for a PMM update popup on `/graph/d/pmm-home` timed out after 120s. That URL serves Grafana with no PMM shell around it; the constants in the app put the shell at `PMM_BASE_PATH = /pmm-ui`, so the same dashboard carrying PMM's nav, modals and snackbars is `/pmm-ui/graph/d/pmm-home`. The skill's own examples screenshot `$PMM_HOST/graph/d/<dashboard>`, which is correct for a dashboard image but silently wrong for anything the PMM shell renders.
- Proposed change: Note that dashboard-only screenshots may use `/graph/d/<dashboard>`, but any evidence involving PMM's own chrome (nav, update modal, snackbars, prompts) must open `/pmm-ui/graph/d/<dashboard>`, since the bare `/graph/` path renders no PMM shell.

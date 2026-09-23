# .claude/agents/investigator.md — Read the CI failure's own page-snapshot/trace before theorizing a Playwright dashboard failure mechanism

- Added: 2026-09-23
- Applies to: .claude/agents/investigator.md
- Evidence: A @post-upgrade postgres dashboard test looked like a slow ClickHouse/QAN panel 60s timeout; a CPU-hog load sweep (12→30 hogs, render 22s→84s) never crossed the cliff, but the CI artifact page-snapshot (error-context.md) showed the panel was present and fully populated — only its heading was the stale pre-rename title "Queries" vs the expected "Top slow queries", from async grafana unified-storage re-provisioning lagging under load.
- Proposed change: For a failing Playwright dashboard test, download and read the CI run's error-context.md/trace.zip first; treat a "Missing dashboard panels: X" soft-fail plus a same-panel gridcell-visible timeout as "panel likely present under a different title/state" and check the snapshot heading text before attempting a load-based reproduction.

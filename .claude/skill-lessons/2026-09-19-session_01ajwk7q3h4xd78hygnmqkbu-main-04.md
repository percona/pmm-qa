# .claude/agents/investigator.md — a URL match for the Grafana iframe also matches the PMM UI main frame

- Added: 2026-09-19
- Applies to: .claude/agents/investigator.md
- Evidence: `page.frames().find((f) => f.url().includes('/graph/d/'))` returned the top-level `/pmm-ui/graph/d/…` frame, so the injected IntersectionObserver log and DOM dump came back empty for two full iterations before the selector was changed to exclude `page.mainFrame()`.
- Proposed change: Where step 3 describes the Grafana iframe, add that the PMM UI shell's URL carries the same dashboard path, so pick the frame by excluding `page.mainFrame()` or by the `#grafana-iframe` element, never by URL alone.

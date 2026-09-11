# .claude/skills/ui-evidence/SKILL.md — render a dashboard at the volume it will realistically hold, not with a handful of sample rows

- Added: 2026-09-11
- Applies to: all skills that publish or hand off a static HTML page (Pages sites, artifacts, report dashboards)
- Evidence: A GitHub Pages trend dashboard rendered cleanly with 3 sample runs and was pushed. Re-rendering it with 50 generated runs (two scales, a failure streak that then recovered, one run with an extra link) exposed three defects at once: the 3-vs-3 trend heuristic read "regressing" on run-to-run noise after the recovery, the nowrap links column overflowed, and the 50-row table had no scale or failing-only filter. The local render needed the CDN library vendored via curl because the sandbox browser cannot reach the CDN; the published page then pinned it with a subresource-integrity hash.
- Proposed change: Before publishing a page that grows with data, generate a realistic fixture (30+ items, the widest row shape, a regression-then-recovery pattern) and screenshot it alongside the small-sample render; vendor CDN scripts locally for the sandbox render and add `integrity`/`crossorigin` to the published script tag.

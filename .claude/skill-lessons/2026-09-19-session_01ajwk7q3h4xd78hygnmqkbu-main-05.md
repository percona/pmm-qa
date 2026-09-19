# .claude/agents/investigator.md — a "panel missing" verdict on a repeated panel needs the LazyLoader observed, not inferred

- Added: 2026-09-19
- Applies to: .claude/agents/investigator.md
- Evidence: A repeat instance absent from three DOM sweeps was a scenes `LazyLoader` placeholder (a `div` with a numeric `id` and a single nbsp child) that IntersectionObserver reported not intersecting at `top: 1171` with `rootBounds` `[-100, 1180]`, proving the 100px rootMargin does not extend past PMM's iframe clip; a `page.addInitScript` wrapping `IntersectionObserver` and logging `observe`/callback entries for numeric-id targets settled it in one run.
- Proposed change: In the trace-reading guidance, add the placeholder signature and the addInitScript IntersectionObserver hook as the way to decide whether a missing Grafana panel was never mounted, and note that inside PMM's iframe a panel mounts only once it enters the frame's visible area, not its rootMargin band.

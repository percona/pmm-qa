# .claude/agents/investigator.md — a top-frame DOM probe of a PMM dashboard returns zero panels, which reads as the very absence being investigated

- Added: 2026-09-18
- Applies to: .claude/agents/investigator.md
- Evidence: While classifying a failing dashboard test as product-vs-test, an ad-hoc Playwright script navigated to `graph/d/<uid>/<slug>`, was redirected to `/pmm-ui/graph/d/...`, and queried top-level `h2` and `[data-testid^="data-testid Panel header "]`: both returned 0 for every panel, which is indistinguishable from the "panel missing" defect under investigation; rerunning through `page.frameLocator('#grafana-iframe')` returned the full panel inventory and settled the classification.
- Proposed change: In step 2 (Reproduce), require any ad-hoc browser probe of a PMM dashboard to scope to `#grafana-iframe` (the scope `dashboards.page.ts` uses via `grafanaIframe()`) and to log `page.url()` and `page.frames()`, and to treat a zero-element result as an unproven probe rather than evidence of a missing panel.

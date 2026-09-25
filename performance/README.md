# PMM performance reports (GitHub Pages)

Static site for the automated PMM performance-testing pipeline. Every run publishes
one report here, so the team can track trends across releases and open the shared
PMM snapshots for human verification.

- `index.html` — dashboard: trend indicator per client scale, deviation chart over
  time, and a table of runs (click a row for its checks).
- `data/index.json` — array of every report, oldest first. **The only file the
  dashboard reads**; regenerated from `reports/` on each publish.
- `reports/<run_id>.json` — one canonical report per run.

Runs are published by `performance/ci/publish_report.sh <run.json>` on `main`,
which clones this branch, adds the report, rebuilds `data/index.json`, and pushes.
Do not edit `data/index.json` by hand.

## Report schema (`reports/<run_id>.json`)

```json
{
  "run_id": "gha-12345",
  "date": "2026-09-11T08:30:00Z",
  "scale": 100,
  "server": { "from": "3.9.0", "to": "3.10.0" },
  "client_version": "3.10.0",
  "status": "pass",
  "deviation_threshold_pct": 10,
  "summary": "one line",
  "checks": [
    { "name": "exporter_memory_rss_bytes", "unit": "bytes",
      "baseline": 191234048, "after": 199000000, "deviation_pct": 4.1, "ok": true }
  ],
  "snapshots": [
    { "dashboard": "Prometheus Overview", "url": "https://..." },
    { "dashboard": "Node Overview (PMM server)", "url": "https://..." }
  ]
}
```

`baseline` is the 5-minute average captured right before the upgrade; `after` is the
same metric after the post-upgrade wait; a check fails when `|deviation_pct|` exceeds
`deviation_threshold_pct`. `status` is `pass` only if every check is ok. `snapshots`
are the shared PMM dashboard links reviewers open — the AI judges PromQL, not these.

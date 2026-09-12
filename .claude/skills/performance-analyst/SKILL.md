---
name: performance-analyst
description: Judge a PMM performance-test run from collected metrics against predefined thresholds, write a human report, and emit a pass/fail verdict that gates the CI pipeline green/red. Use inside perf-provision.yml (the "Performance Analyst" CI step); also usable to interpret a metrics.json from a manual run.
---

# Performance Analyst

Turn one performance-test run's metrics into a **verdict** (pass/fail) and a short **report**. The CI pipeline exits green/red on the verdict, and notifies only on fail — so the verdict must be deterministic and defensible, not a vibe.

## Inputs

- `metrics.json` — produced by `performance/ci/collect_metrics.sh`: `{server, window, generated_at, checks:[{name, promql, unit, stat, op, threshold, observed:{max, avg, last, samples}}]}`.
- `performance/ci/thresholds.yml` — the source of `stat`/`op`/`threshold` per check (already folded into `metrics.json`; read it only for context/comments).

The workflow passes the paths and the output locations in the prompt.

## Procedure

1. Read `metrics.json`. For each check, compare the observed statistic named by `stat` (`max`/`avg`/`last`) to `threshold` using `op` (`lte` = observed must be ≤ threshold).
2. A check **fails** if it breaches its threshold, **or** if `observed.samples == 0` or the stat is `null` — no data is a failure, not a pass, because the collector or the query is wrong and the run proved nothing. Say which in the report.
3. The run **passes** only if every check passes.
4. Do not invent thresholds, re-weight checks, or excuse a breach as "probably noise". If a threshold looks wrong, still judge against it and flag it in the report for Shruti/Nailya to revise — the numbers are theirs to change, not yours.

## Outputs (exact — the gate depends on them)

Write **`perf-verdict.json`** to the path the prompt gives:

```json
{
  "status": "pass",              // "pass" | "fail"
  "server": "<from metrics.json>",
  "window": "<from metrics.json>",
  "checks": [
    {"name": "exporter_memory_rss_bytes", "stat": "max", "observed": 191234048, "threshold": 268435456, "unit": "bytes", "ok": true}
  ],
  "failures": ["<name: observed vs threshold>", "..."],   // empty when status=pass
  "summary": "one line"
}
```

Write **`perf-report.md`** — a short human report: one-line headline (PASS/FAIL + server + window), a table of each check (observed / threshold / ok), and for any failure a sentence on what breached and by how much. No preamble, no restating this skill. Keep it to what a reviewer needs at a glance.

## How CI consumes it

The workflow runs this skill via `anthropics/claude-code-action@v1`, then a **gate** step does `jq -e '.status=="pass"' perf-verdict.json` — exit non-zero flips the job red. `perf-report.md` and `metrics.json` are uploaded as artifacts; an `if: failure()` step sends the notification. So: always write both files, always set `status` to exactly `pass` or `fail`, and never leave the verdict file unwritten (a missing file must read as a failure to the gate).

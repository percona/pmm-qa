# .claude/skills/verification-depth/SKILL.md — a metric read right after a restart reports "not yet scraped", not "not collected"

- Added: 2026-09-17
- Applies to: .claude/skills/verification-depth/SKILL.md, and any absence claim about a PMM metric
- Evidence: Restarting `mysqld` in two monitored containers, then immediately querying VictoriaMetrics, returned `0` series for `mysql_perf_schema_memory_events_*` on the instance where the instruments were ON and `72` on the one where they were OFF — an inverted result that triggered a wrong-track diagnosis (`pmm-admin list`, agent statuses, both clients' vmagent scrape configs, all healthy). The collector is registered at LR resolution, so no scrape had landed yet; the same query a minute later returned `229` series and the inversion disappeared.
- Proposed change: Require an absence or count claim about a PMM metric to name the last restart of the DB, exporter or pmm-agent and the metric's resolution bucket (LR 60s, MR 10s, HR 5s), and to be read only after one full interval of that bucket has elapsed since it; a zero inside that window is uninformative and is not evidence to diagnose against.

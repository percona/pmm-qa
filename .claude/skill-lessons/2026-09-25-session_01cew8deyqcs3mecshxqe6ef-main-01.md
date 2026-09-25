# .claude/skills/verification-depth/SKILL.md — Read a client exporter's real scrape errors in single-server Docker

- Added: 2026-09-25
- Applies to: .claude/skills/verification-depth/SKILL.md
- Evidence: Diagnosing a "missing" postgres metric for a client-monitored service, the PMM server's /prometheus/api/v1/targets listed only the server's own exporters; the client exporter's scrape state lived in the client container's vmagent, and a direct scrape needed the per-job basic-auth password from the client's vmagentscrapecfg.
- Proposed change: When a metric is absent for a client-monitored service, read the client exporter's scrape lastError from the client container's vmagent (`docker exec <client> curl -s http://127.0.0.1:42001/targets`), and scrape the exporter directly with the job's basic-auth password (user `pmm`) from `/usr/local/percona/pmm/tmp/agent_type_vm_agent/*/vmagentscrapecfg` via `curl -u pmm:<pass> 'http://127.0.0.1:42002/metrics?collect%5B%5D=<collector>'`; a custom-query metric with HELP/TYPE but zero data rows and `pg_exporter_user_queries_load_error`/`pg_exporter_last_scrape_error`=0 means the query loaded but returned no rows, not a parse/duplicate error.

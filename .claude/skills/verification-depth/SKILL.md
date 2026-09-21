---
name: verification-depth
description: Verify PMM behavior directly through API, CLI, logs, metrics, or persisted state, especially asynchronous, freshness, restart, recovery, migration, and absence claims. Use after test-scope has selected the checks. Do not use for UI-only evidence or for selecting deployment and regression scope.
---

# Verification depth

Use this skill to decide what evidence makes a selected direct check credible. [Test scope](../test-scope/SKILL.md) owns what to test; [UI evidence](../ui-evidence/SKILL.md) owns screenshots and recordings for user-visible claims.

## Build the checklist

Before provisioning, record one row per claim:

| Claim | Failure condition | Layer | Command/query/action | Expected | Window/interval |
|-------|-------------------|-------|----------------------|----------|-----------------|

Also record the build, environment, and deployment once for the checklist. Split combined claims such as "monitoring works." If the failure condition, layer, or bounded window is unknown, the check is not ready.

## Start with PMM's real surfaces

Run commands from the environment selected by the provisioning skill. Replace placeholders and preserve that environment's authentication and certificate handling.

| Claim type | Correct layer | PMM command or query | Minimum credible window |
| ------------ | --------------- | ---------------------- | ------------------------- |
| Agent is operating | Client process | `pmm-admin list --json` to identify it, then `pmm-admin status --json` to require the relevant agent/exporter state to be running | Poll through one registration/restart opportunity; use 2 minutes only when the configured timeout cannot be found |
| Metrics are current | VictoriaMetrics | `curl -sS -G -u "admin:${ADMIN_PASSWORD}" "${PMM_URL}/prometheus/api/v1/query_range" --data-urlencode 'query=<promql>' --data-urlencode "start=<unix-start>" --data-urlencode "end=<unix-end>" --data-urlencode "step=<seconds>"` | At least 3 expected samples; newest sample must be recent relative to `now` |
| Inventory/API changed state | PMM API plus affected state | `curl -sS -u "admin:${ADMIN_PASSWORD}" "${PMM_URL}/v1/inventory/services"` and `/v1/inventory/agents` — plain `GET`s on PMM 3; then re-read the affected process, metric, or persisted state | Through one complete state-transition opportunity |
| Service monitoring status / agent connectivity | PMM management API | `GET /v1/management/services` — the only listing that carries per-service `status` and `agents[].is_connected` (what codeceptjs `inventoryAPI.apiGetServices()` reads, so it matches PMM-T554/PMM-T2146); `/v1/inventory/agents` omits `is_connected` for connected and disconnected agents alike | Through one complete registration/reconnect cycle |
| New container logs | Docker log stream | Save `BASELINE_TS=$(date --iso-8601=seconds)` before the action; inspect with `docker logs --since "$BASELINE_TS" <container>` | Trigger the relevant mechanism, then cover one full retry/job cycle |
| New host logs | systemd journal | Save the same baseline timestamp; inspect with `journalctl --since "$BASELINE_TS" -u pmm-agent` (or the affected unit) | Trigger the relevant mechanism, then cover one full retry/job cycle |
| QAN data reached storage | ClickHouse | `docker exec pmm-server clickhouse client --password=clickhouse --query "SELECT service_name, max(period_start), sum(num_queries) FROM pmm.metrics WHERE service_name='<service>' AND period_start >= now() - INTERVAL 10 MINUTE GROUP BY service_name FORMAT Vertical"` | One complete QAN collection cycle; use 5 minutes only when the configured delay cannot be found |

For external or HA ClickHouse, use the connection details produced by that provisioning skill instead of `docker exec`. If the QAN schema differs, run `SHOW TABLES FROM pmm` and `DESCRIBE TABLE pmm.metrics`, then adapt the same `service_name`/`period_start` freshness check rather than guessing.

PMM metrics-resolution defaults are a starting assumption, not evidence: HR 5s, MR 10s, LR 60s. Confirm the running build's settings or generated scrape configuration before choosing `step` and the window. When an interval genuinely cannot be discovered, label the 2-minute agent or 5-minute QAN value as a fallback timeout in the plan and report that the configured interval was not confirmed.

## Match evidence to the mechanism

A single snapshot is sufficient only for deterministic static state. Otherwise:

- **Logs:** establish a timestamp/cursor before the action, trigger the behavior, and inspect only new entries through one full opportunity cycle. Old lines cannot satisfy the check.
- **Metrics:** query a range containing at least three expected samples. Check continuity and require the newest timestamp to be no older than about two confirmed scrape intervals, allowing documented ingestion jitter. An instant query or stale last-known value is smoke evidence only.
- **Persistence:** read before the event, immediately after it, and after subsequent background processing. Perform the restart, failover, migration, or upgrade named by the claim.
- **Data flow:** create a uniquely identifiable workload and locate it at every material boundary claimed, such as agent state, VictoriaMetrics, ClickHouse, API, and UI.
- **Absence:** deterministically trigger one complete opportunity cycle in which the unwanted event would be produced, then show it did not occur in the cursor-bounded evidence. Do not claim open-ended absence such as "no errors ever."
- **Deletion:** read the resource by its immutable id and require a not-found, after the owning system's reconcile or drain interval has passed. A query that returns no match by name, tag, or label proves nothing — a controller can strip a mutable attribute off a resource that is still very much alive.

Do not substitute an adjacent layer: registration is not a running agent, HTTP success is not correct resulting state, a fresh metric is not a rendered dashboard, and a rendered dashboard is not persistence. When a measurement stands in for a **named test**, copy the endpoint from that test's own API helper rather than a convenient sibling listing: a sibling can omit the very field the assertion reads and manufacture a false reproduction — `/v1/inventory/agents` reported 13 of 13 pmm-agents disconnected on a healthy setup where the test's own `/v1/management/services` measured zero.

An API that answers the wrong question rarely errors — it returns an **empty** result that reads as a clean environment. `POST /v1/inventory/services:list` with `{}` returns HTTP 200 and no lists at all; a flat `jq '.nodes[]?'` prints nothing because those responses are keyed by type. So an absence claim from any query counts only once that same call has returned a **non-empty** result on a known-populated environment.

## Sweeps, scripts and analysis you wrote yourself

A self-written detector is evidence about the detector until proven otherwise:

- **Positive control before any "nothing else exists".** Run the same sweep over a corpus known to contain the defect — an earlier commit (`git archive <sha>~1`), or a synthetic file — and state that it fired there. Without that, report "not found", never "does not exist": one sweep reported 0 hits over 221 files and, re-run against the pre-fix tree, flagged all 17 known sites.
- **Read the hits, not the count.** A count alone looks plausible; the matches expose the bug. All 15 "hits" of one sweep were ordinary `.toString(...)` calls, because `name in TABLE` is true for `toString`/`valueOf` on any object literal and the follow-up guard then compared a number against a function and passed them through as `NaN`. Key a lookup with `Object.hasOwn`, a `Map`, or `Object.create(null)`, and make a missing or non-numeric entry throw rather than fall through.
- **Task order can be cheaper than the log.** In an Ansible-driven run, reaching a later task plus a verified absence of `ignore_errors`/`failed_when` on the revision that actually ran is sufficient evidence that every earlier task succeeded — `grep -c ignore_errors` on that revision beats pulling thousands of log lines.

## Bound time and cost before provisioning

Prefer a deterministic trigger over waiting. Where the ticket permits, temporarily shorten the product's own interval and record the changed setting; do not shorten only the observation window.

Declare any single observation window longer than 10 minutes in the test plan before provisioning a paid environment. Include why it is required and why a deterministic trigger or shorter product interval is unsuitable. Every poll must have a bounded timeout. If the required window cannot be completed, use `SMOKE TESTED` or `BLOCKED`, never a shortened silent pass.

## Handle anomalies and lifecycle claims

Resolve unexpected output, timing gaps, inconsistent values, or unexplained log entries before a pass. Either support a benign explanation with evidence or record a finding and mark the affected check `FAILED` or `BLOCKED`.

**A metric read right after a restart reports "not yet scraped", not "not collected".** An absence or count claim about a PMM metric names the last restart of the DB, exporter or pmm-agent, and the metric's resolution bucket (LR 60s, MR 10s, HR 5s), and is read only after one full interval of that bucket has elapsed since that restart. A zero inside that window is uninformative and must not be diagnosed against: restarting `mysqld` in two monitored containers and querying VictoriaMetrics immediately returned `0` series for `mysql_perf_schema_memory_events_*` where the instruments were ON and `72` where they were OFF — an inversion that sent a session through `pmm-admin list`, agent statuses and both clients' vmagent scrape configs, all healthy. A minute later the same query returned `229` series and the inversion was gone.

For migrations and upgrades, seed realistic ticket-relevant data first, record the source version and values, perform the real lifecycle event, re-read the data after background processing, and exercise a post-change read/write path. Empty-instance survival does not prove data preservation.

## Report from the checklist

Use exactly these results: `VERIFIED`, `SMOKE TESTED`, `FAILED`, or `BLOCKED`.

Record build/environment/deployment once, then reuse the checklist as the report:

```text
Build/environment/deployment: ...

| Check | Expected / failure condition | Evidence and actual result | Window | Result |
|-------|------------------------------|----------------------------|--------|--------|
```

`VERIFIED` requires the correct layer, completed observation window or lifecycle event, and no unexplained anomaly. `SMOKE TESTED` means the mechanism ran on a happy path but a required layer, window, persistence check, or anomaly investigation remains incomplete.

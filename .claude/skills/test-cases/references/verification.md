# Verification depth

Use this after scope is selected to define credible direct evidence through APIs, CLI, logs, metrics, or persisted state. UI screenshots and recordings remain owned by `ui-evidence`.

## Checklist

Before provisioning, record the build, environment, and deployment once, then one row per claim:

| Claim | Failure condition | Layer | Command/query/action | Expected | Window/interval |
| --- | --- | --- | --- | --- | --- |

Split claims such as “monitoring works.” A check is not ready while its failure condition, owning layer, or bounded window is unknown.

## PMM surfaces

| Claim | Owning surface | Minimum credible evidence |
| --- | --- | --- |
| Agent operates | `pmm-admin list --json`, then `pmm-admin status --json` | Relevant agent/exporter reaches running state through one registration or restart opportunity |
| Metrics are current | VictoriaMetrics `/prometheus/api/v1/query_range` | At least three expected samples; newest sample is recent against the confirmed scrape interval |
| Inventory changed | PMM inventory API plus affected consumer/state | Re-read after one complete transition; HTTP success alone is insufficient |
| Service/agent connectivity | `GET /v1/management/services` | Inspect `status` and `agents[].is_connected`; `/v1/inventory/agents` omits the needed connectivity field |
| New logs | `docker logs --since` or `journalctl --since` from a baseline timestamp | Trigger behavior and cover one retry/job cycle; old lines do not count |
| QAN reached storage | ClickHouse `pmm.metrics` freshness by `service_name` and `period_start` | One complete QAN collection cycle |

Confirm effective intervals from the running build or generated configuration. PMM defaults—HR 5s, MR 10s, LR 60s—are assumptions until confirmed. When an interval cannot be discovered, label a two-minute agent or five-minute QAN wait as a fallback, not as configured behavior.

## Match evidence to the mechanism

- Logs: capture a cursor before the action and inspect only new entries through one complete opportunity.
- Metrics: query a range with at least three samples; check continuity and freshness, not an instant or stale last-known value.
- Persistence: read before the event, immediately after it, and after background processing; perform the named restart, failover, migration, or upgrade.
- Data flow: create an identifiable workload and locate it at every material boundary claimed.
- Absence: trigger one complete opportunity for the unwanted event, then show it absent from bounded evidence; never claim open-ended absence.
- Deletion: address the immutable id and require not-found after reconciliation; absence by mutable name, label, or tag is insufficient.

Do not substitute adjacent layers: registration is not a running agent, HTTP success is not resulting state, a fresh metric is not a rendered dashboard, and a rendered dashboard is not persistence. An absence query counts only after that exact query has returned a non-empty result on a known-populated environment.

## Self-written detectors

- Run a positive control against a known defect before claiming nothing else exists.
- Read the matches, not only their count.
- For Ansible, reaching a later task can prove earlier success only after confirming the executed revision has no `ignore_errors` or `failed_when` escape.

## Time, anomalies, and lifecycle

Prefer a deterministic trigger over waiting. Declare any single observation window over ten minutes before provisioning a paid environment, explain why it is necessary, and bound every poll. An incomplete required window is `SMOKE TESTED` or `BLOCKED`.

Resolve unexpected output, gaps, inconsistent values, or unexplained logs before passing. For migrations and upgrades, seed realistic ticket-relevant state, record source values and version, perform the lifecycle event, wait for background processing, and exercise a post-change read/write path.

## Report

Use exactly `VERIFIED`, `SMOKE TESTED`, `FAILED`, or `BLOCKED`:

| Check | Expected / failure condition | Evidence and actual result | Window | Result |
| --- | --- | --- | --- | --- |

`VERIFIED` requires the owning layer, completed window or lifecycle event, and no unexplained anomaly. `SMOKE TESTED` means a happy path ran but a required layer, window, persistence check, or anomaly investigation remains incomplete.

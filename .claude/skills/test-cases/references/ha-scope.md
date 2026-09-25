# HA scope

Exercise HA in addition to the normal single-server run when either the ticket requires it or the implementation touches the HA blast radius.

## Ticket signals

Check the summary, description, acceptance criteria, labels, and components for HA, High Availability, `PMM_HA_*`, Raft, leader, clustered, `pmm-ha`, or an explicit HA test request.

## Implementation signals

- Leader-only services registered through `haService.AddLeaderService(...)`: checks/advisors, telemetry, scheduler and backups, version cache, cleaner, or new `haService.IsLeader()` gates. Verify the work runs once and survives leader change without duplication or stalling.
- `managed/services/ha/**`, HA environment parsing, `api/ha/**`, HA UI, alerts, or metrics.
- VictoriaMetrics/VMAgent scrape configuration and external agents/exporters gated on leadership.
- State moved through local `/srv`, process memory, or in-process locks where replicas require shared storage, leader election, or database locking.
- Migrations or bootstrap executed concurrently by multiple replicas.
- Grafana authentication, sessions, unified alerting, live features, shared database, or gossip behavior.
- `pmm-ha` or dependency charts, operators, HAProxy, secrets, pod ordering, image pins, or feature gates.

HA uses elected `pmm-managed` replicas with shared PostgreSQL, ClickHouse, and VictoriaMetrics behind HAProxy. Inspect effective chart values and the actual HA request path; components and endpoints can differ from single-server PMM.

Skip HA when neither the ticket nor the diff reaches this blast radius. If the link is plausible but unresolved, include HA and state why; never provision it merely as generic extra coverage.

# Does this change need HA testing?

The HA dimension of `test-scope`. Answer two questions; if **either** is yes, exercise the change on an HA deployment (`linode-ha-provisioning`) in addition to the normal single-server run.

## 1. Does the ticket say so?

HA impact is usually flagged on the Jira ticket. Check the summary, description, acceptance criteria, and labels/components for `HA`, `High Availability`, `PMM_HA_*`, `Raft`, `leader`, `clustered`, `pmm-ha` (the Helm chart), or an explicit "test in HA" note. If a dev flagged it, trust it and test HA.

## 2. Does the diff touch the HA blast radius?

The ticket doesn't always mention it. Read the `percona/pmm` (and `percona/grafana`) diff (`git-diff` skill) against the areas below. These are grounded in how PMM actually runs HA — one elected leader among N `pmm-managed` replicas (Raft + memberlist gossip), with state externalised to shared PostgreSQL, ClickHouse, and VictoriaMetrics behind HAProxy.

**Leader-only ("singleton") background work.** In HA these run **only on the elected leader**; every other replica skips them. Registered in `managed/cmd/pmm-managed/main.go` via `haService.AddLeaderService(...)`:

- **checks / advisors** (security & config checks)
- **telemetry**
- **scheduler** — scheduled tasks: **backups**, scheduled jobs
- **versionCache** — software version checks
- **cleaner** — old-data cleanup

A change to any of these, or to how they start/stop, must be verified under HA: it has to run exactly once (on the leader), survive a leader change, and not double-run or stall when it isn't the leader. Same for anything newly gated on `haService.IsLeader()`.

**The HA subsystem itself.**
- `managed/services/ha/**` (Raft, memberlist, leader election, HA gRPC API, `ha_metrics.go`)
- `PMM_HA_*` env parsing — `managed/utils/envvars/parser.go`, `managed/cmd/pmm-managed/main.go`, `managed/cmd/pmm-managed-init/main.go`
- `api/ha/**` and the `ha-badge` / `ha-icon` UI components
- HA alerts/metrics: `PMMHALeaderMissing`, `PMMHASplitBrain`, `PMMHALeaderFlapping`, `pmm_ha_raft_term`

**Metrics scraping / VMAgent.** `managed/services/victoriametrics/**` skips external agents/exporters on non-leaders (`skipExternalAgents`, `skipExternalExporter` gated on `IsLeader()`). Changes to scrape-config generation, external exporters, or VMAgent remote-write need HA verification so external targets are scraped once, from the leader.

**Shared/externalised state.** HA externalises state to shared datastores; anything that assumes a **single instance** breaks with N replicas:
- writing to local `/srv` or local files instead of the shared DB / object store
- in-memory caches or state assumed global across the process
- in-process locks/singletons where the guard must instead be leader election or a DB lock
- DB migrations / bootstrap that must be safe when several replicas start at once

**Grafana clustering.** `PMM_HA_GRAFANA_GOSSIP_PORT` — Grafana runs clustered (shared DB + gossip for alerting/live) in HA. `percona/grafana` changes to auth/session storage, unified alerting, or live features can behave differently clustered.

**Deployment / Helm / operators.** The `pmm-ha` and `pmm-ha-dependencies` Helm charts, operator versions (Victoria Metrics, Altinity ClickHouse, Percona PG), HAProxy fronting, secrets, and pod start ordering. Chart or operator changes are HA-only by definition.

## If neither is yes

Skip HA. Most fixes (a single exporter metric, a dashboard panel, a CLI flag, a UI page with no clustered state) don't touch any of the above — the normal single-server run is enough. Don't provision an LKE cluster speculatively; it bills by the hour.

## When in doubt

If the diff plausibly touches leader-gated work or shared state but you can't tell, prefer testing HA and say why in the Jira report. A false positive costs one short-lived cluster; a false negative ships an HA regression.

# PMM performance on CHAOS

Load tests for PMM Server on CHAOS (Percona's internal cloud, free), replacing the Linode
perf runs. Run from a CHAOS runner host: it needs `CHAOS_TOKEN` and a `10.30.x` address.

One PMM Server (a VM, or a k3s HA cluster from `chaos-ha.sh`) and client VMs. Each client VM runs
one MySQL, PostgreSQL and MongoDB with a light workload, and K `percona/pmm-client:3` containers
(2:2:1 MySQL:PostgreSQL:MongoDB). Every container registers as its own PMM node in push mode, so a
VM is K nodes. The DB load is light on purpose: what stresses PMM is the number of agents.

The first client VM (`c01`) is the golden image: Docker and every image pulled once, then cloned
for the others (`--no-clone` creates them from scratch). Clients reach the server on 443 only.

## Lanes

| Lane | Command | Notes |
| --- | --- | --- |
| Daily scale | `chaos-perf.sh run daily-$(date +%F) --nodes 300 --per-vm 75 --duration 3h30m` | Single server, deleted after the report. |
| Weekly HA | `chaos-ha.sh up perf-ha --nodes 5`, then `chaos-perf.sh run weekly-ha --ha perf-ha --nodes 500 --per-vm 75 --duration 3h30m` | `chaos-ha.sh down perf-ha` afterwards. |
| Soak | `chaos-perf.sh up soak --nodes 100 --per-vm 50 --keep`; nightly `chaos-perf.sh upgrade soak` and `chaos-perf.sh report soak --since <24h ago> --lane soak` | `--keep` = CHAOS never deletes it. |

`run` is detached (`setsid`): it brings the run up, holds the load for `--duration`, writes
`stats-*.txt` (`docker stats` per client VM) every 15 min, reports, and tears everything down on
every exit path. Log: `/srv/chaos-runs/perf-logs/<run_id>.log`, ending with `RUN DONE` or
`RUN FAILED`. Reports and stats are kept in `/srv/chaos-runs/perf-reports/`.

## Report

`report.sh` reads PMM's own metrics and QAN API. Baseline is the first `--window` (10m) after
`--warmup` (15m); after is the last window. Gated checks:

| Check | Pass when |
| --- | --- |
| `nodes_reporting`, `services_up` | never below 99% of `--nodes` |
| `qan_services_reporting` | at least 95% of services have QAN data, in both windows |
| `client_data_lag_s` | p95 under 60s (newest client sample vs now) |
| `server_cpu_busy_pct` | p95 under 80% |
| `server_mem_used_pct` | max under 85% |

`server_steal_pct` does not fail a run; it marks it `valid: false` when it averages above 5%
(CHAOS is shared hardware, so a noisy neighbour can skew any result). The other checks
(ingestion rate, active series, VictoriaMetrics and pmm-managed RSS, disk free, iowait) are
trend data with a baseline-vs-after deviation, which is what the soak lane watches for leaks.
The JSON fits `performance/ci/publish_report.sh`.

## Sizing

CHAOS limits a VM to 32 vCPU / 32 GB / 200 GB, and the token to 20 instances (stopped VMs and each
k3s node count), so keep the VM count low: pack clients per VM and confirm with `chaos-perf.sh stats`.
`CHAOS_WAIT_MIN` (60 under `run`) waits for a free slot instead of failing.

Measured on 2026-10-13 (PMM 3.9.1, `--pg-tables 1000` and `100`):

- A client container settles at 235-310 MiB (max ~440) and 5-7% of a vCPU. A 16 vCPU / 32 GB
  VM holds 75; memory, not CPU, is the ceiling.
- Each node is ~8-12k series; 100 nodes ≈ 0.8M active series and 80k rows/s.
- Steal grows with the run's own busy vCPUs: one 16 vCPU VM under stress-ng sees <1%, the same
  server with four busy 16 vCPU client VMs beside it sees 30-60%. 100 nodes (3 VMs) ran at ~8%;
  300 nodes (5 VMs) at 50-60%, which starved the server. Size runs by total busy vCPUs, not nodes.

## Teardown

`chaos-perf.sh down <run_id>`. An `up` without `--keep` expires after `--days` (default 1) as a
backstop. `chaos-perf.sh list` shows every perf run on the host.

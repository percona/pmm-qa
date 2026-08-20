# Skill Lessons

Open, sanitized lessons awaiting review.

## .claude/skills/linode-ha-provisioning/SKILL.md — Scaling an HA cluster: only a Helm upgrade regenerates the peer list, and `--wait` hangs

- Added: 2026-08-20
- Evidence: Verifying scale-down behaviour in HA, `kubectl scale` on the StatefulSet removed a
  pod but left `PMM_HA_PEERS` untouched, so startup logic keyed to the peer list never saw the
  change; only `helm upgrade --set replicas=N` regenerated the list, which also recreates every
  pod. Separately, passing `--wait` to that upgrade never returned: the chart's bundled
  node-exporter DaemonSet cannot schedule on some managed clusters and has been Pending since
  install, so the release sat in `pending-upgrade` and blocked the next upgrade until repaired.
  The provisioning job itself deliberately omits `--wait`.
- Proposed change: Add a short "Scaling the cluster" note — use `helm upgrade --reuse-values
  --set replicas=N` (never `kubectl scale`) whenever the behaviour under test depends on the
  templated peer list; omit `--wait` and poll `readyReplicas` plus `currentRevision ==
  updateRevision` instead; if a release is stuck in `pending-upgrade`, let it fail or clear it
  before upgrading again.

## .claude/skills/verification-depth/SKILL.md — Query VictoriaMetrics through the Grafana datasource proxy

- Added: 2026-08-20
- Evidence: Checking metric freshness to prove monitoring survived a topology change,
  `/prometheus/api/v1/query` returned `missing route` on PMM 3, costing a failed call and a
  detour to discover the datasource uid.
- Proposed change: When verifying a metrics claim, query through
  `/graph/api/datasources/proxy/uid/<uid>/api/v1/query`, taking `<uid>` from
  `/graph/api/datasources` (the Prometheus-type entry), rather than a bare `/prometheus` path.

## .claude/skills/ui-evidence/SKILL.md — Screenshots taken during a rollout capture the wrong page

- Added: 2026-08-20
- Evidence: Two screenshots in one session were unusable: one captured a proxy 5xx page while
  replicas were restarting behind the load balancer, another captured the login page because the
  restarts had invalidated the stored session. Both looked like successful captures — the file
  was written and the command exited 0.
- Proposed change: After any restart, scale, or upgrade, wait for the rollout to complete, then
  re-run the login step before capturing, and inspect the resulting image for the expected page
  before using it as evidence — a written file and a zero exit code do not mean the shot is valid.

# .claude/skills/linode-ha-provisioning/SKILL.md — the chart swap's HAProxy rollout deadlocks and needs the superseded ReplicaSet deleted

- Added: 2026-09-08
- Applies to: target only
- Evidence: `helm upgrade` from the published pmm-ha chart to the PMM-HA-GA branch chart reported `STATUS: deployed` while the HAProxy rollout never progressed: the released chart's pods carry a *required* `podAntiAffinity` on `kubernetes.io/hostname`, so with one pod per node and the Deployment's default `maxUnavailable: 0` the replacement pod stayed `Pending` with `1 node(s) didn't satisfy existing pods anti-affinity rules`, and Helm's success made it look done. Deleting the superseded ReplicaSet released the nodes and the new pods (correctly showing an empty init-container list) came up.
- Proposed change: In the chart-swap section, warn that a green `helm upgrade` does not mean the HAProxy pods rolled, tell the reader to check `kubectl get pods -l app.kubernetes.io/name=haproxy` for `Pending` replacements, and delete the superseded ReplicaSet to break the anti-affinity deadlock.

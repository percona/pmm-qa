# .claude/skills/linode-ha-provisioning/SKILL.md — record the node plan and allocatable before teardown; provision.json omits node_type

- Added: 2026-09-07
- Applies to: target only
- Evidence: Asked after teardown how much CPU/RAM each node had, the run dir could not answer: `provision.json` records `cluster_id`, `external_ip`, `url`, `pods` and passwords but no `node_type`, and the cluster was already deleted with no LINODE_TOKEN in the session to query Linode. The value had to be derived from a captured `kubectl describe nodes` percentage (≈5.95 cores and ≈13.0 GiB allocatable ⇒ a 6 vCPU / 16 GB plan), which also contradicts the `node_type=g6-standard-4` default the skill documents.
- Proposed change: In the Provision step, after unpacking the kubeconfig, save `kubectl get nodes -o wide` plus each node's `.status.capacity`/`.status.allocatable` into the run dir alongside `provision.json`, and state the node plan the relay actually defaults to (or that the skill's stated default is not authoritative and must be read from the cluster).

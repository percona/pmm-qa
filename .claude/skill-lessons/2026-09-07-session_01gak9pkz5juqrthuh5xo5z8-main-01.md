# .claude/skills/linode-ha-provisioning/SKILL.md — chart swap must use `--reset-then-reuse-values`, not `--reuse-values`

- Added: 2026-09-07
- Applies to: target only
- Evidence: The skill's documented `helm upgrade --install ... --reuse-values` swap onto the PMM-HA-GA chart failed with `executing "pmm-ha/templates/pmm-client-statefulset.yaml" at <.Values.pmmClient.replicas>: nil pointer evaluating interface {}.replicas`, because `--reuse-values` drops the newer chart's defaults for keys the installed release never had; the same command with `--reset-then-reuse-values` succeeded.
- Proposed change: In the "Charts" swap commands, replace `--reuse-values` with `--reset-then-reuse-values` and note in one clause that the branch chart routinely adds new top-level values keys, which `--reuse-values` renders as nil.

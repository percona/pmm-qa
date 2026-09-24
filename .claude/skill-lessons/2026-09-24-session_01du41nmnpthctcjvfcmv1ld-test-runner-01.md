# .claude/skills/verification-depth/SKILL.md — confirm a Helm value key exists before using it as a control

- Added: 2026-09-24
- Applies to: .claude/skills/verification-depth/SKILL.md, .claude/skills/linode-ha-provisioning/SKILL.md
- Evidence: Two PMM-15445 runs used `--set replicaCount=5` as the "unrelated change leaves the Job hash unchanged" control, but the pmm-ha chart's key is `replicas`; Helm silently ignored the unknown key, so the check proved nothing until a third run used the real key.
- Proposed change: Before using a `--set` value as a control or negative check, grep the chart's values.yaml (or `helm get values`/rendered diff) to confirm the key exists and actually changes the rendered manifests.

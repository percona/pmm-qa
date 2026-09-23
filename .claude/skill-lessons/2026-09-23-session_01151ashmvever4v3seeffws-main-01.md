# .claude/skills/qa-code-review/SKILL.md — check sibling PRs' settled threads and the chart CI actually runs before a 🔴 on a default

- Added: 2026-09-23
- Applies to: target only
- Evidence: A 🔴 on `k8s/install_pmm_ha.sh` proposed writing both `VMAGENT_*` and `PMM_HA_VM_*` key pairs, premised on the script's `CHART_BRANCH=latest` published-chart default; maintainers replied that the tests run on the PMM-HA-GA chart and upgrades start from 1.8.0 (https://github.com/percona/pmm-qa/pull/1482#discussion_r4083735419), and the same both-pairs fix had already been refuted in a merged sibling PR's thread on the same lines because the GA chart fails with the old keys present (https://github.com/percona/pmm-qa/pull/1476#discussion_r4078154543).
- Proposed change: Extend check 9's "reproposing a construction an earlier round failed" to recent merged PRs touching the same lines (`git log -L` / their review threads), and require a breakage finding premised on a script default to confirm from the workflows or pipeline which value CI actually passes, rating it 🔵-pending-confirmation rather than 🔴 when it cannot.

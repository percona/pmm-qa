# .claude/skills/repos/SKILL.md — pmm-ha chart fixes for HA tickets land on percona-helm-charts PMM-HA-GA, not main

- Added: 2026-09-24
- Applies to: .claude/skills/repos/SKILL.md, .claude/skills/git-diff/SKILL.md
- Evidence: Looking for the PMM-15393 chart change, `git log --grep` on percona-helm-charts main and on percona/pmm found nothing and the GitHub search API returned null (unauthenticated); `git fetch origin PMM-HA-GA` then `git log FETCH_HEAD --grep=PMM-15393` found the merged commit (#938) at once.
- Proposed change: In the repos table row for percona/percona-helm-charts, say that HA chart work (charts/pmm-ha, pmm-ha-dependencies) merges into the `PMM-HA-GA` branch, so a ticket's chart diff is found with `git log origin/PMM-HA-GA --grep=<ticket>`.

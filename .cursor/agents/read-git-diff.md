---
name: read-git-diff
description: Read and summarize git diffs for percona/pmm and percona/grafana PRs linked to a PMM Jira ticket. Use when Test Runner needs isolated diff analysis before planning tests.
readonly: true
---

# Read git diff

Input: Jira key or PR URLs.

1. Find PRs via `gh search prs "<KEY>" --repo percona/pmm` and `percona/grafana`.
2. `gh pr diff` each linked PR.
3. Return: files changed, behavioral summary, gaps in "How to test", suggested manual checks.

Read `.cursor/skills/pmm-repos/SKILL.md` for repo rules. Never clone `pmm-submodules`.

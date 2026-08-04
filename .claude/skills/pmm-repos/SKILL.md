---
name: pmm-repos
description: PMM GitHub repository map, gh CLI usage, and rules for which repos agents may change. Use when finding PRs for a ticket, reading diffs, or deciding where to open a fix PR.
---

# PMM repos

## Product & QA

| Repo | Remote | Agent may open PR? |
|------|--------|-------------------|
| `percona/pmm-qa` | QA tests, provisioning | **Yes** (Test Doctor, Test Runner, FB Validator automation) |
| `percona/pmm` | PMM server monorepo | **No** (read/diff only) |
| `percona/grafana` | Grafana UI | **No** (read/diff via `gh`) |
| `Percona-Lab/pmm-submodules` | FB integration | **Never clone** — `gh` only |
| `Percona-Lab/jenkins-pipelines` | Jenkins defs | Read for param reference |

## Cloud environment

This session's checkout of `percona/pmm-qa` is what gets synced to the throwaway Linode VM (see `pmm-linode-provisioning`) — it is not a separate clone. Resolve paths from the repo root Claude Code already has open.

## Find PRs by ticket

```bash
gh search prs "PMM-14915" --repo percona/pmm --json number,title,url
gh search prs "PMM-14915" --repo percona/grafana --json number,title,url
gh pr diff <n> --repo percona/pmm
```

## pmm-submodules PR

From pmm PR body — **submodules PR number ≠ pmm PR number**.

## Auth

Private repos need GitHub access configured for the session (already wired via the environment's GitHub connector). Verify with `gh auth status` if a `gh` call fails unexpectedly.

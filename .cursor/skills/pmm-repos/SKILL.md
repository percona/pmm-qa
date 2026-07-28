---
name: pmm-repos
description: PMM GitHub repository map, gh CLI usage, and rules for which repos agents may change. Use when finding PRs for a ticket, reading diffs, or deciding where to open a fix PR.
---

# PMM repos

## Product & QA

| Repo | Remote | Agent may open PR? |
|------|--------|-------------------|
| `percona/pmm-qa` | QA tests, provisioning | **Yes** (Test Healer, Test Runner automation) |
| `percona/pmm` | PMM server monorepo | **No** (read/diff only) |
| `percona/grafana` | Grafana UI | **No** (read/diff via `gh`) |
| `Percona-Lab/pmm-submodules` | FB integration | **Never clone** — `gh` only |
| `Percona-Lab/jenkins-pipelines` | Jenkins defs | Read for param reference |

## Cloud environment `PMM`

Checkout includes `percona/pmm` + `percona/pmm-qa` on the same VM. Resolve paths:

```bash
QA_ROOT="${PWD}"
[ -d pmm-qa ] && QA_ROOT="${PWD}/pmm-qa"
PMM_ROOT="${PWD}"
[ -d pmm ] && PMM_ROOT="${PWD}/pmm"
```

## Find PRs by ticket

```bash
gh search prs "PMM-14915" --repo percona/pmm --json number,title,url
gh search prs "PMM-14915" --repo percona/grafana --json number,title,url
gh pr diff <n> --repo percona/pmm
```

## pmm-submodules PR

From pmm PR body — **submodules PR number ≠ pmm PR number**.

## Auth

Private repos need `GH_TOKEN` in Cursor environment secrets. Verify: `gh auth status`.

## Local sibling layout (developer PC)

See `pmm-jenkins-staging` skill for repos-root layout when testing via Jenkins locally.

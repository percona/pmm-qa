---
name: repos
description: PMM GitHub repository map, gh CLI usage, and rules for which repos agents may change. Use when finding PRs for a ticket, reading diffs, or deciding where to open a fix PR.
---

# PMM repos

## Product & QA

| Repo | Remote | Agent may open PR? |
|------|--------|-------------------|
| `percona/pmm-qa` | QA tests, provisioning | **Yes** (Test Runner, Investigator, FB Reporter) |
| `percona/pmm` | PMM server monorepo | **No** (read/diff only) |
| `percona/grafana` | Grafana UI | **No** (read/diff via `gh`) |
| `Percona-Lab/pmm-submodules` | FB integration | Different org — see **Cross-org access** below |
| `Percona-Lab/jenkins-pipelines` | Jenkins defs | Different org — see **Cross-org access** below |

## Cross-org access (`Percona-Lab/*`)

Different owner org than `percona/*`. GitHub **API** access (`gh api`,
`gh run rerun`, MCP tools) works only for repos **attached at session/Routine
creation** — verify with `gh api repos/<owner>/<repo>` before relying on it.
In a session without the repo attached:

- `gh`/MCP calls 403 with "not enabled for this session" — expected, not an
  auth bug. Mid-session `add_repo` push access is refused (v1 cross-tier),
  and a PAT env var can't widen scope (the proxy swaps credentials).
- **Anonymous git read works** for public repos: `git ls-remote`, shallow
  clone with `GIT_LFS_SKIP_SMUDGE=1` and `--depth 1`. Exception: cloning
  pmm-submodules is blocked by the PreToolUse hook — use `gh` from a session
  with the repo attached instead.
- On an access/authorization error, relay the exact message to the user;
  don't silently guess.

## Cloud environment

This session's checkout of `percona/pmm-qa` is what gets synced to the throwaway Linode VM (see `linode-provisioning`) — it is not a separate clone. Resolve paths from the repo root Claude Code already has open.

## Find PRs by ticket

```bash
gh search prs "PMM-14915" --repo percona/pmm --json number,title,url
gh search prs "PMM-14915" --repo percona/grafana --json number,title,url
gh pr diff <n> --repo percona/pmm
```

## pmm-submodules PR

From pmm PR body — **submodules PR number ≠ pmm PR number**.

## Auth

Private repos need GitHub access configured for the session (already wired via the environment's GitHub connector). Verify with `gh auth status` if a `gh` call fails unexpectedly. For `Percona-Lab/*` (a different owner org), a `gh auth status` failure or a `403` is expected, **not** a misconfiguration — see **Cross-org access** above.

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

These live in a **different owner org** than `percona/*`, and in a Claude Code
Remote / web session that matters — attach the cross-org repo **early**, before
you need it, and don't assume `gh` works:

- **`gh api` / `gh pr checks` and the `github` MCP tools are BLOCKED cross-org.**
  A `percona/*`-seeded session gets `403 "access to this repository is not
  enabled for this session"` from `gh`, and `Access denied: repository … is not
  configured for this session` from the MCP tools. Even unauthenticated
  `api.github.com` 403s through the proxy. This is not a `gh auth` bug — it's the
  session's owner-tier scope (see the credentialed-attach note below).
- **Anonymous git read works.** `add_repo` (`access:"read"`) reports the public
  repo is already readable via the git proxy; `git ls-remote` and a shallow
  `GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 …` succeed. Use `add_repo` /
  `ls-remote` / a targeted fetch for file and diff reads — not a bare
  `git clone …pmm-submodules`, which the PreToolUse hook deliberately blocks
  (it would drag in the whole submodules tree).
- **Credentialed attach is refused in v1.** `add_repo` with `access:"push"`
  returns `cross-tier adds are not supported in v1: session already has repos
  from owner(s) [percona]`. A single session can hold credentialed access to
  **one owner tier only**. To get PR/CI **API** access to `Percona-Lab/*`, the
  Routine must fire a session **seeded with the `Percona-Lab` repo as its
  initial source** — or the data must arrive in the trigger payload (e.g. the
  FB-Tests run URL + conclusion that `notify-investigator.yml` passes in).
- If a cross-org `add_repo`/`gh` call fails with an access/authorization error,
  **relay the exact message to the user** and point them at the admin grant
  page (`https://claude.ai/admin-settings/claude-in-slack`); don't silently
  fall back to guessing.

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

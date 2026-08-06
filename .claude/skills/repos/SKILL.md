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
| `Percona-Lab/pmm-submodules` | FB integration | **Never clone** — `gh` only |
| `Percona-Lab/jenkins-pipelines` | Jenkins defs | Read for param reference |

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

## Cross-org access (`Percona-Lab/*`)

`Percona-Lab/pmm-submodules` and `Percona-Lab/jenkins-pipelines` live in a **different org** than `percona/*`. Two things follow:

- **Attach them early.** If a `Percona-Lab` repo isn't already in the session's scope, add it with `add_repo` at the start of the task rather than discovering it mid-run. Reads work through the agent proxy for public repos and through the GitHub MCP tools regardless.
- **On a genuine 403** (`add_repo` or `gh` returns "access to this repository is not enabled for this session"): the Claude GitHub App isn't authorized on the `Percona-Lab` org for this session. Relay this to the user — an **admin must grant access in the Claude GitHub settings: https://claude.ai/admin-settings/claude-in-slack**. Do not retry the same repo in a loop.
- **Never clone** `pmm-submodules` (a PreToolUse hook blocks it when loaded — but don't rely on that; use `gh`/MCP).

## Auth

Do **not** use `gh auth status` as the access oracle: in these sessions it can report the `GH_TOKEN` **invalid** while `gh api` reads still succeed (reads are served through the agent proxy, not `gh`'s own token). Test access with the actual read you need (`gh api repos/<owner>/<repo>`), not with `gh auth status`.

Because `gh`'s own token may be invalid, `gh` **write** operations (`gh pr create`, `gh pr comment`) can fail. Open PRs and post comments via the GitHub **MCP** tools (authenticated separately) or `git push` (proxy-authenticated) instead.

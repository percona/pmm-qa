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

This session's checkout of `percona/pmm-qa` is what gets synced to the throwaway Linode VM (see `linode-docker-provisioning`) — it is not a separate clone. Resolve paths from the repo root Claude Code already has open.

## gh in these sessions — repo-scoped REST only

Cloud sessions serve **only** `gh api repos/{owner}/{repo}/...` (REST). Two whole
classes of command 403 and just waste turns — never use them:
- **Global search**: `gh search ...`, `gh api search/issues` → "not available: sessions are bound to their configured repositories".
- **GraphQL-backed**: `gh pr diff`, `gh pr view`, `gh pr list --json`, `gh search prs` → "This GraphQL query is not enabled for this session".

Use the REST equivalents (all verified working): `gh api repos/{o}/{r}/pulls/<n>`,
`… -H "Accept: application/vnd.github.diff"` for the diff, `…/pulls/<n>/files`
for changed files, `…/pulls?state=all` to list. See `git-diff` skill for the full recipes.

## Find PRs by ticket

The ticket's **Development panel** already lists its linked PRs (see `jira` skill) —
that's the authoritative source, use it first. Only if it's absent, list + filter REST-side:

```bash
gh api "repos/percona/pmm/pulls?state=all&per_page=100" \
  --jq '.[] | select((.title + " " + .head.ref) | test("PMM-14915")) | {number, title, url: .html_url}'
gh api repos/percona/pmm/pulls/<n> -H "Accept: application/vnd.github.diff"   # replaces `gh pr diff`
```

## pmm-submodules PR

From pmm PR body — **submodules PR number ≠ pmm PR number**.

## Auth

Private repos need GitHub access configured for the session (already wired via the environment's GitHub connector). Verify with `gh auth status` if a `gh` call fails unexpectedly. For `Percona-Lab/*` (a different owner org), a `gh auth status` failure or a `403` is expected, **not** a misconfiguration — see **Cross-org access** above.

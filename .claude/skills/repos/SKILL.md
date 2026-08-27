---
name: repos
description: PMM GitHub repository map, GitHub access (MCP-first), and rules for which repos agents may change. Use when finding PRs for a ticket, reading diffs, or deciding where to open a fix PR.
---

# PMM repos

## Product & QA

| Repo | Remote | Agent may open PR? |
| ------ | -------- | ------------------- |
| `percona/pmm-qa` | QA tests, provisioning | **Yes** (Test Runner, Investigator, FB Reporter) |
| `percona/pmm` | PMM server monorepo | **No** (read/diff only) |
| `percona/grafana` | Grafana UI | **No** (read/diff only) |
| `percona/percona-helm-charts` | Helm charts — `pmm`, `pmm-ha`, `pmm-ha-dependencies` (K8s/HA deploys) | **No** (read/diff only) |
| `Percona-Lab/pmm-submodules` | FB integration | Different org — see **Cross-org access** below |
| `Percona-Lab/jenkins-pipelines` | Jenkins defs | Different org — see **Cross-org access** below. **PMM owns `pmm/` only** — see below |

### jenkins-pipelines is multi-team

Every top-level directory belongs to a different team (`.github/CODEOWNERS`): `ppg`, `ps`, `pxc`,
`pxb`, `psmdb`, `pbm`, the distributions, `cloud`. **Stay inside `pmm/`** — never edit, lint, gate
or report on another one, and don't "fix in passing" a problem noticed there.

Two shared libraries, only one of them ours:

- **`vars/` at the repo root** is loaded as `lib@master` by *every* product's builds. Call its
  steps freely; changing one changes everyone's CI. Raise it with the owners instead.
- **`pmm/v3/vars/`** is PMM's own, loaded as `v3lib@master` via `libraryPath: 'pmm/v3/'`. This is
  the right home for a PMM-only step.

PMM pipelines live in `pmm/v3/` (`pmm3-*.groovy`). They only provision and invoke the test
suites — the test logic itself lives in this repo (`qa-integration/pmm_qa`, `e2e_tests`), which
they clone at `PMM_QA_GIT_BRANCH` and rsync to `/srv/pmm-qa`.

## GitHub access — MCP-first

**Use the GitHub MCP tools (`mcp__github__*`) for all GitHub access.** They are the
portable path: some environments (notably **Routine-fired sessions**) have **no `gh`
CLI** at all — a bare `gh` call there dies with `gh: command not found` and takes the
whole step down. The MCP tools work the same in every environment. `gh api
repos/{owner}/{repo}/...` is a **fallback only where `gh` is actually present**
(`command -v gh`); never assume it exists.

Tool map (what replaces each old `gh` recipe):

| Need | GitHub MCP tool | `gh` fallback (only if present) |
| ------ | ----------------- | ------------------------------- |
| Your GitHub login (for `X-Actor`) | `get_me` → `.login` | `gh api user --jq .login` |
| List PRs (page through all before dedup) | `list_pull_requests` / `search_pull_requests` (`perPage: 100`, bump `page` until a short page) | `gh api --paginate "repos/{o}/{r}/pulls?state=..."` |
| PR details / diff / files / commits | `pull_request_read` (`get` / `get_diff` / `get_files` / `get_commits`) | `gh api repos/{o}/{r}/pulls/<n>` (+ `Accept: …diff`) |
| PR checks (CI) | `pull_request_read` (`get_check_runs`) | `gh api …/commits/<sha>/check-runs` |
| Review threads/comments | `pull_request_read` (`get_review_comments` / `get_reviews`) | — |
| File contents | `get_file_contents` | `gh api …/contents/<path>` |
| Commit (files + status) | `get_commit` | `gh api …/commits/<sha>` |
| Actions runs / jobs | `actions_list`, `actions_get` | `gh run list/view -R {owner}/{repo}` (GraphQL `gh run` may 403) |
| Failed-job logs | `get_job_logs` (`failed_only: true`) | `gh run view <id> --log-failed -R {owner}/{repo}` |
| Re-run failed jobs | `actions_run_trigger` (`rerun_failed_jobs`) | `gh run rerun <id> --failed -R {owner}/{repo}` |
| Issues | `issue_read`, `list_issues`, `search_issues` | `gh api …/issues/<n>` |

### Big listings overflow the result cap — that is expected

On these repos the listing calls routinely exceed the tool-result token cap and get
spilled to a file instead of returned: `actions_list` (`list_workflow_jobs` on an FB
matrix of ~48 jobs, `list_workflow_runs` at 20 runs) and `list_pull_requests` (every
open pmm-qa PR — dedup needs each `body`, so trimming `fields` doesn't shrink it
enough). This is the normal path, not an error to retry with a smaller page: parse the
saved file with `jq`/`python3`. The three responses nest differently — assuming one
shape for all three is what produces `TypeError: string indices must be integers`:

| Call | Saved shape |
| ------ | ------------- |
| `actions_list` → `list_workflow_jobs` | `{"jobs": {"total_count": N, "jobs": [...]}}` |
| `actions_list` → `list_workflow_runs` | `{"total_count": N, "workflow_runs": [...]}` |
| `list_pull_requests` | bare top-level list |

If a payload doesn't match, check before parsing rather than guessing:
`jq 'if type == "array" then "array" else keys end' <file>`.

Two whole classes of `gh` command **403 even where `gh` exists** (never use them):
**global search** (`gh search`, `gh api search/issues`) and **GraphQL-backed**
(`gh pr diff/view/list --json`, `gh pr checks`, `gh search prs`). The MCP tools above
cover all of these.

## Cross-org access (`Percona-Lab/*`)

Different owner org than `percona/*`. GitHub API access (MCP tools **or** `gh`) works
only for repos **attached at session/Routine creation** — verify with a small read
(`pull_request_read` / `get_file_contents`, or `gh api repos/<owner>/<repo>` where
`gh` exists) before relying on it. In a session without the repo attached:

- MCP/`gh` calls fail with "not enabled for this session" — expected, not an auth
  bug. Mid-session `add_repo` push access is refused (v1 cross-tier), and a PAT env
  var can't widen scope (the proxy swaps credentials).
- **Anonymous git read works** for public repos: `git ls-remote`, shallow clone with
  `GIT_LFS_SKIP_SMUDGE=1` and `--depth 1`. Exception: cloning pmm-submodules is
  blocked by the PreToolUse hook — read it via the GitHub MCP tools from a session
  with the repo attached instead.
- On an access/authorization error, relay the exact message to the user; don't
  silently guess.

## Cloud environment

This session's checkout of `percona/pmm-qa` is what gets synced to the throwaway Linode VM (see `linode-docker-provisioning`) — it is not a separate clone. Resolve paths from the repo root Claude Code already has open.

## Find PRs by ticket

The ticket's **Development panel** already lists its linked PRs (see `jira` skill) —
that's the authoritative source, use it first. Only if it's absent, list + filter via
the GitHub MCP: `search_pull_requests` with a query like `repo:percona/pmm PMM-14915`,
or `list_pull_requests` (state `all`) and match the title/`head.ref`. Read the diff
with `pull_request_read` (`get_diff`). See the `git-diff` skill for the full recipes.

## pmm-submodules PR

From pmm PR body — **submodules PR number ≠ pmm PR number**.

## Auth

Private repos need GitHub access configured for the session (already wired via the
environment's GitHub connector) — the GitHub MCP tools use it automatically. If a read
fails unexpectedly, it's usually scope (repo not attached) rather than auth. For
`Percona-Lab/*` (a different owner org), a `403`/"not enabled" is expected when the
repo wasn't attached at creation, **not** a misconfiguration — see **Cross-org
access** above.

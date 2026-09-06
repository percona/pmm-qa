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
| Open a PR | `create_pull_request` | — (`gh pr create` is GraphQL-backed and 403s) |

Listing calls are for **enumerating**. A job or run you already have the id of is read
with `actions_get` (`get_workflow_job` / `get_workflow_run`): polling one FB helm job
through `list_workflow_jobs` returned every job's full step list and overflowed the cap
even at `perPage: 5`, where `get_workflow_job` answered the same question in one small
response. When you do list runs, the workflow filter is `resource_id` (a workflow id or
file name, e.g. `e2e-tests-matrix.yml`) — a `workflow_id` argument is not in the schema
and is silently ignored, returning the unfiltered repo-wide list at ~53 KB a page.

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
| `pull_request_read` → `get_files` | bare top-level list |

If a payload doesn't match, check before parsing rather than guessing:
`jq 'if type == "array" then "array" else keys end' <file>`. Per-item keys are not
uniformly present either — an 11-file PR spilled entries where `f['deletions']` raised
`KeyError` after the first entries parsed fine, so read fields with `.get(...)`, never
bare subscripting.

Two whole classes of `gh` command **403 even where `gh` exists** (never use them):
**global search** (`gh search`, `gh api search/issues`) and **GraphQL-backed**
(`gh pr diff/view/list --json`, `gh pr checks`, `gh search prs`, `gh pr create`). The
MCP tools above cover all of these. The `search/*` REST paths are refused outright —
`gh api search/issues?q=…` and `search/commits` return `403 sessions are bound to their
configured repositories` — so PR, issue and commit searches go through the MCP
`search_*` tools scoped with `owner`/`repo`, and file history through
`repos/<owner>/<repo>/commits?path=`.

## Jenkins access (Percona Jenkins MCP)

PMM builds live on the **`pmm`** master (`pmm.cd.percona.com`). Every per-master
`mcp__Percona-Jenkins-MCP__*` call must pass `master: "pmm"` explicitly: the argument is
documented as optional ("omit for the default") but no default is configured, so it
fails with `No Jenkins master selected. Configured: ['ps80','psmdb','pxc','cloud','pmm',
'pxb','ps57','rel','pg']`. Batching the calls doesn't help — the whole batch fails.

- `get_build_failure_summary` is the first call for a FAILED build; `get_build_console_tail`
  takes **`lines`**, not `limit`.
- **History is short.** `get_build` 404s for anything older than roughly the last ~30
  builds of a busy job (about a day for `pmm3-aws-staging-start`), and `get_build_history`
  returns at most 100 builds whatever `count` you pass (the REST tree is `builds{0,100}`).
  A trend question must fit that window; older data comes from the job's own artifacts or
  Slack `#pmm-notifications`, not from Jenkins.
- Read a **matrix runner child** rather than its `-matrix` parent — the parent's children
  consume the same 100-build window in days.
- A build is the **scheduled cron run** when its timestamp falls within about two seconds
  of the job's cron minute; manual and RC re-runs sit anywhere else in the minute.

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

### An unattached `percona/*` repo is the same case

Same org is not the same as attached. In a session scoped to `pmm-qa` alone, both the
MCP tools and `gh` answer `percona/pmm` and `percona/grafana` with "not configured for
this session / Allowed repositories: percona/pmm-qa"; `add_repo` returns
`read_available` (anonymous git is already possible, nothing gets attached) and refuses
`access: "push"` as a cross-tier add. Both repos are public, so read what you need over
anonymous git rather than reporting the ticket unreadable — the `git-diff` skill carries
the PR-ref recipe.

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

---
name: git-diff
description: Read and summarize git diffs for percona/pmm and percona/grafana PRs linked to a PMM Jira ticket. Use before planning manual QA or when Test Runner needs PR scope. Includes JSON dashboard diff guidance.
---

# PMM git diff

Read `.claude/skills/repos/SKILL.md` for repo rules. Never clone `pmm-submodules`.

## Find and diff PRs

**GitHub access is MCP-first** — use the `mcp__github__*` tools (see the `repos`
skill's "GitHub access — MCP-first" tool map): `pull_request_read` with
`get_diff` (full diff), `get_files` (changed files), or `get` (metadata/base+head
SHAs), and `search_pull_requests`/`list_pull_requests` to find PRs. Routine
sessions have **no `gh`**, so the `gh api repos/...` recipes below are a fallback
only where `gh` exists — and even there, global search (`gh search`) and
GraphQL-backed commands (`gh pr diff/view/list`) return HTTP 403, so never use those.

```bash
# 1. Get the PR number from the ticket's Development panel (jira skill) — that's
#    the authoritative link. Only if it's missing, list + filter by key REST-side:
gh api "repos/percona/pmm/pulls?state=all&per_page=100" \
  --jq '.[] | select((.title + " " + .head.ref) | test("<JIRA_KEY>")) | {number, title, url: .html_url}'

# 2. Full diff of a PR (repo-scoped REST, replaces `gh pr diff`):
gh api repos/percona/pmm/pulls/<n> -H "Accept: application/vnd.github.diff"

# 3. Changed files only — far cheaper than the full diff, prefer this first:
gh api "repos/percona/pmm/pulls/<n>/files?per_page=100" \
  --jq '.[] | {filename, status, additions, deletions}'
```

Return: files changed, behavioral summary, gaps in "How to test", suggested manual checks.

## When the session doesn't have the repo

A session scoped to `pmm-qa` alone gets "not configured for this session" from both the
MCP tools and `gh` for `percona/pmm` and `percona/grafana`, and `add_repo` only offers
anonymous read (see the `repos` skill). Both are public, so fetch the PR ref directly:

```bash
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/percona/grafana /tmp/g
git -C /tmp/g fetch --depth 2 origin refs/pull/<n>/head:pr<n>   # depth 2, not 1
git -C /tmp/g show --stat pr<n>
```

**`--depth 2`, not `--depth 1`.** At depth 1 the PR head arrives with no parent, so
`git show` renders the entire tree as one giant added commit instead of the diff — which
reads like a PR that rewrote the repo. Depth 2 gives the real file list. To check whether
the PR already merged: `git fetch --depth 50 origin main` then
`git merge-base --is-ancestor pr<n> origin/main`.

## Large Grafana dashboard JSON diffs

Grafana PRs often change dashboard JSON under `grafana/public/` or packaged dashboards. A raw diff can be **thousands of lines** of minified JSON — do not read the full diff inline.

1. List changed JSON files (REST):
   `gh api "repos/percona/grafana/pulls/<n>/files?per_page=100" --jq '.[].filename' | grep -E '\.json$'`
2. Get the base/head SHAs once:
   `gh api repos/percona/grafana/pulls/<n> --jq '{base: .base.sha, head: .head.sha}'`
3. For each file, use a structural JSON diff tool (installed by the SessionStart hook):

```bash
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Fetch base/head content directly (repo-scoped REST):
gh api "repos/percona/grafana/contents/path/to/dashboard.json?ref=<base_sha>" --jq '.content' | base64 -d > "$tmp/base.json"
gh api "repos/percona/grafana/contents/path/to/dashboard.json?ref=<head_sha>" --jq '.content' | base64 -d > "$tmp/head.json"
for f in "$tmp/base.json" "$tmp/head.json"; do
  if ! jq -e . "$f" >/dev/null; then
    echo "invalid or empty dashboard JSON: $f" >&2
    exit 1
  fi
done
json-diff "$tmp/base.json" "$tmp/head.json"
```

1. Summarize **what panels/queries/alerts changed**, not every byte.

`json-diff` is installed globally by `.claude/hooks/session-start.sh` (`npm install -g json-diff`).

## When diff is too large even for json-diff

- Read the PR description and linked Jira AC first
- Use `gh api` to fetch only the files list and line change counts
- Ask the dev for a testing focus if dashboard churn is unrelated to the ticket

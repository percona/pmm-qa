---
name: git-diff
description: Read and summarize git diffs for percona/pmm and percona/grafana PRs linked to a PMM Jira ticket. Use before planning manual QA or when Test Runner needs PR scope. Includes JSON dashboard diff guidance.
---

# PMM git diff

Read `.claude/skills/repos/SKILL.md` for repo rules. Never clone `pmm-submodules`.

## Find and diff PRs

**These sessions only serve repo-scoped REST (`gh api repos/{owner}/{repo}/...`).**
Global search (`gh search`, `gh api search/issues`) and every GraphQL-backed
command (`gh pr diff`, `gh pr view`, `gh pr list --json`) return HTTP 403 —
don't use them, they only burn turns. The equivalents below all work.

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

4. Summarize **what panels/queries/alerts changed**, not every byte.

`json-diff` is installed globally by `.claude/hooks/session-start.sh` (`npm install -g json-diff`).

## When diff is too large even for json-diff

- Read the PR description and linked Jira AC first
- Use `gh api` to fetch only the files list and line change counts
- Ask the dev for a testing focus if dashboard churn is unrelated to the ticket

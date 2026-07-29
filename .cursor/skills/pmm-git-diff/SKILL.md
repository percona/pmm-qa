---
name: pmm-git-diff
description: Read and summarize git diffs for percona/pmm and percona/grafana PRs linked to a PMM Jira ticket. Use before planning manual QA or when Test Runner needs PR scope. Includes JSON dashboard diff guidance.
---

# PMM git diff

Read `.cursor/skills/pmm-repos/SKILL.md` for repo rules. Never clone `pmm-submodules`.

## Find and diff PRs

```bash
gh search prs "<JIRA_KEY>" --repo percona/pmm --json number,title,url
gh search prs "<JIRA_KEY>" --repo percona/grafana --json number,title,url
gh pr diff <n> --repo percona/pmm
```

Return: files changed, behavioral summary, gaps in "How to test", suggested manual checks.

## Large Grafana dashboard JSON diffs

Grafana PRs often change dashboard JSON under `grafana/public/` or packaged dashboards. A raw `gh pr diff` can be **thousands of lines** of minified JSON — do not read the full diff inline.

1. List changed JSON files: `gh pr diff <n> --repo percona/grafana --name-only | grep -E '\.json$'`
2. For each file, use a structural JSON diff tool (installed in the PMM cloud environment):

```bash
gh pr diff <n> --repo percona/grafana -- path/to/dashboard.json | json-diff /dev/stdin
# or save base/head and compare:
json-diff base.json head.json
```

3. Summarize **what panels/queries/alerts changed**, not every byte.

`json-diff` is installed globally via `.cursor/environment.json` (`npm install -g json-diff`).

## When diff is too large even for json-diff

- Read the PR description and linked Jira AC first
- Use `gh api` to fetch only the files list and line change counts
- Ask the dev for a testing focus if dashboard churn is unrelated to the ticket

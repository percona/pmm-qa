# Nightly reports (GitHub Pages)

The Jenkins nightly orchestrator (`pmm/v3/pmm3-nightly-orchestrator.groovy` in
Percona-Lab/jenkins-pipelines) publishes one report per build at the end of its
`Report` stage, to the `gh-pages` branch under `nightly/`:

- `nightly/index.html` — copied from `nightly/pages/index.html` on every publish.
- `nightly/data/index.json` — every report, oldest first; rebuilt on each publish.
- `nightly/reports/<run_id>.json` — one report per build (`run_id` is `jenkins-<build number>`).

`nightly/ci/build_report.sh <results.json>` turns the orchestrator's `results` map into
a report. Each lane becomes a job, grouped by the part of its name before ` / `
(`compat`, `ui`, `upgrade`, …). A lane that is a GitHub Actions run
(`github nightly-test-suite`) is expanded into that run's jobs, grouped as
`GitHub: <suite>`. `nightly/ci/publish_report.sh <report.json>` pushes it.

The page lists the builds; Details opens one build, one section per group and one row
per job. A group with failures gets one Investigate in Claude button whose prompt
covers all of that group's failed jobs.

## Adding investigator findings

Publishing a JSON with an existing `run_id` merges into that report and appends its
`investigations`. Publish **one finding per root cause**, listing every group it
explains in `suites` (the group names exactly as the report shows them):

```json
{
  "run_id": "jenkins-123",
  "investigations": [
    { "suites": ["GitHub: E2E Tests Matrix (CodeceptJS)", "compat"],
      "verdict": "not a bug",
      "summary": "one line",
      "link": "https://github.com/percona/pmm-qa/pull/..." }
  ]
}
```

`verdict` is one of `not reproduced`, `not a bug`, `test fix`, `product bug`; `link` is
the fix PR or Jira bug when there is one. A group with failures and no finding shows
"Not investigated yet".

```sh
PAGES_REMOTE=https://x-access-token:${TOKEN}@github.com/percona/pmm-qa.git \
  nightly/ci/publish_report.sh findings.json
```

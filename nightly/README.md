# Nightly reports (GitHub Pages)

The `report` job at the end of `.github/workflows/nightly-test-suite.yml` publishes
one report per run to the `gh-pages` branch under `nightly/`:

- `nightly/index.html` — copied from `nightly/pages/index.html` on every publish.
- `nightly/data/index.json` — every report, oldest first; rebuilt on each publish.
- `nightly/reports/<run_id>.json` — one report per run (`run_id` is `gha-<github.run_id>`).

Each report also carries `job_details`: every job of the run from the GitHub API
(`group` is the suite, the part of the job name before the first ` / `), which the
page shows per run, grouped by suite, with a log link and an Investigate in Claude
button on each failed job.

## Adding investigator findings

Publishing a JSON with an existing `run_id` merges into that report and appends its
`investigations`, so the investigator can report after it classifies a failure:

```json
{
  "run_id": "gha-12345",
  "investigations": [
    { "job": "e2e_tests_matrix", "verdict": "not a bug",
      "summary": "one line", "link": "https://github.com/percona/pmm-qa/pull/..." }
  ]
}
```

`verdict` is one of `not reproduced`, `not a bug`, `test fix`, `product bug`.

```sh
GITHUB_TOKEN=... GITHUB_REPOSITORY=percona/pmm-qa nightly/ci/publish_report.sh findings.json
```

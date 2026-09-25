# Nightly reports (GitHub Pages)

The Jenkins nightly orchestrator (`pmm/v3/pmm3-nightly-orchestrator.groovy` in
Percona-Lab/jenkins-pipelines) publishes one report per build at the end of its
`Report` stage, to the `gh-pages` branch under `nightly/`:

- `nightly/index.html` — copied from `nightly/pages/index.html` on every publish.
- `nightly/data/index.json` — every report, oldest first; rebuilt on each publish.
- `nightly/reports/<run_id>.json` — one report per build (`run_id` is `jenkins-<build number>`).

`nightly/ci/build_report.sh <results.json>` turns the orchestrator's `results` map into
a report. A lane that is a GitHub Actions run (`github nightly-test-suite`) is expanded
into that run's jobs. Every job carries its `source` (`jenkins` or `github`) and one of
these groups, which is the unit the page summarises and one Investigate button covers:

| Group | Source | Lanes / jobs |
|-------|--------|--------------|
| Package AMD | Jenkins | `pkg amd64 / *` |
| Package ARM | Jenkins | `pkg arm64 / *` |
| Upgrade AMD | Jenkins | `upgrade / <version> <variant>` |
| Upgrade AMI | Jenkins | `upgrade / ami <version>` |
| Nightly | Jenkins | `nightly / docker`, `docker arm64`, `ami`, `helm`, `ha` |
| Nightly Compatibility | Jenkins | `compat / client <version>` |
| UI | Jenkins | `ui / <tag>` |
| HA, OpenShift & GSSAPI | Jenkins | `ha`, `openshift`, `nightly / gssapi` |
| E2E Tests | GitHub | `E2E Tests Matrix` |
| CLI Integration | GitHub | `CLI integration` |
| CLI Integration Compatibility | GitHub | `Compatibility CLI (<version>)` |
| Integrations | GitHub | `GSSAPI Tests Matrix`, `pmm3-helm`, `PMM_PSMDB_PBM_FULL`, `PMM_PROXYSQL`, `PMM_PDPGSQL` |

A lane or job no rule matches lands in `Other`; add a rule in `build_report.sh`
(and the page's `GROUP_ORDER`) when the orchestrator gains a lane.
`nightly/ci/publish_report.sh <report.json>` pushes it.

The page lists the builds; Details opens one build, one section per group and one row
per job. A group with failures gets one Investigate in Claude button whose prompt
covers all of that group's failed jobs.

## Adding investigator findings

Publishing a JSON with an existing `run_id` merges into that report. Publish **one
finding per root cause**, listing every group it explains in `suites` (the group names
exactly as the table above lists them), and sign it with `by` and `at`:

```json
{
  "run_id": "jenkins-123",
  "investigations": [
    { "suites": ["E2E Tests", "Nightly Compatibility"],
      "verdict": "not a bug",
      "summary": "one line",
      "link": "https://github.com/percona/pmm-qa/pull/...",
      "by": "Investigator routine",
      "at": "2026-09-25T03:40:00Z" }
  ]
}
```

`verdict` is one of `not reproduced`, `not a bug`, `test fix`, `product bug`; `link` is
the fix PR or Jira bug when there is one (the page labels it `PR #N` or `PMM-N`); `by`
is the routine or the GitHub login of whoever ran the session. Findings only ever append.

### Claiming a suite

Before investigating, publish a claim so others see the suite is being looked at:

```json
{ "run_id": "jenkins-123",
  "claims": [{ "by": "<login>", "at": "<now>", "suites": ["CLI Integration Compatibility"] }] }
```

The page shows "Being investigated by …" on that suite for 12 hours, and the
Investigate in Claude button asks for confirmation before starting a second,
conflicting session. A newer claim from the same author replaces the older one, and a
claim is dropped once its author publishes a finding for those suites.

```sh
PAGES_REMOTE=https://x-access-token:${TOKEN}@github.com/percona/pmm-qa.git \
  nightly/ci/publish_report.sh findings.json
```

## Site layout

`pages/index.html` is the site landing page (two cards: Nightly and Performance). The
publisher writes it to the `gh-pages` root only once the performance dashboard lives
under `performance/`; until then the root stays the performance page.

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

## Claims and findings

Two scripts write to a report; both go through `publish_report.sh`, which merges into
the existing report instead of replacing it.

```sh
# Before investigating a group: others see "Being investigated by <login>" on it
# for 12 hours, and the Investigate in Claude button asks before a second session starts.
nightly/ci/claim.sh jenkins-123 "CLI Integration Compatibility" <login>

# One finding per root cause, listing every group it explains. Drops that author's claim.
nightly/ci/finding.sh jenkins-123 <login> "not a bug" "one-line summary" \
  https://github.com/percona/pmm-qa/pull/1511 "CLI Integration Compatibility" "E2E Tests"
```

`verdict` is one of `not reproduced`, `not a bug`, `test fix`, `product bug`. The link
(or `-` for none) is the fix PR or Jira bug; the page labels it `PR #N` or `PMM-N`.
Claims are per group: claiming one group never touches another group's claim.
Findings only ever append.

The Investigate in Claude button opens a session that claims the group, runs the
investigator from percona/pmm-ai (`plugins/pmm-qa/agents/investigator.md`) as a
subagent, and publishes what it returns with `finding.sh`. The investigator itself
knows nothing about this report.

In CI, set `PAGES_REMOTE` (or `GITHUB_TOKEN` and `GITHUB_REPOSITORY`) so the push is
authenticated; in a session the git credentials of the checkout are used.

## Site layout

`pages/index.html` is the site landing page (two cards: Nightly and Performance); the
publisher writes it to the `gh-pages` root. The performance dashboard lives under
`performance/`, published by `performance/ci/publish_report.sh`.

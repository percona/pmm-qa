---
name: helm-chart-ha-run
description: Run the pmm3-ha-tests Jenkins job against a percona-helm-charts branch and post the verdict on that branch's PR. Use when asked to HA-test a chart branch or a chart PR, kick off pmm3-ha-tests for a chart change, or report HA e2e results back to a percona-helm-charts PR.
---

# HA test run for a helm-charts branch

Takes a `percona/percona-helm-charts` branch, runs the `@pmm-ha` e2e suite against the
chart built from it on a real cluster, and posts the verdict as a comment on that branch's
PR.

[`jenkins-builds`](../jenkins-builds/SKILL.md) owns how far to trust a build;
[`repos`](../repos/SKILL.md) owns Jenkins and GitHub access. Every Jenkins MCP call passes
`master: "pmm"` — no default is configured and the whole batch fails without it.

## What one run costs

**`pmm3-ha-tests`** (pipeline `pmm/v3/pmm3-ha-e2e-tests-gha.groovy`, read from `*/master`
of `Percona-Lab/jenkins-pipelines`) delegates cluster creation to **`pmm3-ha-rosa`**
(`CLUSTER_TYPE=OpenShift`, the default) or **`pmm3-ha-eks`**, installs
`charts/pmm-ha-dependencies` and then `charts/pmm-ha` from your branch, runs the Playwright
suite, and destroys the cluster in post actions.

- A real ROSA/EKS cluster, billed by the hour: **65–86 min** for a full pass, **36–38 min**
  when provisioning fails.
- The job also runs itself nightly (`0 2 * * *`) against `PMM-HA-GA`. Check whether last
  night's build already answers the question before starting another.

## Parameters

| Parameter | Default | Set it when |
| --- | --- | --- |
| `HELM_CHART_BRANCH` | `PMM-HA-GA` | **always** — this is the branch under test |
| `PMM_QA_GIT_BRANCH` | `main` | the HA tests themselves are being changed too |
| `DOCKER_VERSION` | `perconalab/pmm-server:3-dev-latest` | pinning a release/RC/FB image |
| `CLIENT_VERSION` | `latest-tarball` | pinning a client |
| `CLUSTER_TYPE` | `OpenShift` | `EKS` only if the change is EKS-specific |
| `OCP_VERSION` / `K8S_VERSION` | `4.21` / `1.35` | testing another platform version |
| `TAGS_FOR_TESTS` | `@pmm-ha` | narrowing to one case, e.g. `@pmm-ha.*T2261` |
| `ADMIN_PASSWORD` | `pmm3admin!` | never, in practice |
| `CLIENTS` | empty | the case needs monitored DBs |

`OCP_VERSION` is read only for `OpenShift` and `K8S_VERSION` only for `EKS`; the unused
platform's provisioning stage reports `NOT_EXECUTED`, which is normal and not a failure.

## Pre-flight — five cheap gates before spending a cluster

**1. The branch must exist in the *upstream* repo.** Both cluster jobs clone a hardcoded
URL — `git poll: false, branch: params.HELM_CHART_BRANCH, url:
'https://github.com/percona/percona-helm-charts.git'` — so a branch that exists only in a
contributor's fork cannot be tested, and most chart PRs are fork PRs (#970 and #967 both
head from `theTibi/percona-helm-charts`, and neither branch resolves upstream). Verify:

```bash
git ls-remote --heads https://github.com/percona/percona-helm-charts "refs/heads/<branch>"
```

No output means stop and say so — the fix is a maintainer pushing that branch to
`percona/percona-helm-charts`, not a parameter you can adjust. Record the SHA it prints:
that, not the PR head, is the chart commit the run actually tests, and on a fork PR the two
differ.

**2. Find the PR before the run, not after.** Fork heads make the `head:` *filter* on
`list_pull_requests` useless (`percona:<branch>` matches same-repo branches only). The
search qualifier crosses forks:

```text
search_pull_requests  query: "repo:percona/percona-helm-charts head:<branch>"
```

No PR, or more than one, is a question for the user now — not a discovery made after 80
minutes of cluster time, with a verdict and nowhere to put it.

**3. Probe Jenkins write access without side effects.** `build_item` needs the
`jenkins-mcp-writers` group, and the only way to find out you lack it should not be a
half-started run. `get_item_config` is gated on that same group and changes nothing:

```text
get_item_config  fullname: "pmm3-ha-tests", master: "pmm"
```

XML back means triggering will work; a permission error means report that and stop.

**4. Don't start a duplicate.** `get_build_history` (`count: 10`) flags a live run with
`"building": true`; `get_build_parameters` on that number returns a flat dict including
`HELM_CHART_BRANCH`. A run already in flight for this branch is the answer — wait on it
instead of starting a second cluster.

**5. Confirm with the user** before triggering, quoting the resolved parameters and the
cost. This creates real cloud infrastructure; it is not a cheap retry.

## GitHub reach for percona-helm-charts

A pmm-qa session has **no access** to `percona/percona-helm-charts` — MCP reads fail with
"not configured for this session". `add_repo` (owner `percona`, repo
`percona-helm-charts`) attaches it: reads then work, and it returns
`"push_check": "refused"`, meaning git pushes are refused because the Claude GitHub App is
not installed there for the org.

Nothing here needs a clone or a push — only API reads plus one comment. Whether the comment
itself is accepted depends on that same app installation, so treat a refused write as a
real possibility and handle it per **Post the comment** below.

## Trigger

```text
build_item  fullname: "pmm3-ha-tests", master: "pmm", build_type: "buildWithParameters",
            data: { "HELM_CHART_BRANCH": "<branch>", ... }
```

`build_type` must be `buildWithParameters` — the job is parameterised. Note the wall-clock
time of the call; the next step needs it.

> The response body of `build_item` is **unverified** — authoring this skill stopped short
> of provisioning a real cluster. Print it once on the first real run and correct this line;
> do not invent field names for it.

## Find the build you started

Not from the queue item. `get_queue_item` returns `{id, inQueueSince, url, why, task}` and
carries **no `executable`** while queued, so there is no verified queue→build-number hop.
Resolve it from the job instead: poll `get_build_history` for a build whose `timestamp` is
at or after the trigger call, then confirm with `get_build_parameters` that its
`HELM_CHART_BRANCH` is yours. Confirm the parameters even when only one new build appeared
— the nightly cron and other requesters share this job.

While the build is still queued, `get_queue_item`'s `why` is the honest status to relay
("There are no nodes with the label …"), not a failure.

## Wait

Jenkins reads go through the MCP tools. `curl` against `pmm.cd.percona.com` redirects to
the login realm and answers **HTML, not an error**, so a `curl | grep` wait loop exits
immediately having checked nothing.

First check at ~35 min, then every 10. Use a backgrounded `sleep` (the harness notifies on
exit) or `send_later`; never a foreground `sleep`. The build is finished only when
`get_build` reports `"building": false` — post actions include the `pmm3-ha-rosa-cleanup`
child job, which ran **22 min** after the tests themselves were done on build #62. Tests
being over is not the build being over, and an in-progress build's stage verdicts are not
verdicts (see [`jenkins-builds`](../jenkins-builds/SKILL.md)). Never post from a build that
is still running.

## Read the verdict — an infra failure is not a chart verdict

`get_build_failure_summary` first; `get_build_test_report` for the full pass list.

| `result` | Test report | What it means |
| --- | --- | --- |
| `SUCCESS` | `failCount: 0` | the chart passed — post it |
| `FAILURE` | present, `failCount > 0` | genuine test failure — post it with the details |
| `FAILURE` | `"no test report (HTTP 404)"` | the cluster never came up — **no verdict** |

The third row is the one that matters. Build #59 failed in `Provision OpenShift Cluster`
after 36 min and every later stage cascaded to `FAILED` in ~57 ms each with no test report;
build #57 ran the suite and failed one real case (`Run HA e2e tests` `FAILED`, post actions
`UNSTABLE`, `7` passed / `1` failed with `errorDetails`). Both read `FAILURE` at the top
level. Cascaded near-zero stage durations plus a missing report mean the run says nothing
about the chart — **don't comment a failure on the PR**; tell the user and offer a re-run.

Two more traps in a report that does exist:

- **Partial totals.** The suite stops early on failure: #57 recorded 8 cases where #62
  recorded 16. Never present a pass count as the whole suite — say "8 of 16 cases ran".
- **A pass that isn't clean.** A `PASSED` case whose stdout carries
  `[[ATTACHMENT|…/test-failed-1.png]]` failed at least once and passed on retry —
  PMM-T2261 did exactly that inside the green build #62. Call those out as flaky.

Artifacts (`logs.zip`, `playwright-report.tar.gz`) are archived with
`allowEmptyArchive: true` and the junit step with `allowEmptyResults: true`, so a missing
artifact or report never fails the build on its own — absence is never evidence of a pass.

## Post the comment

Post it once the build is finished and the verdict is real. Body, then the required
attribution footer:

```markdown
## PMM HA e2e — <PASSED ✅ | FAILED ❌>

`pmm3-ha-tests` [#<n>](https://pmm.cd.percona.com/job/pmm3-ha-tests/<n>/) · <duration>

| | |
| --- | --- |
| Chart branch | `<branch>` @ `<upstream sha>` |
| PMM Server | `<DOCKER_VERSION>` |
| Cluster | `<CLUSTER_TYPE>` `<OCP_VERSION or K8S_VERSION>` |
| pmm-qa | `<PMM_QA_GIT_BRANCH>` |
| Tests | <passCount> passed, <failCount> failed, <skipCount> skipped (of <total> recorded) |

<!-- failures, one line each: PMM-Txxxx name — errorDetails -->
<!-- flaky passes, if any -->
<!-- Playwright report: build artifact playwright-report.tar.gz -->

---
_Generated by [Claude Code](https://claude.ai/code)_
```

Say `<branch> @ <sha>` from the `git ls-remote` in gate 1, not the PR head SHA — on a fork
PR they are different commits and the run tested the upstream one.

If the write is refused, relay the exact message, hand the user the rendered body, and name
the remedy: an org admin installs the Claude GitHub App on `percona/percona-helm-charts`,
or the user reconnects GitHub in claude.ai settings.

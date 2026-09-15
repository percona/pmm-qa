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

## Pre-flight — six cheap gates before spending a cluster

**1. Resolve the PR first, and reject a fork head.** Both cluster jobs clone a hardcoded
URL — `git poll: false, branch: params.HELM_CHART_BRANCH, url:
'https://github.com/percona/percona-helm-charts.git'` — the shorthand step, whose default
refspec fetches `refs/heads/*` only. A fork's branch is not in there, so **a fork PR cannot
be tested by this job at all**. Most chart PRs are fork PRs (#970, #967 and #964 all head
from `theTibi/percona-helm-charts`), so check the head repo before anything else:

```text
pull_request_read  method: "get", owner: "percona", repo: "percona-helm-charts",
                   pullNumber: <n>        → head.repo.full_name, head.ref, head.sha
```

`head.repo.full_name` other than `percona/percona-helm-charts` is a **hard stop**. Say so
plainly: the only fix is someone with upstream push putting that branch on
`percona/percona-helm-charts`; it is not a parameter you can adjust. Do not reach for
`refs/pull/<n>/head` — GitHub does mirror it upstream (verified on #964), but the default
refspec never fetches it, so neither that ref nor the bare head SHA resolves in the job.

Starting from a branch name instead of a PR number, find the PR the same way — the `head:`
*filter* on `list_pull_requests` only matches same-repo branches, so it misses exactly the
fork PRs this gate exists to catch:

```text
search_pull_requests  query: "repo:percona/percona-helm-charts head:<branch>"
```

No PR, or more than one, is a question for the user now — not a discovery made after 80
minutes of cluster time, with a verdict and nowhere to put it.

**2. The upstream branch must exist *and* be the commit under review.** A same-repo head
still has to resolve, and its SHA still has to be the PR's:

```bash
git ls-remote --heads https://github.com/percona/percona-helm-charts "refs/heads/<branch>"
```

Empty output stops the run. A SHA that differs from `head.sha` also stops it — the branch
has moved since, and the job would test a commit nobody asked about. This pairing is what
catches the nastiest case: a fork branch whose name collides with an unrelated upstream
branch, where the name alone resolves happily and the run silently tests the wrong code.

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

**5. Check the job actually exercises the change.** The cluster job pins parts of the
install — notably `--set secret.create=false` against a `pmm-secret` it pre-creates itself.
A chart change confined to a path the job pins that way cannot be verified here however
green the run comes back (PR #964 fixes the `secret.create: true` path and states the
`false` path is untouched). Read the PR's diff against the install arguments in
`pmm/v3/pmm3-ha-rosa.groovy` and say which of the two this run is before spending it: a
verification of the change, or a regression check on shared templates it rewires
(`statefulset.yaml` and `vmauth.yaml` render on both paths, and a credential mismatch there
drops metrics with 401s rather than failing the install). Both are worth running; only one
of them answers "does this fix work", and the PR comment must not claim the other.

**6. Confirm with the user** before triggering, quoting the resolved parameters and the
cost. This creates real cloud infrastructure; it is not a cheap retry.

## GitHub reach for percona-helm-charts

A pmm-qa session has **no access** to `percona/percona-helm-charts` — MCP reads fail with
"not configured for this session". `add_repo` (owner `percona`, repo
`percona-helm-charts`) attaches it: reads then work, and it returns
`"push_check": "refused"`, meaning git pushes are refused because the Claude GitHub App is
not installed there for the org.

Nothing here needs a clone or a push — only API reads plus one comment. **That comment is
currently refused**, verified on PR #954: `add_issue_comment` returns `403 Resource not
accessible by integration`, and `gh api -X POST …/issues/<n>/comments` returns the same 403
because the proxy hands it the same app credential. `push_check: "refused"` on the
`add_repo` result predicts this — it reports the app is not installed for the repo, which
gates API writes and git pushes alike.

So plan for the run to end with a handoff rather than a comment, and say so up front when
someone asks for results to be posted there. Do not spend a second attempt on `gh` after the
MCP call is refused; it is one credential, not two.

## Trigger

```text
build_item  fullname: "pmm3-ha-tests", master: "pmm", build_type: "buildWithParameters",
            data: { "HELM_CHART_BRANCH": "<branch>", ... }
```

`build_type` must be `buildWithParameters` — the job is parameterised. Note the wall-clock
time of the call; the next step needs it.

It returns a bare queue id and nothing else — `{"result": 128334}` on the run that verified
this. Not a build number, not a URL.

## Find the build you started

Not from the queue id `build_item` hands back. `get_queue_item` returns `{id, inQueueSince,
url, task}` and exposes **no `executable`** — checked again on a queue item whose build was
already running, so this is the tool's projection, not a timing artifact. There is no
queue→build-number hop.

Resolve it from the job instead: poll `get_build_history` for a build whose `timestamp` is
at or after the trigger call, then confirm with `get_build_parameters` that its
`HELM_CHART_BRANCH` is yours. Confirm the parameters even when only one new build appeared
— the nightly cron and other requesters share this job.

A `why` key appears on the queue item only while something blocks it ("There are no nodes
with the label …"); that is the honest status to relay, not a failure. Its absence means
the item is not blocked.

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

Say `<branch> @ <sha>` from the `git ls-remote` in gate 2 — the commit the job checked out.
Gates 1 and 2 have already established that it equals the PR head; if you are reporting a
run where it does not, say which commit ran.

State in the comment which question the run answered, per gate 5 — a regression check
reported as a verification of the fix is a false green on someone's PR.

When the write is refused (the current default — see **GitHub reach** above), relay the
exact message, write the rendered body to a file and send it with `SendUserFile` so it can
be pasted as-is, and name the remedy: an org admin installs the Claude GitHub App on
`percona/percona-helm-charts` (https://github.com/apps/claude/installations/select_target),
or the user reconnects GitHub in claude.ai settings. A verdict handed over is the delivered
result, not a failed run — the cluster time still bought the answer.

---
name: jenkins-builds
description: Read and attribute Percona Jenkins builds — parallel stage maps, interleaved consoles, in-progress verdicts, which ref a job actually ran — and validate a change to PMM's own pipeline Groovy locally before pushing. Use when deciding what failed in a Jenkins build, waiting on one, attributing runs or queue items to a parent, or editing pmm/v3 pipeline code.
---

# Jenkins builds

PMM's builds run on the **`pmm`** master and its pipelines live in
`Percona-Lab/jenkins-pipelines` under `pmm/v3/`. Access rules, the per-master
argument and the history limits are in the [`repos`](../repos/SKILL.md) skill's
"Jenkins access" section — read that first; this skill is about trusting what a
build tells you.

## Reads and waits go through the MCP tools, never `curl`

Every read is a `mcp__Percona-Jenkins-MCP__*` call (`get_build`,
`get_build_stages`, `get_build_history`, `get_running_builds`,
`get_all_queue_items`, `get_all_nodes`, `get_item_config`), which carry auth.
`pmm.cd.percona.com` redirects an unauthenticated API request to
`/securityRealm/commenceLogin` and answers with **HTML, not an error**, so
`until curl -sk ".../api/json?tree=building" | grep -o 'true'` never matches, the
loop exits in under a second, and the wait silently does nothing. A timed wait is
a bare backgrounded `sleep N` followed by a re-check through those tools.

## An in-progress build's stage verdicts are not verdicts

`get_build_stages` on an `IN_PROGRESS` build reports `"status":"SUCCESS"` for
parallel branches that are still running — six of them in one case, which had
already been written up as passes. Two tells that the stage graph is unreliable
rather than fast: a **near-zero** stage duration (723 ms for a suite) and a
**negative** one. Confirm every branch verdict against the downstream job's
`get_build_history` (`"building": true`, `"duration": 0`) or the parent's own
console echo lines before reporting it.

## Stage map first, console second

**An error line in a console log does not identify the failing stage.** Read the
per-stage status and find the stage whose own status is `FAILED` before
attributing a cause to any error text: a `cannot access …: No such file or
directory` line was taken as the cause of five failing lanes and fixed as such,
while every build showed that stage `SUCCESS` — the real failure was two stages
later, where both test workers reported OK and the runner still exited non-zero.

The exported console of a `parallel` build is **one flat interleave with no
per-branch prefix**, so the nearest preceding `TASK [...]` line usually belongs to
a different branch — that mis-attributed two failures across nine builds. Read
`get_build_stages` first: the per-branch pass/fail map answers the load-bearing
question in one call (three builds failing all 8 OS branches is a bad parameter;
five failing 1–2 is environmental) before any log is fetched.

## Attributing a failure in an Ansible console

This applies to **any** Ansible-driven build, parallel or not — it was re-hit on a
package-testing build whose first `fatal:` line was reported to the user as the
cause, wrongly: the log held 91 `fatal:` lines, 90 of them followed by
`...ignoring`, and the one un-ignored fatal was a different task entirely.

- Find a `PLAY RECAP` with a non-zero `failed=`, then take the nearest
  **preceding** `fatal:` block that is *not* followed by `...ignoring`, and confirm
  it against the `Failed in branch <name>` marker where the build is parallel.
- Cross-check the recap's `failed=` and `ignored=` counts to establish how many
  failures were real before naming any of them.
- `grep -c 'fatal:'` overcounts badly — 80 hits where 2 were terminal, the rest
  ignored or inside a `block`/`rescue`.
- `rescued=N` alongside `failed=1` is **one** rescue chain, not N failures.

## Getting at a build's artifacts

`export_build_artifact` / `get_build_artifact` accept only a restricted character
set in `relative_path` and refuse one containing `+` or `@`. CodeceptJS names every
`.failed.png` after its scenario title, so essentially all per-test screenshots are
unreachable by path — go through the archived tarballs instead
(`list_archive_artifact` / `extract_archive_artifact`).

**For a PMM UI test that failed on a missing element, an unexplained 401, or a page
that rendered as login, read the server's own `grafana.log` first** — before the
screenshot or the Playwright trace. Extract `srv-logs/grafana.log` from the build's
`srv-logs.tar.gz` and grep `level=error` plus `path=<x> status=<code>` bounded to
the failure window. Five consecutive `#grafana-iframe still not visible after 60
sec` failures were named verbatim in two calls that way: five
`[password-auth.invalid] invalid password` attempts in one second, then "too many
consecutive incorrect login attempts for user - login for user temporarily
blocked", expiring exactly when the suite went green again.

## Attribution: never extend a verified range by adjacency

Consecutive run, build or queue numbers do not imply a common trigger. Eight
Actions runs were verified as belonging to a Jenkins parent by their `created_at`,
and two numerically adjacent runs were then attributed to it unread — they had
been created eight hours earlier by a different parent, overstating a reported
figure by a quarter. Every item attributed to a parent has its own
`created_at`/`timestamp` (or `get_build_parameters`) read, and an aggregate figure
is not quoted until every member of the set, **boundaries included**, is confirmed
individually.

Dispatch collision is the same hazard without the numeric adjacency: a build that
dispatches a workflow can end up polling a **sibling's** run. Ten lanes dispatched
one workflow file within ~6 seconds, and one build's dispatch at 22:11:04 reported
on a run created at 22:11:08 — both happened to fail, so the verdict was
accidentally right and the mis-attribution invisible. Before quoting a dispatched
run's result or its failure detail, match a lane-unique field in the run's env
group (`SERVER_IP`, `PMM_UI_URL`) against the dispatch payload.

## A build waiting on `node`

"There are no nodes with the label '<label>'" is not evidence that an on-demand
agent is booting. Call `get_all_queue_items` and read each item's `why` and
`inQueueSince`: another item aged on the same label — one had sat 53 hours — or a
label none of the job's siblings use means the label has **no provider** at all.

Before reporting a job as unrunnable, enumerate sibling jobs by name prefix and
read their recent build results and durations: one of them usually performs the
same action on a label that works. A cleanup job queued for days was reported as
impossible without Job/Configure while two healthy siblings shared its prefix, one
with a documented force mode for exactly that case; the work then took four
ordinary builds.

## Aborting a build that provisions cloud infrastructure leaks it

Teardown lives in a pipeline's `post` actions, so an abort skips it. Mass-stopping
an orchestrator's children left four live clusters — 6–7 AWS resource types each,
no saved state, each traceable only to an aborted build number. Name the leak
**before** aborting rather than discovering it afterwards, and follow any such stop
immediately with a list-then-destroy sweep (that one listed four via AWS resource
discovery before the sweep and zero after).

## Read the pipeline from the ref the job actually runs

A claim about what a build executed comes from the ref named in that job's own SCM
config (`get_item_config`), not from the working checkout. The same false finding
was produced twice in one session — and shipped in a PR body as a DevOps action
item — by grepping a Jenkinsfile on a long-lived feature branch and concluding an
agent label was hardcoded; the jobs read `*/master`, whose copies carry the correct
`params.USE_ONDEMAND ? ... : ...` ternary. A feature branch left behind its base
manufactures findings, so merging the base in is a correctness step before
diagnosing from it.

## Changing pipeline Groovy: prove it locally first

A Groovy linter cannot check behaviour, and a Jenkins run is a slow way to find
out. Extract the helpers by line range, concatenate them with a **stub script**
(stubs for `stage`, `echo`, `catchError`, `build`) and run that — this proved a
branch-distribution change and exposed a factually wrong comment in the same diff
that lint had passed, and it caught a tail-only "stages skipped" collapse that
mirrored never-run stages as green before the PR rather than after the next
nightly. Two mechanical blockers, both costly to rediscover:

- Groovy 3.0.9 aborts under the default JDK 21 with `Unsupported class file major
  version 65` — run with the JRE 17 that `npm-groovy-lint` installs, and clear
  `JAVA_TOOL_OPTIONS`.
- `evaluate(new File(...))` does **not** share method scope with the calling
  script; concatenate the sources instead.

Run a success, a mid-failure and an aborted fixture, and paste the rendered stage
tree into the PR's verification section.

For **stage-generating** code, give every generated stage at least one executed
step (an `echo` with the status and a link is enough): `PipelineNodeGraphVisitor`
assigns `NOT_EXECUTED` to a chunk with no executed step node, so Blue Ocean draws a
mirrored child stage as never-run whenever the child succeeded — while the
stage-view REST API reports it `SUCCESS`. Judge the rendering from Blue Ocean's
graph, not from the wfapi status.

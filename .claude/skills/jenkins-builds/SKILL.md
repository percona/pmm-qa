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

## A parallel build: stage map first, console second

The exported console of a `parallel` build is **one flat interleave with no
per-branch prefix**, so the nearest preceding `TASK [...]` line usually belongs to
a different branch — that mis-attributed two failures across nine builds. Read
`get_build_stages` first: the per-branch pass/fail map answers the load-bearing
question in one call (three builds failing all 8 OS branches is a bad parameter;
five failing 1–2 is environmental) before any log is fetched.

When you do attribute a failure in the console:

- Find a `PLAY RECAP` with a non-zero `failed=`, then take the nearest
  **preceding** `fatal:` block that is *not* followed by `...ignoring`, and confirm
  it against the `Failed in branch <name>` marker.
- `grep -c 'fatal:'` overcounts badly — 80 hits where 2 were terminal, the rest
  ignored or inside a `block`/`rescue`.
- `rescued=N` alongside `failed=1` is **one** rescue chain, not N failures.

## Attribution: never extend a verified range by adjacency

Consecutive run, build or queue numbers do not imply a common trigger. Eight
Actions runs were verified as belonging to a Jenkins parent by their `created_at`,
and two numerically adjacent runs were then attributed to it unread — they had
been created eight hours earlier by a different parent, overstating a reported
figure by a quarter. Every item attributed to a parent has its own
`created_at`/`timestamp` (or `get_build_parameters`) read, and an aggregate figure
is not quoted until every member of the set, **boundaries included**, is confirmed
individually.

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

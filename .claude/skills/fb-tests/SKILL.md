---
name: fb-tests
description: Analyze Percona-Lab/pmm-submodules FB Tests via REST check-runs, JNKPercona build comments, flaky triage, and map failures to pmm-qa GitHub workflow runners. Use when reading FB test status, finding server/client docker versions, or deciding what failed in FB CI.
---

# PMM FB Tests

**pmm-submodules** — access via the **GitHub MCP tools** (`mcp__github__*`; see the `repos` skill's "GitHub access — MCP-first" tool map). Routine sessions have **no `gh`**, so the `gh api` recipes below are a fallback only where `gh` actually exists. **Never** `git clone` this repo.

## Collect checks

Read checks with the GitHub MCP `pull_request_read` (`method: get_check_runs`, owner `Percona-Lab`, repo `pmm-submodules`, `pullNumber: <SUBMODULES_PR>`, `perPage: 100`) — it resolves the head SHA for you and returns the check runs. The FB matrix has many checks, so **page through every result** (bump `page` until a short page) before grouping — a partial page hides checks and skews the gate. `gh pr checks` is GraphQL-backed and **403s** anyway. Where `gh` exists, the repo-scoped REST recipe below is an equivalent fallback (`per_page=100`, one page covers the matrix); keep only each check's **latest attempt** — but keep *all* of the runs at that timestamp: two different jobs can share one check name (`fb-e2e-suite.yml` runs a CodeceptJS and a Playwright job both named `… @fb-instances`), and a plain `max_by(.started_at)` then reports whichever of the two jq happens to pick, hiding a red one behind its green namesake. Observed live: one such pair, same name and same `started_at`, one `failure` and one `success`.

```bash
SHA=$(gh api repos/Percona-Lab/pmm-submodules/pulls/<SUBMODULES_PR> --jq .head.sha)
gh api "repos/Percona-Lab/pmm-submodules/commits/$SHA/check-runs?per_page=100" \
  --jq '.check_runs | group_by(.name)
        | map((max_by(.started_at).started_at) as $t | map(select(.started_at == $t)))
        | flatten | .[] | {name, status, conclusion}'
```

- **Latest FB build only** — older comments/checks are invalid
- Ignore JNKPercona "API tests have succeded/failed" comments

**The test step's own `conclusion` is not the verdict for a Launchable-wrapped job.** One "Run UI tests … with launchable" step concluded `success` after 11 minutes while its own tail read `3 failed / 7 passed`; what went red was the later **"Record launchable test results"** step, whose output carries the whole failure set — a `Files found / Tests found / Tests passed / Tests failed` table, then `Actionable Failure Details:` with one `##[group]` per failing test giving the spec path, testcase name, parameterised data row and assertion error. One `grep -n '##\[group\]'` over the job log lands on them without paging through the Playwright step.

**Never read a test verdict from `tail_lines`.** A Playwright job's epilogue is longer than any sane tail: `tail_lines: 120` on a failed e2e job returned only the artifact-upload table, the `actions/upload-artifact` env dump and the git credential cleanup — no test line at all, while the verdict sat at lines 2415–2522 of 2776. `tail_lines` identifies *which* job failed; the pass/fail tally and failing spec names come from fetching the whole log to a file and grepping it (`✘|passed|failed|Error:`).

A **green conclusion on a pmm-qa e2e job is evidence of a pass only if its `steps[]` show the "Execute e2e tests" step concluded `success`**, not `skipped`. The steps are already in the `actions/runs/<id>/jobs?per_page=100&filter=latest` payload, so this costs no extra call. A 2–3-minute green job whose "Check if launchable subset is empty" → "Skip notice" succeeded while "Setup PMM Server", "Setup PMM-Client" and "Execute e2e tests" were all skipped is an empty Launchable subset and proves nothing; real runs of the same job take 15–19.5 minutes.

A run-level `status` of `queued`, or jobs carrying no `runner_id` in `list_workflow_jobs`, is **runner-concurrency exhaustion**, not a failing test. When several runs look identical at job level, `get_workflow_job`'s per-step `started_at`/`completed_at` is the cheapest way to find which step actually wedged — four such runs had wedged in two different steps. `runs-on: ubuntu-*` means GitHub-hosted, which rules out shared-egress and NAT explanations before you start measuring.

Read the run's **`run_attempt`** too. Above 1, compare the jobs *across* attempts — `actions_list` → `list_workflow_jobs` with **`filter: all`**, since it defaults to `latest` and would hand you only the newest attempt, then `actions_get` → `get_workflow_job` for step-level conclusions: one run had attempt 1 dying at `Run Setup for E2E Tests` with the test step skipped and attempt 2 failing inside the test — the same job name covering two different failures. The attempt count also tells you how many re-runs have already been spent before you arrived.

## JNKPercona build comment (latest only)

```bash
gh api repos/Percona-Lab/pmm-submodules/issues/<PR>/comments \
  --jq '[.[] | select(.user.login == "JNKPercona" and (.body | contains("Staging instance:"))) | {created_at, body}] | sort_by(.created_at) | .[-1]'
```

| Field in comment | Use as |
| ------------------ | -------- |
| Server docker | `DOCKER_VERSION` / `PMM_SERVER_IMAGE` |
| Watchtower docker | `WATCHTOWER_VERSION` |
| Client tarball | `CLIENT_VERSION` |
| Client docker | **ignore** for `CLIENT_VERSION` |

Before using that image as "the build under test", compare its Docker Hub `last_updated` against the **earliest fix commit** on the linked pmm PR: an image pushed at 08:46Z against a first fix commit at 09:17Z the same day contains none of the change, and needs a rebuild. The familiar caution (a product fix merged *after* the build) is only half of it — the image can also simply predate the commits.

The gap can be **months**, not minutes, so compare the comment's date and the image tag's short sha against the linked PR's `head.sha` and `updated_at` every time. One FB server image was built two months before its PR head and shipped a materially earlier dashboard JSON — different panel titles, targets missing an `avg by (service_name,event_name)` aggregation and an `irate` fallback, the new row below two collapsed rows instead of above them. The ticket's *How to test* field still named the old titles, so the stale image and the stale field agreed with each other and the mismatch read as confirmation. When they diverge, say so in the report and validate the PR head directly — for a dashboard, import the head JSON from `raw.githubusercontent.com` as a **second** dashboard rather than replacing the shipped copy — instead of reporting the FB image as the change. Expect that build's client tarball to have expired from the build cache and 404 as well.

## Map failures to workflows

| Failed check pattern | pmm-qa workflow | Runner |
| --------------------- | ----------------- | -------- |
| `@* UI tests` | `fb-e2e-suite.yml` | `runner-e2e-tests-codeceptjs.yml` (legacy) or `runner-e2e-tests-playwright.yml` (`e2e_tests/`) |
| `CLI tests *` | `fb-integration-suite.yml` | `runner-integration-cli-tests.yml` |

Extract `setup_services` / `tags_for_tests` or `services_list` / `cli_tag` from the failed job inputs.

### Then read the failed job's artifact — it aims the reproduction, it does not replace it

`artifacts_for_@<tag>` carries the CodeceptJS failure screenshot, a Playwright trace per
`retry()` attempt, and the whole PMM Server log set. Take the artifact id from the job's
upload-artifact step (or `actions_list` → `list_workflow_run_artifacts`), get a link with
`actions_get` → `download_workflow_run_artifact`, and read `logs/pmm-managed.log`,
`logs/client/pmm-agent/*` and `tests/output/*.png`. Two greps of `pmm-managed.log`
(`CheckConnectionRequest`, `ServiceInfo response` around the failing add) once pointed straight at
"product, not QA setup" before a VM existed — but that is a hypothesis to reproduce, not a verdict:
`investigator.md` still requires the VM run before any classification, and the pre-change revision
before attributing it to a specific change. What the artifact buys is a much narrower thing to
reproduce.

**Never retype a signed download URL.** Pasted unquoted into a command, its `&` splits the
line and the request goes out without the `sig=` value; the download is then a 408-byte
`<Code>AuthenticationFailed</Code> … Signature fields not well formed` that `unzip` reports
as "not a zipfile" — that pair means a truncated signature, not an expired link. Write it
verbatim and let curl read it:

```bash
umask 077                      # the file holds a bearer URL: keep it unreadable to others
trap 'rm -f url.txt' EXIT      # and don't leave it in the workspace
cat >url.txt <<'EOF'
<paste the returned URL exactly>
EOF
curl -sS -o out.zip -K <(printf 'url = "%s"\n' "$(cat url.txt)")
```

### Reading history in bulk

Never `gh api --paginate` against `Percona-Lab/pmm-submodules`: the Link headers point at
`repositories/{id}/…` URLs the proxy refuses with 403. Page with explicit `page=N`, and
window the request by `created=YYYY-MM-DD..YYYY-MM-DD` so no single listing hits the
REST 1000-result cap — windowing recovered all 1816 runs where a flat loop stopped at
1000. Per-run `actions/runs/<id>/jobs?filter=latest` calls take ~4 s each, so run them
through `xargs -P 10`. `gh api --jq` takes no `--arg`, so add fields like the run id in a
second `jq` pass.

For a job that is **slow rather than failed**, aggregated step timings mislead — they made a 57-minute setup look uniformly slow and produced two wrong hypotheses. Grep the apt/wget `Fetched <size> in <time> (<rate>)` lines and compare rates against a known-fast run of the same job: the same 32.6 MB index ran at 7.9–13.2 MB/s in one and 1.2 MB/s decaying to 44.1 kB/s in the other. More than one external host degrading together rules out a single-mirror throttle, and comparing two jobs *inside* one run (7m23s vs 50 min) or re-running the slow one (2m27s) separates a per-VM network problem from a time-of-day or repo-wide one.

Redirecting a job-log fetch to a file gives **0 bytes** unless escape sequences are
allowed — the only hint is a stderr note about terminal escapes:

```bash
gh api --allow-escape-sequences "repos/Percona-Lab/pmm-submodules/actions/jobs/<id>/logs" \
  | sed 's/\x1b\[[0-9;]*m//g' > log.txt
```

Then grep it for `✘`, `.failed.png` and `FAILED` to name the failing test.

Always pass `per_page=100` on the run-jobs listing (`actions/runs/<id>/jobs?per_page=100&filter=latest`): the REST default of 30 silently truncates these 32–37-job matrix runs, and comparing `total_count` against `(.jobs|length)` is the cheap guard — cheaper than a speculative `page=2`. Through the MCP tools the same call reliably **spills to a file** (213–215 KB per run) with the nested shape `{"jobs": {"total_count": N, "jobs": [...]}}`, unlike the flat `list_workflow_runs` response; batch those calls in parallel and filter the spilled JSON with one small script rather than reading it in character spans. That payload already embeds every job's full `steps` array with each step's `conclusion`, `started_at` and `completed_at`, so the per-job `get_workflow_job` above is needed only when a job listing is unavailable.

Two corrections when computing anything from those timings:

- Segment by the **step's own `conclusion`** first. `skipped` steps are always 0 s (139 of 990 rows in one survey) and inverted a fast-vs-slow comparison until they were dropped; `cancelled` steps are truncated rather than representative, so flag them.
- `runner_name` is a per-job ephemeral id for GitHub-hosted runners — 850 distinct values across 850 jobs — so "does the same runner recur among the slow jobs" cannot be asked by name. Correlate by `labels`/`runner_group_name`, by run and concurrency, or by wall-clock time of day.

## Flaky triage

Mark each failure: **relevant** (overlaps ticket) / **flaky** / **out of scope**. Only expand manual scope for **relevant** failures.

### A re-run reuses the same pinned image

Re-running failed jobs re-executes the FB build that already exists — `perconalab/pmm-server-fb:PR-<n>-<sha>`, built when the feature build ran. A product fix merged upstream *after* that build is not in the image, so the re-run goes red for the same reason and proves nothing about the fix. To confirm a post-build fix, either get the feature build rebuilt, or dispatch the equivalent pmm-qa workflow against a post-merge image, taking into consideration that it may not have the changes carried over there if the changes were never merged (e.g. `perconalab/pmm-server:3-dev-latest`) — and check the tag was actually rebuilt after the merge before trusting it:

```bash
curl -s https://hub.docker.com/v2/repositories/perconalab/pmm-server/tags/3-dev-latest \
  | jq -r .last_updated
```

Re-running is still the right move for a suspected flake, where the same image failing twice is exactly the evidence you want.

## Green gate (FB Reporter)

Fail closed: only "green" when there's at least one check and **every** latest
check completed with a success-ish conclusion. `cancelled`, `null`, still-running,
or an empty set all read as not-green. Apply this identically whichever path
retrieved the checks.

Primary (works with no `gh`): from the `get_check_runs` output collected above
(all pages, every run at each name's latest timestamp — never one run per name), the
set is **green** iff there is ≥1 check and **every** such run has `status == "completed"` with `conclusion` in
`success` / `skipped` / `neutral`; anything else (`failure`, `cancelled`,
`timed_out`, `null`, still-running, empty set) → not-green.

Where `gh` exists, this one-liner is the equivalent fallback:

```bash
SHA=$(gh api repos/Percona-Lab/pmm-submodules/pulls/<PR> --jq .head.sha)
gh api "repos/Percona-Lab/pmm-submodules/commits/$SHA/check-runs?per_page=100" --jq '
  .check_runs | group_by(.name)
  | map((max_by(.started_at).started_at) as $t | map(select(.started_at == $t)))
  | flatten as $latest
  | ($latest | length) as $n
  | ([ $latest[] | select(.status=="completed" and (.conclusion|IN("success","skipped","neutral"))) ] | length) as $ok
  | if $n>0 and $ok==$n then "green" else "not-green (\($ok)/\($n) clean)" end'
```

Anything but `green` → do **not** attach the screenshot to Jira; rerun the failed
jobs and re-check first.

## Detail

See [references/fb-tests.md](references/fb-tests.md) (full templates and screenshot workflow).

# Queries

Everything here runs against the `launchable` CLI the workflows already install. Command names and flags below
were checked against `1.124.4`; **the JSON field names were not** — no token was available when this was
written, so on the first authenticated run print one payload of each and correct this file before relying on
any key. Treat an assumed field name as a bug waiting to happen.

## The session inventory

Start here. Everything else needs session ids, and this is also the denominator — a bad score over three
sessions is not the same finding as the same score over three hundred.

```bash
launchable stats test-sessions --days 28
launchable stats test-sessions --days 28 --flavor <key>=<value>
```

## Per-session results

```bash
launchable inspect tests --test-session-id <id> --json
```

This is the per-test grain: one row per test in that session with its outcome. Aggregating across sessions is
ours to do — there is no server-side "flakiest tests over 4 weeks" call in this CLI (see the gap below), so the
month view is built by walking the sessions from `stats` and folding their `inspect tests` output:

```bash
launchable inspect tests --test-session-id "$id" --json \
  | jq -r --arg id "$id" '.[] | [$id, .testPath // .test_path, .status] | @tsv'
```

Fold on the test path: total runs, failures, and — the signal that matters — whether a test both failed and
passed inside the same window. A test that only ever fails is broken, not noisy.

## Flake detection

```bash
launchable detect-flakes --session "$(cat launchable-session.txt)" --retry-threshold medium <runner>
```

`--retry-threshold` is `low`, `medium` or `high` and sets how aggressively a retry counts as a flake; the
trailing subcommand is the runner format (`file`, `raw`, `bazel`, `rspec`). Session-scoped, so it answers "was
this run flaky", not "which tests are flaky lately" — use it to confirm a candidate, not to find one.

## Quarantine

```bash
launchable gate --session "$(cat launchable-session.txt)" --json
```

`gate` is the enforcement command: it fails only when non-quarantined tests failed, so its verdict against a
session's raw pass/fail is what tells you a quarantined test was covering a failure. **No pmm-qa workflow runs
it** — see the caveat in `SKILL.md` — so today it is a read-only probe you run yourself over a recorded session.

There is no CLI path that lists or changes quarantine membership. That lives in the web app's High Failure Rate
Tests page, which is also where the curated trend views (flakiness score with its weekly delta, never-failing,
longest) are. When a finding needs those, say it came from the web app rather than implying a command produced
it.

## What is not available here

The CloudBees docs describe `smart-tests view flaky-tests | never-failing-tests | longest-tests | test-results`,
which would replace most of the folding above. That CLI is a separate package and **`smart-tests` is not on
public PyPI** (404), so `pip3 install smart-tests` fails outright — it is not merely a version-pin problem.
Until it is reachable, this file is the interface. If it becomes available, the aggregation here collapses to
four calls and this file should shrink accordingly.

## Tying a spike to a commit

Once a window is identified, its boundary dates bound the suspects:

```bash
git log --all --oneline --since=<from> --until=<to>
git show <sha> --name-only
```

A suspect only counts if its changed files line up with the failure `classification.md` gave you. A clean window
on either side of the spike is worth more than a plausible-looking diff.

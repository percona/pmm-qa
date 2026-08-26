---
name: test-health
description: Read pmm-qa's test history back out of CloudBees Smart Tests (formerly Launchable) — quarantined tests, noisy/flaky tests, never-failing tests and slow tests. Use when triaging whether a failure is really flaky, auditing what is quarantined, or deciding which test to stabilise next.
---

# Test health (CloudBees Smart Tests)

Every pmm-qa CI test session is recorded to the Smart Tests workspace, so flakiness, failure-rate and duration
history already exists for all four suite families. This skill reads it back.

## Setup

```bash
pip3 install --user --upgrade 'launchable~=1.0'
launchable verify
```

Same CLI and same `LAUNCHABLE_TOKEN` the workflows use, so nothing new is pinned. (`LAUNCHABLE_ORGANIZATION` +
`LAUNCHABLE_WORKSPACE` also works under OIDC auth.) The renamed `smart-tests` CLI that the CloudBees docs
describe is **not on public PyPI** — installing it fails — so its `view` commands are unavailable; see
`references/queries.md`.

If `verify` fails, say so and stop. An empty result is not "no findings" — report the gap instead.

## Buckets

| Bucket | Where it comes from | What it means |
| ------ | ------------------- | ------------- |
| 🔴 Quarantined | `gate` verdict vs. the session's raw result; membership only in the web app | Its result is excluded from the CI verdict. Needs an owner and an exit condition, or it is permanent. |
| 🟠 Noisy | A test that both failed and passed across the window's sessions | Costs reruns and trust. Usually the one worth fixing. |
| 🟡 Dead weight | Ran often across the window, never once failed | Costs CI time, has never caught anything. |
| 🔵 Slow | Duration across the window's sessions | Drives cycle time. Report it; fix it only when it is also noisy. |

"Noisy" is this repo's word, not CloudBees'. Theirs are flakiness score, failure rate, never-failing and
longest — the curated versions of all four live in the web app. This CLI has no command for any of them, so
the buckets are folded from per-session results; `references/queries.md` has the mechanics and the caveats.

Don't carry fixed cutoffs. Read the run's own distribution and say where the line falls for that week.

## References

| Load | For |
| ---- | --- |
| `references/queries.md` | The `view` commands and the drill-down from ranking to root-cause logs |
| `references/suite-map.md` | Turning a `--test-suite` name or `--test-path` into a workflow and a directory |
| `references/classification.md` | Reading a failure log, and what the fix looks like in this repo |

## What quarantine currently does in pmm-qa CI: nothing

Enforcement is a `launchable gate` step — the CLI already installed in CI has it — and no pmm-qa workflow runs one. The test steps end in `|| true`
(`.github/workflows/runner-e2e-tests-playwright.yml:220`), so a test step cannot fail its job either way, and
the nightly runner swallows the upload too (`runner-e2e-tests-playwright-remote-nightly-tests.yml:297`) — which
means a nightly week can be missing sessions entirely. Read a "quarantined" label as triage metadata, not as
something suppressing a failure today.

## Authority

Quarantining and unquarantining are human decisions — manual in the web UI, or automatic from the failure-rate
threshold config. Report what is quarantined and what should not be; never change that state.

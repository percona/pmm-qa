---
name: verification-depth
description: Enforce rigorous, reproducible PMM verification for backend, API, CLI, infrastructure, packaging, upgrade, logs, metrics, persistence, restart, recovery, and other asynchronous behavior. Use whenever Test Runner or Investigator verifies a claim directly instead of through the PMM UI, especially when one successful command or snapshot could hide delayed, stale, or transient failures. Also use when selecting high-risk regression checks and deciding whether evidence supports "verified" or only "smoke tested." This complements ui-evidence; it does not replace UI validation for user-visible claims.
---

# Verification depth

Do not stop at the first successful response, log line, metric value, or command. Match the evidence depth to the claim being made.

## Build a falsifiable checklist first

After reading the ticket and relevant diff, but before provisioning or executing the test, turn every requirement into an explicit check. Record:

- Claim being tested.
- What exact result would make it fail.
- Correct observation layer: process/agent, API, metric, UI, or persisted state.
- Exact command, query, endpoint, file, or UI surface.
- Expected result.
- Required observation window and relevant system interval.
- Build/version and environment that will be tested.

If the failure condition cannot be stated, the check is not ready. Do not hide multiple claims behind a single item such as "monitoring works."

## Match observation depth to time behavior

A single snapshot is sufficient only for static facts such as deterministic configuration or file content.

For asynchronous, time-dependent, absence, or persistence claims:

- **Logs:** capture a baseline before the action, inspect immediately after it, then inspect again after further relevant activity. Poll with a bounded timeout spanning at least two retry or job intervals. Scope output by timestamp, cursor, or unique marker so old lines cannot satisfy the check.
- **Metrics:** issue a range query covering at least two scrape intervals. Verify sample timestamps and continuity across the window. Do not treat an instant query or stale last-known value as proof that collection is current.
- **Persistence:** verify state before the triggering event, immediately after it, and again after at least two relevant system intervals. For restart, failover, or upgrade claims, the event itself must occur during the test.
- **Data flow:** create a uniquely identifiable input or workload and find its expected output at the claimed destination.
- **Absence:** observe for the complete relevant interval. A quick empty result does not prove continued absence.

Determine intervals from the actual configuration or implementation. If the necessary window cannot be observed, report the check as incomplete or smoke-tested; do not shorten the window silently.

## Check the layer named by the claim

Do not substitute a cheaper adjacent check:

- **Agent/process:** verify the exporter or agent is actually running and healthy, not merely registered or present.
- **Metric/data:** verify fresh data flows over a range and has the expected labels and values.
- **API/CLI:** verify the response semantics and resulting state, not only a zero exit code or HTTP success status.
- **UI:** verify the dashboard, panel, or control a user sees renders the expected result without error, following `ui-evidence`.
- **Persisted state:** read the state again after the lifecycle event named by the requirement.

When a requirement spans layers, verify each material boundary. State which layers were checked and which were not. A metrics API result does not prove a user-facing dashboard works, and a rendered panel does not by itself prove persistence across restart.

## Resolve anomalies before reaching a verdict

Stop on unexpected output, unexplained log entries, timing gaps, inconsistent values, or results that are only "probably fine." Either:

1. Explain why the anomaly is benign using additional evidence, or
2. Record it as a finding and fail or block the affected check.

Never narrate past an anomaly while reporting the surrounding check as verified.

## Seed migrations and upgrades with meaningful data

Do not verify "no data loss" against a fresh empty instance. Before a migration or upgrade:

1. Create realistic ticket-relevant data, settings, users, or monitored services.
2. Record the pre-change values and tested source version.
3. Perform the real migration or upgrade.
4. Verify the same content immediately afterward and again after relevant background processing.
5. Exercise at least one post-change read/write path so preserved but unusable data is not mistaken for success.

## Select high-risk regression checks

For a runtime change, add the two highest-risk regression checks. Add a third only when it covers a materially different risk. Select a check only when all three conditions hold:

1. **Causal link:** the changed code, configuration, dependency, data path, permission, or lifecycle step could plausibly break it.
2. **Material impact:** failure would affect a common workflow, data integrity, security, upgrades/compatibility, or monitoring availability.
3. **Useful signal:** the check is deterministic, has a clear expected result, and is not already proved by a requirement check.

Rank candidates using the PR diff, shared callers, existing tests, relevant FB/CI failures, and prior bugs. Prefer:

1. Existing behavior that uses the same changed boundary or shared component.
2. Persistence, restart, upgrade, permission, or failure/recovery behavior touched by the change.
3. The nearest supported version, engine, topology, or configuration following the same code path.

For every selected regression, record the changed path that makes it relevant and the failure it is intended to catch. Reject broad checks such as "open another dashboard" or "check another database" unless the diff shows a shared dependency. If fewer than two meaningful regressions exist, do not invent them; record why the change has no additional plausible regression surface.

## Report only what the evidence supports

Use one of these labels:

- **Smoke tested:** the mechanism ran on the happy path, but the required layer, observation window, persistence, or anomaly investigation was not completed.
- **Verified:** the falsifiable checklist passed at the correct layer, required observation points/windows completed, and no anomaly remains unexplained.

For every verified check, record:

```text
Claim:
Build/version:
Environment:
Layer(s):
Command/query/action:
Expected:
Actual:
Observation window/intervals:
Result: VERIFIED | FAILED | BLOCKED
```

Record smoke tests separately. Never convert incomplete evidence into a pass merely because the first observation succeeded.

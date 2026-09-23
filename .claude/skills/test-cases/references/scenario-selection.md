# Scenario selection and test-design techniques

Generate candidates only after the change-impact and failure model exists.

Categories are not quotas. Pick a technique because it matches the behavior or failure mechanism; do not apply all techniques to every ticket.

## Technique selection

| Situation | Primary technique | What to derive |
| --- | --- | --- |
| Input has meaningful valid/invalid classes | Equivalence partitioning | One representative per class that reaches a distinct branch |
| Behavior changes at threshold/default/unit | Boundary-value analysis | Values immediately below/at/above the transition |
| Result depends on multiple conditions | Decision table | Minimal combinations that exercise distinct outcomes |
| Entity moves through lifecycle/retry/reconnect states | State-transition testing | Valid/invalid transitions and recovery paths |
| Supported matrix has several dimensions | Pairwise/configuration reduction | Small set covering important interactions |
| Change spans several PMM components | Use-case/scenario testing | End-to-end path at meaningful boundaries |
| Historical bug or implementation shape suggests a failure | Error guessing | One evidence-backed adversarial scenario |

PMM-specific rules for these techniques:

- **Partitions and boundaries:** merge values that reach the same branch and have the same failure signal. Add empty, null, or special-character values only when the contract or implementation treats them differently, and extreme values only when PMM transforms them rather than passing them through.
- **Decision tables:** typical PMM dimensions are role × action, client × server version, feature flag × topology, state × requested transition, backend × feature, and explicit value × default. Keep only combinations with distinct behavior or a plausible interaction defect.
- **State transitions:** name the starting state, the exact trigger, and the expected next state. Drive the event that actually invokes the changed code — pod deletion, process restart, scrape, reconciliation, and migration are not interchangeable.
- **Configuration reduction:** first remove dimensions the change does not touch, then protect the high-risk combinations — oldest and newest supported versions, the changed backend, HA vs single-server where shared code differs, default and non-default configuration — and use pairwise only for what remains.
- **Scenario testing:** trace `user action -> API/CLI -> persistence -> agent/exporter -> metric/query/UI`, and assert a layer only when it catches a distinct defect.
- **Error guessing:** only when backed by the current implementation shape, a relevant PMM bug, a recurring mechanism from the catalogue, a known shared dependency, or a realistic residue or timing hazard. "Could break" is not enough.

## Candidate rules

Create one candidate per distinct public behavior or independently observable defect mechanism. Related hypotheses may share one case when they traverse the same product path and use compatible setup and verification layers.

### Happy path

Create a happy-path candidate for each distinct new/changed user workflow that is not already covered.

Different data values on the same branch belong in one parameterized case.

For sibling artifacts such as dashboards, alerts, or collectors, use a coverage matrix when each can regress independently.

### Negative/error path

Create a candidate only for real validation, authorization, timeout, retry, fallback, recovery, or "must not apply" behavior.

For a rejected write, verify the persistence boundary: the request fails **and state remains unchanged**.

Enumerate relevant write surfaces (UI/API/CLI/import/config) only when the change can behave differently across them.

### Persistence/restart/recovery

Create a candidate when the change writes settings, labels, credentials, schema, generated config, or cached state, or touches reconnect/reload/startup.

Use the shortest chain required by the risk:

1. write/change;
2. read source of truth;
3. trigger reload/restart/reconnect only if relevant;
4. assert final consumer.

Do not add "restart and check it works" without naming what could be lost or stale.

### Permissions/secrets

When authorization changes:

- assert at the API boundary;
- verify denied actions do not mutate state;
- use UI visibility only as a secondary assertion.

For secret handling, bound the exact log/response window and search for the exact test secret.

### Upgrade/compatibility

Create a candidate when the change adds a migration, modifies defaults/on-disk state, changes creation templates, or introduces version gates.

Seed meaningful pre-upgrade state — created the way the old version created it — then verify:

- post-upgrade read;
- post-upgrade write;
- relevant old/new side precheck.

Fresh install does not cover migration.

### Integration failures

Create a candidate when changed code crosses a PMM component boundary and adds or relies on a specific failure branch.

Trigger that branch deliberately and assert the PMM outcome:

- bounded timeout;
- retry count;
- explicit status/error;
- preserved state;
- recovery result.

Do not unplug the network without proving which branch it selects.

### Surface consistency

Create a candidate when UI/API/CLI serialize, normalize, validate, or persist the same capability differently.

One flow may assert multiple surfaces. Do not duplicate the full workflow per surface unless the implementations can regress independently.

### Regression

Reproduce the ticket's original failure as a pmm-qa case when deterministic, unless a pmm-qa test already asserts it. A test in the product repository does not replace it: the reported reproduction is the ticket's acceptance record, and product-repository tests change without QA review. When a Finding shows the fix is incomplete for the ticket's own defect, add that path to the reproduction case, with its Expected stating the correct behavior, so the gap stays tracked; the case publishes as `Draft` until the fix lands.

Add nearby regression candidates only when the change affects a shared boundary/caller/consumer and the candidate has a distinct failure signal.

"Same component" is not a causal link.

## Merge vs split

Merge when candidates:

- share the same trigger and setup;
- use the same selector and compatible verification layers;
- exercise one product path with one primary failure signal;
- differ only in representative data.

Split when candidates:

- assert opposite outcomes on the same path, such as a filter that must apply and one that must not;
- exercise different branches;
- use different service/node/role/version selectors;
- can regress independently;
- have different failure mechanisms;
- require different oracles.

Apply the strong-case gate in `strong-case-gate.md` after candidate generation.

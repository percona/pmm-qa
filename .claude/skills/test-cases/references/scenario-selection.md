# Scenario selection and test-design techniques

Generate candidates only after the change-impact and failure model exists.

Categories are not quotas. Pick a technique because it matches the behavior or failure mechanism.

## Technique selection

| Situation | Primary technique | What to derive |
| --- | --- | --- |
| Input has meaningful valid/invalid classes | Equivalence partitioning | One representative per behaviorally distinct class |
| Behavior changes at threshold/default/unit | Boundary-value analysis | Values immediately below/at/above the transition |
| Result depends on multiple conditions | Decision table | Minimal combinations that exercise distinct outcomes |
| Entity moves through lifecycle/retry/reconnect states | State-transition testing | Valid/invalid transitions and recovery paths |
| Supported matrix has several dimensions | Pairwise/configuration reduction | Small set covering important interactions |
| Change spans several PMM components | Use-case/scenario testing | End-to-end path at meaningful boundaries |
| Historical bug or implementation shape suggests a failure | Error guessing | One evidence-backed adversarial scenario |

Do not apply all techniques to every ticket.

## Equivalence partitioning

Use when inputs form classes that reach different behavior.

Examples:

- supported vs unsupported DB version;
- existing vs missing inventory object;
- authorized vs unauthorized role;
- explicit setting vs default setting.

Merge values that reach the same branch and have the same failure signal.

Do not create empty/null/special-character cases unless the contract or implementation treats them differently.

## Boundary-value analysis

Use only when behavior changes at a boundary:

- minimum/maximum;
- zero vs non-zero;
- inclusive/exclusive comparison;
- default fallback;
- timeout/retry budget;
- unit conversion;
- rounding;
- lookback/evaluation interval.

Use values immediately around the transition.

Do not test arbitrary extreme values that PMM passes through unchanged.

## Decision tables

Use when two or more conditions interact.

Typical PMM dimensions:

- role × action;
- client version × server version;
- feature flag × topology;
- state × requested transition;
- datasource/backend × feature;
- explicit value × default/fallback.

Create only combinations that produce distinct behavior or expose a plausible interaction defect.

Do not explode every permutation.

## State-transition testing

Use for:

- agent connectivity;
- task/backup state;
- inventory lifecycle;
- alert state;
- reconnect/retry;
- upgrade/migration;
- enable/disable flows.

Name:

- starting state;
- exact trigger;
- expected next state;
- invalid or recovery transition if relevant.

Drive the event that actually invokes the changed code. Pod deletion, process restart, scrape, reconciliation, and migration are not interchangeable.

## Pairwise / configuration reduction

Use when coverage depends on multiple supported dimensions and no single dimension is sufficient.

Examples:

`DB type × DB version × auth mode × topology`

First remove dimensions not touched by the change.

Then protect explicitly high-risk combinations:

- oldest/newest supported versions;
- changed backend;
- HA vs single-server when shared code differs;
- default and non-default configuration.

Use pairwise only for remaining combinatorial coverage. Pairwise does not replace a known high-risk combination.

## Use-case / scenario testing

Use when value comes from a cross-component user workflow.

Trace the actual path:

`user action -> API/CLI -> persistence -> agent/exporter -> metric/query/UI`

Do not assert every layer unless each assertion catches a distinct defect.

Prefer one flow that verifies the important propagation boundary.

## Error guessing

Use only when backed by:

- current implementation shape;
- a relevant historical PMM bug;
- a recurring failure mechanism;
- a known shared dependency;
- a realistic state residue or timing hazard.

Examples:

- rejected update persists;
- value saved but not consumed;
- reconnect uses stale cache;
- two entities collide on one key;
- retry counter is not reset;
- older client bypasses a new validation path.

"Could break" is not enough.

## Candidate rules

Create one candidate per distinct public behavior or independently observable defect mechanism. Related hypotheses may share one case when they use the same trigger, setup, and oracle.

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

Seed meaningful pre-upgrade state, then verify:

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

Reproduce the ticket's original failure when deterministic and not already caught.

Add nearby regression candidates only when the change affects a shared boundary/caller/consumer and the candidate has a distinct failure signal.

"Same component" is not a causal link.

## Merge vs split

Merge when candidates:

- share the same trigger and setup;
- use the same selector and oracle;
- exercise one product path with one primary failure signal;
- differ only in representative data.

Split when candidates:

- exercise different branches;
- use different service/node/role/version selectors;
- can regress independently;
- have different failure mechanisms;
- require different oracles.

## Refuse

Refuse candidates that:

- exist only because a technique/category is available;
- test Grafana, VictoriaMetrics, or a DB engine instead of PMM's contract;
- repeat an existing assertion with different data on the same branch;
- require unbounded waiting;
- assert only presence/success/generic failure;
- cannot name the implementation change or invariant that would make them fail;
- add a configuration combination with no interaction rationale.

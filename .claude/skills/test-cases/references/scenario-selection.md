# Scenario selection

Use these rules to turn requirements and implementation branches into candidates. Categories are prompts, not a checklist. A category never justifies a case by itself.

## Happy path

Create one candidate for each distinct public workflow added or changed by the ticket. Different data values on the same branch belong in one parameterized case.

Do not create another happy path when an existing assertion already proves the same result or when a pull request unit test proves an internal branch with no additional PMM integration risk.

## Negative and error paths

Create a candidate when the ticket or diff adds or changes:

- input validation or an explicit rejection branch;
- permissions or authentication;
- timeout, retry, fallback, or recovery behavior;
- a failure previously reported by a user;
- a place where the feature must not appear or apply.

Enumerate all write surfaces before selecting the case: UI, API, CLI, import, and configuration. Test the persistence boundary so a rejected request must leave stored state unchanged. Merge invalid values that reach the same rejection branch.

Refuse generic empty, null, special-character, and malformed-input cases when neither requirements nor implementation define their behavior.

## Boundaries and defaults

Create a candidate only when behavior changes at a boundary: minimum, maximum, default, unit conversion, rounding, comparison, empty-collection semantics, or replace-versus-merge behavior.

Choose values immediately around the transition and assert the resulting public behavior. Do not add maximum-length or extreme-number tests for values that PMM merely passes to another component unchanged.

If only the UI enforces the boundary while the API does not, record that mismatch as a Finding before deciding whether it is intended.

## State transitions

Create a candidate when an entity changes state or can become stale: agent status, backup state, node health, alert state, task progress, or inventory membership.

Drive the event that actually calls the changed code. A pod deletion, Helm scale-down, process restart, scrape, reconciliation cycle, and migration are not interchangeable. Read the call site and name the trigger in Preconditions.

Assert state through the API or owning service; a UI badge alone is not the oracle.

## Persistence, restart, and recovery

Create a candidate when the change writes settings, labels, credentials, schema, or cached state, or when it touches startup, reconnect, replay, or supervision.

Use the shortest relevant chain:

1. Write the value through the changed surface.
2. Read it back from the source of truth.
3. Trigger reload, restart, or reconnect only when the risk requires it.
4. Assert the value at its consumer, such as exporter flags or metric labels.

Do not add “restart and check it works” without naming the value or transition that could be lost.

## Permissions and secrets

Create a candidate when a write, endpoint, route, role check, anonymous path, LBAC rule, or credential handling changes.

Assert authorization at the API boundary and confirm denied actions do not mutate state. UI visibility is a secondary assertion. For secrets, perform the action and search the relevant bounded logs and responses for the exact secret value.

## Upgrade and compatibility

Create a candidate when the change adds a migration, changes defaults or on-disk state, alters an object template used only at creation, or introduces client, server, agent, database, or plugin version gates.

Seed meaningful state before upgrade, then verify a read and a write after upgrade. A fresh installation does not cover migration. Test the side that performs prechecks as well as the new artifact it evaluates.

## Integration failures

Create a candidate when changed code crosses a PMM component boundary or calls a database, exporter, cloud API, notification service, or backup tool and adds a specific failure branch.

Trigger that branch deliberately and assert the PMM outcome: bounded timeout, retry count, status, user-facing error, and unchanged state as appropriate. Do not unplug the network without knowing which branch and result it selects.

## Surface consistency

Create a candidate when the same capability spans UI, API, and CLI, or when one surface validates, normalizes, or serializes differently from another. One end-to-end flow may assert multiple surfaces; do not duplicate the whole flow for each surface.

Treat an intentional product difference as a Finding, not a test failure.

## Regression

Reproduce the ticket's original failure when it is deterministic and not already caught. Add nearby regression candidates only when the change affects a shared boundary or caller and the candidate has material impact and a distinct failure signal.

“Same component” is not a causal link. Do not propose rerunning a broad suite as a test case.

## Refuse

Refuse candidates that:

- exist only because a category was available;
- test Grafana, VictoriaMetrics, or a database engine rather than PMM's contract with it;
- repeat an existing assertion with different data on the same branch;
- require an unbounded wall-clock wait;
- assert only presence, success, non-zero exit, or a generic error;
- cannot name the change that would make them fail.

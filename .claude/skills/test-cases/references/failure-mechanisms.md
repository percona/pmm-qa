# Failure mechanisms

Use these prompts only when the ticket or implementation makes the mechanism reachable. Each candidate must still pass the strong-case gate in `SKILL.md`.

## False greens

- **Empty collection:** per-item assertions execute zero times. Seed at least one item before asserting list or schema behavior.
- **Coarse failure:** “not running,” “an error appears,” or a non-zero exit can pass for the wrong reason. Assert the specific code, condition, state, and lack of mutation.
- **Wrong log window:** the relevant line predates the action or appears at another severity. Capture a baseline timestamp and bound the search.
- **Hand-built fixture:** producer and consumer disagree while the fixture agrees with the consumer. Generate data through the real producer or verify the fixture against it once.
- **Denial looks empty:** authorization failure renders like no data. Assert the network/API result and distinguish forbidden from empty.
- **No-data shape:** code derives structure from the first row and fails on zero rows. Exercise the empty result through the real transform.

## Repetition and residue

- **Idempotence over residue:** a retry reports success while silently reusing a partial record. Seed the residue and verify final ownership and state.
- **Recreate during teardown:** top-level deletion finishes before downstream cleanup. Recreate the same name immediately and assert the new object, without sleeping.
- **Second failure:** a guard or retry counter is not reset. Trigger the same fault twice.
- **Aborted operation poisons another:** a failed multi-phase action leaves shared state. After the failure, run a different operation that uses that state.
- **Rejected input persists:** validation returns an error but stores the value. Read the source of truth after rejection.

## Propagation between layers

- **Stored but not consumed:** UI/API shows the value while the exporter, metric, or agent still uses the old value. Assert both storage and the final consumer.
- **Cached handle survives restart:** product status is healthy but a dependency restart leaves a stale socket, session, or process handle. Assert fresh output at the consumer.
- **Retry lost during rewrite:** the happy path works while transient failure becomes permanent. Observe bounded attempts before escalation.
- **Acknowledged before delivery:** work is marked complete before a peer confirms it. Reject an intermediate delivery and assert it is offered again.
- **Parser/reporter asymmetry:** a setting is accepted but absent from status output, or reported but never applied. Compare the accepted configuration with running state.

## Versions and upgrades

- **Feature gate uses the wrong version:** server fix depends on an older client or agent that never executes the new branch. State every relevant version in Preconditions.
- **Old code drives the upgrade:** old prechecks evaluate a new artifact using obsolete assumptions. Exercise the precheck from the old side.
- **Recovery precedes readiness:** startup replays persisted state before dependencies are ready and enters a restart loop. Seed several stale items and prove a new request succeeds.
- **Backend parity is incomplete:** a feature is ported but its negative paths are not. Parameterize the same behavior across only the backends that share the changed contract.

## UI and dashboards

- **Concrete value skips interpolation:** a datasource, URL, query, or title works with a literal but leaks `${var}`. Use a variable and assert the outgoing request.
- **Copy differs from view:** snapshot, export, or share loses generated entities while the live dashboard is correct. Assert the serialized copy.
- **Legacy URL resolves incorrectly:** old encoding points to the wrong entity rather than failing. Use a compact table of new, legacy, empty, duplicate, and unknown identifiers only when URL parsing changed.
- **Response order changes the result:** two requests race and one overwrites the other. Reverse their completion order and assert value and position.
- **Role changes requests:** a page renders while calling an endpoint the role cannot use. Assert the request set and authorization result per relevant role.

## Observation rule

Assert at the layer where the defect becomes meaningful. For asynchronous behavior, find the product constant—scrape interval, retry budget, evaluation interval, or lookback—and set a bounded observation window that crosses it. A shorter window can pass on the broken build.

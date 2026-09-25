# Failure catalogue

One entry per mechanism: how the product could be wrong, how to probe it, and the PMM bugs where it happened. Read it after tracing the path in `change-impact-and-failure-model.md`, and write every mechanism the traced path can reach into the notes as a hypothesis. A `PMM-*` key is a Jira bug; a `PMM-T*` key is a Zephyr observation. Keys were checked against Jira on 2026-09-23; a key illustrates its mechanism, so read the ticket before citing it in a draft. History is evidence only when its mechanism is reachable from the current change; a shared component or page is not.

## False greens

- **Empty collection:** per-item assertions execute zero times. Seed at least one item before asserting list or schema behavior.
- **Coarse failure:** "not running", "an error appears", or a non-zero exit passes for the wrong reason. Assert the specific code, condition, state, and lack of mutation.
- **Wrong log window:** the line predates the action or sits at another severity. Capture a baseline and bound the search.
- **Hand-built fixture:** producer and consumer disagree while the fixture agrees with the consumer. Generate data through the real producer.
- **Denial looks empty:** an authorization or privilege failure renders like no data. Assert the API result and distinguish forbidden from empty. History: PMM-14717.
- **No-data shape:** structure is derived from the first row and fails on zero rows. Exercise the empty result through the real transform.

## Repetition and residue

- **Idempotence over residue:** a retry reports success while reusing a partial record. Seed the residue and verify final ownership.
- **Recreate during teardown:** top-level deletion finishes before downstream cleanup. Recreate the same name immediately and assert the new object.
- **Second failure:** a guard or retry counter is not reset. Trigger the same fault twice.
- **Aborted operation poisons another:** a failed multi-phase action leaves shared state. Run a different operation that uses it.
- **Rejected input persists:** validation returns an error but stores the value, or a removal on one surface leaves another surface broken. Read the source of truth after rejection; assert the exporter stays Running. History: PMM-15130, PMM-15201, PMM-13120.

## Propagation between layers

- **Stored but not consumed:** UI or API shows the value while the exporter, metric, or agent uses the old one. Assert storage and the final consumer after the relevant reload. History: PMM-15074, PMM-15354, PMM-15241, PMM-14931.
- **Cached handle survives restart:** status is healthy but a dependency restart leaves a stale socket or session. Assert fresh output at the consumer.
- **Reconnect does not resume:** the agent shows Connected, or never reconnects, while metrics stay stale. Drop and restore the link; assert Connected and a fresh sample after one reconnect cycle. History: PMM-15310, PMM-15200, PMM-14442, PMM-13994.
- **Retry lost during rewrite:** transient failure becomes permanent. Observe bounded attempts before escalation.
- **Acknowledged before delivery:** work is marked complete before a peer confirms it. Reject an intermediate delivery and assert it is offered again.
- **Parser/reporter asymmetry:** a setting is accepted but absent from status, or reported but never applied. Compare accepted configuration with running state.
- **Auth or TLS variant breaks collection:** a new auth default, skip-verify, or certificate path works only for the variant the developer tried. Exercise the variant and DB version the change touches. History: PMM-15259, PMM-14519, PMM-15188.
- **Exporter output is wrong:** duplicate series, runaway queries, or false values. Compare the metric with the DB source; bound log and query-count checks. History: PMM-15198, PMM-14958, PMM-14906, PMM-15161.
- **Proxy change breaks one leg:** an nginx or proxy edit takes out ingestion or a diagnostics path while the UI still renders. Assert the write leg and the admin path separately. History: PMM-15030.

## Lifecycle, HA, and topology

- **Trigger substitution:** Helm scaling, pod deletion, process restart, reconciliation, scrape, reconnect, leader election, and migration are different triggers. Drive the one the implementation observes.
- **Cluster state lies:** stale inventory, false health, wrong proxy routing, or restart failure in HA. Drive the real cluster trigger, assert at the owning layer, and test unhealthy as well as healthy. History: PMM-15227, PMM-14734, PMM-15228.
- **HA differs from single-server:** chart defaults, image pins, feature gates, and code that checks for HA mode change what exists. Render effective values and read the HA-mode checks before assuming a component is present. History: PMM-T2217, enabling QAN refused in HA by a code check in `managed/services/server/server.go`.
- **Restore leaves the database down:** the restore reports success, tool versions conflict, or polling misreports state. Perform a real restore and assert the DB is running and queryable. History: PMM-15163, PMM-14594.
- **Missing series resolves a firing alert:** hold the condition past the evaluation and lookback window and assert the alert stays firing. History: PMM-14193, PMM-15145.

## Versions and upgrades

- **Feature gate uses the wrong version:** a server fix depends on a client or agent version that never runs the new branch. State every relevant version in Preconditions.
- **Old code drives the upgrade:** old prechecks or an old UI evaluate the new artifact with obsolete assumptions, such as polling an endpoint the new version removed. Exercise the upgrade from the old side. History: PMM-15266.
- **Recovery precedes readiness:** startup replays persisted state before dependencies are ready and loops. Seed several stale items and prove a new request succeeds. History: PMM-15404, PMM-15050.
- **Backend parity is incomplete:** a feature is ported but its negative paths are not. Parameterize across only the backends sharing the changed contract.
- **Works fresh, not upgraded:** a datasource, plugin, theme, or dashboard is correct on a fresh install and broken after upgrade with seeded state. History: PMM-15155.
- **Installer ignores what is installed:** a package conflicts with itself or the installer skips the installed version. Install or upgrade over an existing supported version, then verify the client runs. History: PMM-15015, PMM-15126.

## Authorization and secrets

- **UI hides, API allows:** the action is hidden while the backend accepts the mutation. Deny at the API boundary and verify unchanged state. History: PMM-15138, PMM-15139, PMM-15309.
- **Trusted marker is client-suppliable:** a header, token, or flag a component trusts survives from the request. Send it from an unprivileged caller on every route that reaches the component.
- **Header overwrite lost in a location:** nginx sets the overwrite at server level, but a `location` that declares any `proxy_set_header` of its own inherits none of them, so a client-supplied header passes through that one route. Check each proxying location and send the header through it.
- **Secret in logs or responses:** bound the exact window and search for the exact test secret. History: PMM-15010.

## UI and dashboards

- **Concrete value skips interpolation:** a literal works while `${var}` leaks. Use a variable and assert the outgoing request.
- **Copy differs from view:** snapshot, export, or share loses generated entities. Assert the serialized copy.
- **Legacy URL resolves incorrectly:** old encoding points to the wrong entity rather than failing. Table new, legacy, empty, duplicate, and unknown identifiers only when parsing changed.
- **Response order changes the result:** two requests race and one overwrites the other. Reverse completion order and assert value and position.
- **Role changes requests:** a page renders while calling an endpoint the role cannot use. Assert the request set per relevant role.
- **Scheduler stops rescheduling:** a computed interval goes non-positive and nothing runs again, silently. Assert the periodic request fires within a bounded window.
- **Hidden tabs throttle timers:** work runs late while hidden. Assert the focus catch-up on return; never assert absence of work while hidden.
- **Client state the page cannot read:** a cookie or storage entry at another path or origin reads as absent. Confirm visibility from the app's own path first.
- **Grouping collapses entities:** panels double-count or group by the wrong label. Seed two entities sharing the default grouping key. History: PMM-15184, PMM-15091, PMM-15118, PMM-15114, PMM-15174.
- **Filter omits a topology:** All or multi-value filters drop standalone or asynchronous nodes. Exercise the non-default topology with several values selected. History: PMM-15240, PMM-13932, PMM-14938.

## Fresh history

For each inventory entry whose path touches persisted state, monitoring data flow, agents or exporters, permissions, lifecycle or retry, upgrade or version gates, HA or chart topology, dashboards or QAN, or a shared API, schema, or configuration, run one Jira search built from that entry's own identifiers: the component plus the field, flag, key, metric, state transition, or user-visible failure it names. Record the query and its hits in the notes beside the entry. Keep at most three bugs whose mechanism the current path can reach, and add each as a hypothesis. Whatever the depth tier, also run one search on the ticket's own user-visible symptom: a fix that regresses tends to come back as the same symptom under a new key, and that earlier ticket is the strongest reason to automate the check. Same component or same page alone is not a match. When the search is unavailable or inconclusive, write that in the notes and continue; absence of history is not evidence of safety.

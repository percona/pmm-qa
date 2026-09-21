# Worked example

One example of the reasoning chain, to calibrate depth: `change -> impact map -> invariant -> failure hypothesis -> technique -> case`. Read it only when the model or the case boundaries remain unclear after the references.

## Per-service setting propagation

**Change.** A CLI/API option adds a setting stored per monitored service and consumed by an exporter.

**Weak list.** Valid value works; invalid value fails; value survives restart; UI shows it. Nothing proves the exporter uses the saved value or that services stay isolated.

**Impact map.** `pmm-admin/API -> validation -> service record -> agent config -> exporter process -> metric`. Shared risks: one config structure for every service; reconnect reloads the setting; update may merge or replace fields.

**Invariants.** Accepted value is persisted and consumed. Service A's setting cannot reach service B. A rejected update leaves stored and running state unchanged. Reconnect does not revert the value.

**Hypotheses.** Stored but agent keeps the old config. Shared cache key leaks A's value into B. Update replaces unrelated fields. Rejected value is partially persisted.

**Techniques.** Equivalence partitioning for accepted and rejected classes; state transition for reconnect; scenario testing for storage-to-consumer propagation.

**Case A, apply to the correct service.** Two services with different explicit values. Update A. Assert A's source-of-truth value changed and B's did not. Trigger the config refresh only if the implementation needs it. Assert exporter A uses the new value and exporter B keeps its own. Catches stored-but-not-consumed, cross-service leakage, wrong merge scope.

**Case B, rejected update does not mutate running state.** Send a value that reaches the real rejection branch. Assert rejection, then read persisted state and assert the exporter still runs on the previous accepted value. Catches partial mutation after failed validation.

**Dropped.** "Restart and see if it works": no unique mechanism once Case A drives the reload path. Several random invalid strings: one rejection branch.

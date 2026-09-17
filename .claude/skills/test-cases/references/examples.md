# Worked reasoning examples

These examples teach **how to reason**, not what exact PMM cases must always exist.

The pattern is:

`change -> impact map -> invariant -> failure hypothesis -> technique -> final case`

## Example 1 — Per-service setting propagation

### Change

A CLI/API option adds or updates a setting that is stored per monitored service and consumed by an exporter.

### Weak candidate list

- valid value works;
- invalid value fails;
- value persists after restart;
- UI shows the value.

This is incomplete because it does not prove the final consumer uses the saved value and does not challenge cross-service isolation.

### Impact map

`pmm-admin/API -> validation -> service record -> agent config -> exporter process -> metric/output`

Shared risks:

- multiple services use the same config structure;
- reconnect/restart reloads the setting;
- update may merge or replace existing fields.

### Invariants

- accepted value is persisted and consumed;
- service A's setting cannot affect service B;
- rejected update leaves stored and running state unchanged;
- reconnect does not revert the value.

### Failure hypotheses

1. value is stored but agent keeps old config;
2. shared cache key leaks service A's value into service B;
3. update replaces unrelated fields;
4. rejected value is partially persisted.

### Techniques

- equivalence partitioning for accepted/rejected classes;
- state transition for reconnect;
- scenario testing for storage -> consumer propagation.

### Valuable cases

**Case A — Apply setting to the correct service**

Precondition: Two monitored services exist with different explicit values.

- Update service A.
- Assert API/source-of-truth value for A changed and B did not.
- Trigger the normal config refresh/reconnect only if required by implementation.
- Assert exporter A uses the new value and exporter B retains its own value.

Defects caught:
- stored-but-not-consumed;
- cross-service leakage;
- wrong merge scope.

**Case B — Rejected update does not mutate running state**

- Send a value that reaches the real rejection branch.
- Assert rejection.
- Read persisted state.
- Assert exporter/running state remains on the previous accepted value.

Defect caught:
- partial mutation after failed validation.

### Dropped

- "restart and see if it works" — no unique failure mechanism if reconnect/reload path is already exercised by Case A.
- several random invalid strings — same rejection branch.

---

## Example 2 — Dashboard grouping change

### Change

A dashboard query changes its grouping/label behavior.

### Weak candidate list

- dashboard opens;
- filter works;
- data is visible.

These can all pass while the dashboard silently merges independent entities.

### Impact map

`metrics -> query labels -> aggregation/grouping -> Grafana panel`

### Invariant

Independent entities must remain independently attributable.

### Historical challenge

A recurring PMM failure pattern is aggregation by the wrong label. One entity cannot expose that defect.

### Failure hypothesis

Two nodes/services sharing the default grouping field collapse into one series or double-count.

### Techniques

- use-case/scenario testing;
- equivalence partitioning across entity identity;
- decision table only if filter state also changes grouping.

### Valuable case

Precondition: Seed two entities that share the suspected grouping key but differ in the identity that must remain distinct.

- Generate controlled metrics for both.
- Open/query the changed panel.
- Assert both entities are independently represented and totals match source data.

Defects caught:
- wrong grouping label;
- accidental aggregation;
- double-counting.

### Dropped

- single-entity happy path — cannot reveal the named defect.
- all dashboard filters — unrelated unless filter serialization changed.

---

## Example 3 — Agent reconnect behavior

### Change

Code affecting agent connection/reconnect or server-side handling of reconnect is modified.

### Weak candidate list

- agent connects;
- disconnect agent;
- reconnect agent.

This proves only status unless monitoring recovery is also observed.

### Impact map

`connection loss -> reconnect policy -> registration/session -> exporter/agent work -> fresh metrics`

### Invariants

- one reconnect restores usable monitoring;
- stale session/cache does not survive reconnect;
- reconnect does not duplicate inventory/agents;
- recovery occurs within the product's bounded retry/refresh window.

### Failure hypotheses

1. Connected status returns but metrics remain stale;
2. old session handle survives and no new data is collected;
3. reconnect creates duplicate inventory;
4. retry counter is not reset after first failure.

### Techniques

- state-transition testing;
- error guessing from known reconnect failure mechanisms.

### Valuable case

Precondition: Agent is connected and producing a known fresh metric.

- Break the exact connection path observed by the implementation.
- Confirm disconnected state.
- Restore connectivity.
- Assert Connected within the configured reconnect window.
- Assert a metric timestamp/value becomes fresh after reconnect.
- Assert no duplicate agent/service inventory record exists.

Defects caught:
- false healthy status;
- stale session/cache;
- duplicate registration.

### Dropped

- arbitrary long sleep then "data exists" — weak oracle and unbounded timing.
- restarting unrelated components — does not drive the changed reconnect path.

---

## Example 4 — Role-controlled mutation

### Change

A UI/API action gains or changes role restrictions.

### Weak candidate list

- admin can see button;
- viewer cannot see button.

This can pass while the backend still accepts the mutation.

### Impact map

`UI visibility -> API request -> authorization -> persistent state`

### Invariants

- unauthorized user cannot mutate;
- denied request leaves state unchanged;
- authorized role still succeeds.

### Failure hypotheses

1. UI hides action but direct API call succeeds;
2. API returns error after mutation already happened;
3. one surface enforces role while another bypasses it.

### Techniques

- decision table for role × action;
- negative-path testing at persistence boundary;
- surface-consistency check if CLI/API/UI differ.

### Valuable cases

**Case A — Unauthorized mutation is rejected without state change**

- Capture source-of-truth state.
- Call the mutation as the restricted role.
- Assert authorization failure.
- Assert source-of-truth state is unchanged.

**Case B — Authorized role still mutates**

- Perform the same mutation as an allowed role.
- Assert persisted result.

Only add a separate UI case when visibility itself is part of the product contract or uses independent logic.

---

## Review heuristic

Before accepting a proposed case, ask:

1. Which exact change, invariant, historical mechanism, or shared dependency justifies it?
2. What specific defect would make this case fail?
3. Why would existing coverage not already fail?
4. Is the oracle at the layer where the defect matters?
5. Could the case be merged with another without losing a unique failure signal?

If any answer is vague, the case probably needs to be strengthened or dropped.

# Change impact and failure model

Use this before generating test cases.

The goal is to convert a code/ticket change into a model of **where it can fail and what else it can damage**. Do not start from "happy / negative / edge." Start from product flow and failure mechanisms.

## 1. Trace the real path

For every changed public behavior, trace:

`trigger -> validation -> state -> propagation -> consumer -> observation`

Record only steps that exist in the implementation.

### Trigger

How does the behavior start?

Examples:

- UI action
- API request
- `pmm-admin` command
- agent reconnect
- scrape/evaluation cycle
- Helm reconciliation
- upgrade/migration
- scheduled refresh
- database workload

### Validation / branch selector

What decides the behavior?

Examples:

- role/permission
- feature flag
- database type/version
- empty/non-empty input
- default vs explicit value
- current lifecycle state
- retry count
- threshold
- topology
- client/server compatibility

### State

What is read or written?

Examples:

- PostgreSQL row
- inventory object
- agent configuration
- browser state
- chart value
- generated config
- metric label
- cached object
- task status

### Propagation

How does state move?

Examples:

- server -> agent
- API -> DB -> exporter
- Helm values -> rendered template -> pod env
- DB -> exporter -> VictoriaMetrics -> Grafana
- API -> browser cache -> dashboard query

### Consumer

What actually uses the value?

Examples:

- pmm-agent
- exporter
- Grafana panel
- QAN
- alert evaluator
- backup worker
- inventory API
- CLI status/reporting

### Observation

Where would a user or test detect failure?

Prefer the owning public layer:

- API response/state
- persisted source of truth
- running exporter config
- metric
- query result
- CLI status
- visible UI behavior
- bounded logs only when logs are the contract

## 2. Build the blast-radius map

For each changed helper, schema, config object, API field, stored value, or shared component, identify:

- all writers;
- all readers/consumers;
- sibling entities sharing the same storage/config;
- lifecycle paths that reload it;
- retry/recovery paths;
- version gates;
- role/permission gates;
- single-server vs HA/chart differences;
- database/backend variants.

Do not assume "same component" means affected. Name the shared dependency.

### Example

A setting stored per service is changed.

Do not stop at:

`CLI -> API -> saved value`

Check:

`CLI -> API -> DB -> agent config -> exporter process`

Then ask whether:

- update of service A can overwrite service B;
- reconnect reloads the value;
- server restart preserves it;
- old client/new server combinations use the same field;
- UI reads the same source of truth.

## 3. Derive invariants

An invariant is a property that must remain true even when the change succeeds, fails, retries, or crosses versions.

Derive only invariants relevant to the changed path.

Common PMM invariants:

### Mutation safety

- rejected requests do not mutate persisted state;
- failed multi-step operations do not leave usable-looking partial state;
- updating one field preserves unrelated fields unless replacement is explicit;
- changing one service/node does not mutate another.

### Propagation

- accepted value == persisted value == consumed value;
- status/reporting reflects the value actually used;
- reconnect/restart does not silently revert accepted state.

### Lifecycle

- create -> update -> remove transitions preserve ownership and cleanup;
- retry does not duplicate resources;
- second failure behaves the same as first unless policy says otherwise;
- recreated objects do not inherit residue from deleted ones.

### Monitoring

- fresh data resumes after reconnect/restart;
- no duplicate series/labels are created;
- filters/grouping do not omit or merge independent entities;
- "no data" is distinguishable from authorization or collection failure.

### Upgrade / compatibility

- existing state survives upgrade;
- post-upgrade reads and writes both work;
- version-gated behavior is enforced at the correct side;
- unsupported combinations fail explicitly rather than silently degrade.

### Authorization

- denied actions are denied at the API boundary;
- denied mutations leave state unchanged;
- UI visibility does not substitute for server-side authorization.

## 4. Generate failure hypotheses

For each changed path or invariant, ask how the implementation could violate it.

Use concrete mechanisms.

### Wrong branch / selector

- default path used instead of explicit value;
- wrong role/version/topology selects branch;
- boundary uses `>` instead of `>=`;
- empty collection bypasses per-item validation.

### Partial mutation

- validation fails after part of state is written;
- update replaces instead of merges;
- rollback misses one resource;
- retry reuses partial residue.

### Stored but not consumed

- API shows new value but agent/exporter uses old one;
- cache survives restart/reconnect;
- one consumer still reads legacy field;
- generated config is not refreshed.

### Cross-entity leakage

- service A's value becomes global;
- shared cache key omits service/node ID;
- dashboard grouping collapses two entities;
- cleanup for one object deletes sibling state.

### Ordering / timing

- stale response overwrites a newer response;
- completion is acknowledged before downstream delivery;
- scheduler stops rescheduling after an error;
- recovery runs before dependency readiness.

### Compatibility

- old client is accepted but cannot drive the new behavior;
- migration preserves schema but not semantic state;
- chart feature gate disables a dependency the test assumes;
- backend B implements happy path but not rejection/recovery behavior.

### Authorization / visibility

- UI hides action but API permits it;
- forbidden data renders as empty data;
- role-specific request set differs from expected;
- secret is removed from UI but leaks into logs/response.

## 5. Use historical bugs to challenge, not copy

A historical PMM bug is useful only when it exposes a failure mechanism relevant to the current path.

Good:

- current change touches per-service grouping;
- historical bug showed aggregation by the wrong label;
- challenge the change with two independent entities.

Weak:

- both tickets mention Grafana;
- therefore create a dashboard test.

Extract the mechanism and apply it only if reachable.

## 6. Choose where a defect becomes meaningful

Assert at the layer where the defect matters.

Examples:

- validation defect -> API rejection + unchanged persisted state;
- propagation defect -> source of truth + final consumer;
- reconnect defect -> fresh metric/output after bounded reconnect cycle;
- aggregation defect -> panel/query result with two controlled entities;
- authorization defect -> API status + unchanged state.

A UI badge alone is usually insufficient when the owning state is server-side.

## 7. Stop conditions

Do not generate a test when:

- no changed behavior, invariant, dependency, or historical mechanism supports it;
- the defect is already caught by an existing assertion;
- the setup cannot reach the claimed branch;
- the oracle cannot distinguish the proposed defect from unrelated failure;
- the only justification is a generic testing category;
- the product simply passes the value through to an upstream component and PMM adds no contract around it.

The purpose of this model is **depth before breadth**: fewer cases, each tied to a credible failure mechanism.

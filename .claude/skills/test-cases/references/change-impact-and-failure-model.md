# Change impact and failure model

Use this before generating test cases.

The goal is to convert a code/ticket change into a model of **where it can fail and what else it can damage**. Do not start from "happy / negative / edge." Start from product flow and failure mechanisms.

## 1. Trace the real path

For every changed public behavior, trace:

`trigger -> validation -> state -> propagation -> consumer -> observation`

Record only steps that exist in the implementation. PMM-specific links are the ones most often skipped:

- **Trigger:** besides UI, API, and `pmm-admin`, the change may start from an agent reconnect, a scrape or evaluation cycle, Helm reconciliation, an upgrade or migration, a scheduled refresh, or database workload.
- **Propagation:** server -> agent; API -> DB -> exporter; Helm values -> rendered template -> pod env; DB -> exporter -> VictoriaMetrics -> Grafana; API -> browser cache -> dashboard query.
- **Consumer:** pmm-agent, an exporter, a Grafana panel, QAN, the alert evaluator, the backup worker, the inventory API, CLI status.
- **Observation:** prefer the owning public layer — API response or state, the persisted source of truth, running exporter config, a metric, a query result, CLI status, visible UI behavior; bounded logs only when logs are the contract.

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

Do not assume "same component" means affected. Name the shared dependency. A stored per-service setting, for example, is not done at `CLI -> API -> saved value`: follow it to `DB -> agent config -> exporter process`, then ask whether updating service A can overwrite B, whether reconnect reloads it, whether restart preserves it, whether an old client uses the same field, and whether the UI reads the same source of truth.

## 3. Derive invariants

An invariant is a property that must remain true even when the change succeeds, fails, retries, or crosses versions.

Derive only invariants relevant to the changed path.

Common PMM invariants:

### Mutation safety

- rejected requests do not mutate persisted state;
- failed multi-step operations do not leave usable-looking partial state;
- updating one field preserves unrelated fields unless replacement is explicit;
- changing one service/node does not mutate another.

Write the oracle as a state delta over named fields: a rejected operation leaves them unchanged (`S1 == S0`); an accepted one changes only the fields the request asked for. Compare decoded values of the fields the request could write, never a whole-row snapshot: PMM rewrites the full row on update, bumps `updated_at`, re-encrypts stored credentials with a fresh nonce, and agent reports change status and ports asynchronously, so a full snapshot fails on the fixed build.

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
- UI visibility does not substitute for server-side authorization;
- a header, token, or marker a component trusts cannot be supplied by the client;
- every route reaching a component that a new or widened filter, allow-list, or trusted marker protects enforces it — send the forbidden request from an unprivileged caller on each one.

When the change touches nginx, `auth_server`, vmproxy, or a Grafana proxy, enumerate those routes from the configuration rather than from How to test:

- every nginx `location` that proxies to the component, including exact-match locations — a location that declares any `proxy_set_header` inherits none from the server level, so check each one for the overwrite;
- Grafana's data-source proxy and resource routes, and its alerting and rule routes that forward to data sources;
- paths that reach the upstream directly and skip the proxy;
- the bind interface of the upstream and the proxy (`PMM_INTERFACE_TO_BIND`), which decides whether nginx is the only way in;
- the HA request path, where vmauth fronts VictoriaMetrics and routes only some endpoints.

Record the list in the notes. Choose an oracle that differs between the broken and the fixed build on every topology the change reaches: on HA an "empty result" can hold on both, so assert the status code.

## 4. Generate failure hypotheses

For each changed path or invariant, ask how the implementation could violate it. Use [failure-catalogue.md](failure-catalogue.md) as the single failure catalogue and select only mechanisms reachable from the current path.

## 5. Choose where a defect becomes meaningful

Assert at the layer where the defect matters — [test-level-selection.md](test-level-selection.md) picks the layer:

- validation defect -> API rejection + unchanged persisted state;
- propagation defect -> source of truth + final consumer;
- reconnect defect -> fresh metric/output after bounded reconnect cycle;
- aggregation defect -> panel/query result with two controlled entities;
- authorization defect -> API status + unchanged state.

A UI badge alone is usually insufficient when the owning state is server-side.

Apply the strong-case gate in `strong-case-gate.md` after candidate generation.

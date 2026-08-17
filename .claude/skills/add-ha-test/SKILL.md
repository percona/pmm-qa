---
name: add-ha-test
description: >-
  Write or debug Playwright e2e tests for PMM in High Availability mode —
  anything under e2e_tests/tests/ha/ or tagged @pmm-ha. Use when automating a
  PMM-Txxxx HA test case, when a test needs the Raft leader / failover /
  leader-follower roles / pmm_ha_* metrics / the sidebar HA badge, when touching
  k8s.helper.ts, haCluster.helper.ts, ha.api.ts, prometheus.api.ts or
  pages/ha/**, when an @pmm-ha test fails.
---

# Writing PMM HA e2e tests

HA is not "PMM with three replicas". Four things that are true for single-node
PMM are false here, and each has already produced a failing run:

| Assumption | Reality in HA |
|---|---|
| `/prometheus/api/v1/query` returns metrics | vmproxy fronts an external VictoriaMetrics **cluster** and 500s on the single-node query path |
| The API stays up while you poke the cluster | HAProxy routes only to the leader, so killing it 5xxs every request until a new one is elected |
| A UI check against the API proves something | The sidebar badge *and* the Inventory Nodes page both render from `/v1/ha/nodes` |
| A UI page recovers on its own after failover | Its React Query can be left holding a failed request; reload it |

Read [references/cluster-facts.md](references/cluster-facts.md) for the chart
topology, label reference and kubectl recipes.

## Where things live

| Path | What |
|---|---|
| `e2e_tests/tests/ha/` | the tests; every one tagged `@pmm-ha` |
| `e2e_tests/helpers/k8s.helper.ts` | generic namespaced `kubectl` (`getPods`, `deletePod`, `execInPod`, `scaleStatefulSet`, `assertReachable`) |
| `e2e_tests/helpers/haCluster.helper.ts` | HA-specific: `podNames`, `leaderFromPods`, `lastPromotionTime` |
| `e2e_tests/api/ha.api.ts` | `/v1/ha/status`, `/v1/ha/nodes`, `pmm_ha_leader_status` helpers, failover-tolerant polls |
| `e2e_tests/api/prometheus.api.ts` | PromQL via the Grafana datasource proxy |
| `e2e_tests/pages/ha/highAvailability.page.ts` | sidebar HA badge and "Leader:" row |

Fixtures: `k8sHelper`, `haClusterHelper`, `highAvailabilityPage`, `api.haApi`,
`api.prometheusApi`.

## Pick the oracle before writing the assertion

**Never assert a UI surface against the API that renders it.** That was the
first version of PMM-T2140 — it compared the Nodes page against `/v1/ha/nodes`,
which is exactly what the page fetches, so it would have passed even if the API
named the wrong leader.

| Asserting on | Use as truth |
|---|---|
| Sidebar badge, Inventory Nodes roles, anything rendering `/v1/ha/nodes` | `haClusterHelper.leaderFromPods()` |
| `pmm_ha_leader_status` | `/v1/ha/nodes`, or the badge — different code paths off the same Raft state |
| A failover actually happened | `haClusterHelper.lastPromotionTime()` before vs after |

`leaderFromPods()` asks each pod `/v1/server/leaderHealthCheck` directly:
**200 on the leader, 400 on followers**. It bypasses HAProxy, so it is
independent of the aggregated API and of the LB. This is the same check
HAProxy itself routes on, so it is a supported contract, not a scrape.

### Do not identify the leader from pod logs

`pmm-managed.log` looks tempting and is a trap twice over:

- **Losing leadership is not reliably logged.** A pod killed while leading never
  writes a demotion, so on a live cluster *every* pod's last leadership line is
  `I am the leader!`. "Last line wins" identifies all three as leader.
- **`/srv` is a PVC**, so the log survives pod restarts and carries promotions
  from previous elections — even previous test runs.

Only the *newest promotion across pods* identifies a leader from logs, and
`leaderFromPods()` is better in every way. Logs remain the right tool for one
thing: proving a **new** promotion happened during your test
(`lastPromotionTime` before vs after), which current-state checks cannot show.

## Read metrics through the Grafana datasource proxy

`PrometheusApi.instantQuery()` already does this. Do not reach for
`/prometheus/api/v1/query` — on HA it is served by vmproxy in front of a VM
cluster and returns 500. The datasource proxy
(`/graph/api/datasources/proxy/uid/<uid>/api/v1/query`) is the route Explore
takes, so it works on both standalone and HA. The UID is generated per
deployment and is looked up, never hardcoded.

## Anything that kills a pod must poll through 5xx

HAProxy health-checks `/v1/server/leaderHealthCheck` and only routes to the pod
answering 200. Delete the leader and **no** backend passes the check until Raft
elects a new one, so the API returns nginx 500s for a few seconds. A bare
`expect(status).toEqual(200)` fails on the first attempt.

Use the tolerant waits already there — `waitForLeaderInMetrics()` and
`waitForLeaderStatusSum()` in `ha.api.ts`, `waitForLeaderChange()` in
`haCluster.helper.ts`.

They are built on **`expect(async () => {...}).toPass()`**, which retries when the
callback *throws* — and a mid-failover request error is exactly that. Reach for
`toPass` whenever the thing being polled can throw; `expect.poll` retries on the
returned value but propagates a throw out of its callback, which is what rules it
out here. Never hand-roll a `while (Date.now() < deadline)` loop: `toPass` reports
the last failure itself, so the usual "last error seen" plumbing is dead weight.
Set the cadence with `intervals: [Timeouts.FIVE_SECONDS]`, not a manual sleep.

Then reload any page that was open during the failover before asserting on it:

```ts
await highAvailabilityPage.reloadAndExpandHaNavItem();
```

## API JSON is snake_case

pmm-managed's grpc-gateway marshals with `UseProtoNames`, so `/v1/ha/nodes`
returns `node_name` and `expected_nodes`. The PMM UI's own TypeScript types use
camelCase because the UI transforms them — **they are not a spec for the REST
response**. Copying them silently yields `undefined` on every field. Match the
repo's existing DTOs (`GetService` in `interfaces/inventory.ts`), which are all
snake_case.

## Never skip on a missing cluster — fail

An unreachable cluster is a broken environment, not a reason to pass. Do **not**
gate cluster-driving tests behind `pmmTest.skip`, and do not let a helper no-op
when `kubectl` is unavailable. `haClusterHelper.ensureServing()` already calls
`k8sHelper.assertReachable()`, which throws with kubectl's own stderr, so a
`beforeEach` is the whole gate:

```ts
pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});
```

Why this is not negotiable: A suite that
silently tests nothing is far worse than a red one. Failing also surfaces *which*
credential broke, which is what identified an EKS context with stale AWS creds where
an expired ROSA token had been assumed.

## Comment far less than feels natural

This suite is deliberately sparse. Write a comment **only** for a fact a competent
reader cannot get from the code and that cost real investigation — "this endpoint
500s on HA", "grpc-gateway emits snake_case", "demotions are not logged". One line,
two at the absolute most.

Delete on sight: anything restating a step name, a locator, an `eslint-disable`
reason or a signature; `@param` for a self-evident argument; and any rationale
already stated elsewhere in the file. The step names and `expect` messages here are
already prose — a comment above them is duplication, not documentation.

After writing a file, re-read every comment and cut the ones that do not survive
"could a competent reader work this out from the code?". The natural instinct is well past the bar.

## Prove the test can fail

Do not assume the test is working. A green HA test proves
little on its own — a locator that resolves to nothing,
or an oracle that echoes the thing under test, both look green. Mutate and
re-run:

Invert the expectation, not the assertion — inverting `toEqual` to
`not.toEqual` passes for the wrong reason.

## Running them

```bash
cd e2e_tests
npx playwright test --grep "@pmm-ha"
```

`playwright.config.ts` supplies `baseURL`/`ADMIN_PASSWORD`; `KUBECONFIG` must
point at the HA cluster. **Do not pass `--reporter=`** — a CLI reporter replaces
the config list, including the `junit` reporter Jenkins consumes.

Failover tests delete a leader pod on a shared cluster and leave leadership
moved. That is fine and self-healing, but:

- read-only tests (PMM-T2140) can run freely; destructive ones churn the cluster
- expect ~1.5 min for a failover test, ~20s for a read-only one
- check `kubectl get pods -n pmm` recovered before drawing conclusions from a
  later failure

CI: Jenkins `pmm3-ha-e2e-tests-gha.groovy` creates a ROSA cluster, copies its
kubeconfig, runs `--grep "${TAGS_FOR_TESTS}"` from `/srv/pmm-qa/e2e_tests`, then
publishes `output/junit.xml`. Tests run on the agent, **not** in the workspace —
anything a `post` step needs must be copied into `${WORKSPACE}` first.

## Report honestly

Say which cluster you ran against and what you verified. "Lint and typecheck
pass" is not "the test passes"; "the test passes" is not "the test would fail if
the product broke" — only the mutation run shows that. If you could not reach
the cluster, say the test was skipped rather than implying it ran.

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
- **Decision tables:** combine behavior conditions from the impact model with any environment dimensions already selected by the scope decision; keep combinations with distinct behavior or a plausible interaction defect.
- **State transitions:** name the starting state, the exact trigger, and the expected next state. Drive the event that actually invokes the changed code — pod deletion, process restart, scrape, reconciliation, and migration are not interchangeable.
- **Configuration reduction:** start with the selected scope dimensions and use pairwise only when several still interact.
- **Scenario testing:** trace `user action -> API/CLI -> persistence -> agent/exporter -> metric/query/UI` across the boundaries in the impact model.
- **Error guessing:** only when backed by the current implementation shape, a relevant PMM bug, a recurring mechanism from the catalogue, a known shared dependency, or a realistic residue or timing hazard. "Could break" is not enough.

## Candidate rules

Create one candidate per distinct public behavior or independently observable defect mechanism. Related hypotheses may share one case when they traverse the same product path and use compatible setup and verification layers.

### Regression

Reproduce the ticket's original failure as a pmm-qa case when deterministic, unless a pmm-qa test already asserts it. When a Finding shows the fix is incomplete for the ticket's own defect, add that path to the reproduction case, with its Expected stating the correct behavior, so the gap stays tracked; the case publishes as `Draft` until the fix lands.

Turn the causally linked regressions selected during scope into candidates with distinct failure signals; do not select another regression set here.

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

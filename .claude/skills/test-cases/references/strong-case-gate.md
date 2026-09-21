# Strong-case gate

The authoritative refusal policy. Apply it to every candidate after generation, before ranking.

Keep candidates only when **all** conditions hold:

1. **Traceable evidence**
   Name the acceptance criterion, implementation branch, invariant, historical defect mechanism, or explicit customer behavior that justifies it.

2. **Named defect**
   State the plausible defect and confirm the case would fail if that defect existed.

3. **Unique coverage**
   No existing assertion already catches the same defect. Otherwise classify as covered or extend.

4. **Reliable oracle**
   Assert a deterministic public result at the layer where the defect matters: API response, persisted state, CLI result, permission decision, exporter flag, metric, supported UI behavior, or other owning layer.

5. **Value exceeds cost**
   User/product impact justifies setup, runtime, credentials, and maintenance burden. This is a judgement, so write its one-line reason in the notes beside the verdict. If valuable but automation cost is the only blocker, mark it Manual and name the blocker.

6. **Blast-radius relevance**
   The test proves either the changed behavior or a credible affected dependency/caller/consumer identified in the impact model.

Reject candidates that test an upstream component rather than PMM's contract with it, or values PMM only passes through without adding a contract. Reject generic justification such as "best practice," "edge case," "realistic workflow," or "could break," and assertions such as "works," "page loads," "success," "non-zero exit," or "error appears." This gate is the authoritative refusal policy.

Each surviving case must be deterministic and outcome-focused. All five hold, for a manual case as much as an automated one:

1. **Verify its preconditions.** Assert the starting state rather than assuming it. A case that silently runs from the wrong state reports a defect that is not there, or hides one that is.
2. **Modify only explicitly identified test-owned state.** Name the exact row, service, agent, or file the case created, and address it by an identifier the case itself captured. `select max(id)`, "the most recent row", "the first service in the list" and similar are races against anything else using the environment — capture the identifier at setup and use it.
3. **Synchronize on observable events, not fixed sleeps.** Wait for the request, the status transition, the log line, or the metric to appear. When asserting an absence, bound the window with an observable event too — a completed poll cycle, a settled network, a second request that has since succeeded — and say which.
4. **Assert the intended result and the prohibited side effects.** The result alone passes when the product reaches it the wrong way. Name what must *not* happen: no redirect, no second write, no error notification, no extra request, no state left behind.
5. **Restore the original state in cleanup, including when the case fails.** Put restoration where a failure cannot skip it, and say what it restores. A case that changes state only on the happy path poisons every later case in the same environment.

One primary failure signal per case still applies. A case that cannot meet all five without contriving its setup is telling you the behavior is not deterministically testable at that layer — mark it Manual and say which point it fails, or move the assertion to a layer where it holds.

For each surviving case, confirm on the base branch that every pre-existing metric, label, field, endpoint, or other oracle input exists. Read the base branch only for inputs in files the change did not touch; a diff already read shows the base side of the rest. Give anything introduced by the change its own existence assertion; do not let a missing input masquerade as the behavior under test.


# Strong-case gate

The authoritative refusal policy. Apply it to every candidate after generation, before ranking.

Keep candidates only when **all** conditions hold:

1. **Traceable evidence**
   Name the acceptance criterion, implementation branch, invariant, historical defect mechanism, or explicit customer behavior that justifies it.

2. **Named defect**
   State the plausible defect and confirm the case would fail if that defect existed. For a bug, write `base: <what the broken build does> → fix: <what the fixed build does> → <assertion that tells them apart>`, derived from base-branch code or a pre-fix CI failure; this skill never runs the build to find out. When the two builds give the same observation on some topology, choose an oracle that differs there too.

3. **Unique coverage**
   No existing assertion already catches the same defect. Otherwise classify as covered or extend.

4. **Reliable oracle**
   Assert a deterministic public result at the layer where the defect matters: API response, persisted state, CLI result, permission decision, exporter flag, metric, supported UI behavior, or other owning layer.

5. **Value exceeds cost**
   User/product impact justifies setup, runtime, credentials, and maintenance burden. This is a judgement, so write its one-line reason in the notes beside the verdict. If valuable and deterministic but no lane or helper exists yet, mark it `Automation candidate — infra gap` and name the missing lane or helper.

6. **Blast-radius relevance**
   The test proves either the changed behavior or a credible affected dependency/caller/consumer identified in the impact model.

Reject candidates that test an upstream component rather than PMM's contract with it, or values PMM only passes through without adding a contract. A setting PMM configures on the upstream — a retention period, a scrape interval, a flag it renders — is PMM's contract, even when the upstream implements it. Reject generic justification such as "best practice," "edge case," "realistic workflow," or "could break," and assertions such as "works," "page loads," "success," "non-zero exit," or "error appears." This gate is the authoritative refusal policy.

Each surviving case must be deterministic and outcome-focused. Rules 1–3 always hold; rules 4 and 5 hold when their condition applies. This is true for a manual case as much as an automated one:

1. **Verify its preconditions.** Assert the starting state rather than assuming it. A case that silently runs from the wrong state reports a defect that is not there, or hides one that is.
2. **Modify only explicitly identified test-owned state.** Name the exact row, service, agent, or file the case created, and address it by an identifier the case itself captured. `select max(id)`, "the most recent row", "the first service in the list" and similar are races against anything else using the environment — capture the identifier at setup and use it.
3. **Synchronize on observable events, not fixed sleeps.** Wait for the request, the status transition, the log line, or the metric to appear. When asserting an absence, bound the window with an observable event too — a completed poll cycle, a settled network, a second request that has since succeeded — and say which.
4. **Assert the prohibited side effect the failure model names.** The result alone passes when the product reaches it the wrong way, so when a hypothesis names one — a redirect, a second write, an error notification, an extra request, state left behind — assert that it does not happen. Never add a side-effect row the failure model does not name: an invented one costs a step and catches nothing.
5. **When the case changes persistent or shared state, restore it in cleanup, including when the case fails.** Put restoration where a failure cannot skip it, and say what it restores; a case that changes state only on the happy path poisons every later case in the same environment. An irreversible change — an upgrade, a retention purge — restores by discarding the environment; say so. A read-only case has no cleanup.

One primary failure signal per case still applies. A case that cannot meet the rules that apply without contriving its setup is telling you the behavior is not deterministically testable at that layer — mark it Manual and say which point it fails, or move the assertion to a layer where it holds.

For each surviving case, confirm on the base branch that every pre-existing metric, label, field, endpoint, or other oracle input exists. Read the base branch only for inputs in files the change did not touch; a diff already read shows the base side of the rest. Give anything introduced by the change its own existence assertion; do not let a missing input masquerade as the behavior under test.


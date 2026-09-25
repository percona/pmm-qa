# Strong-case gate

The authoritative refusal policy. Apply it to every candidate after generation, before ranking.

Keep candidates only when **all** conditions hold:

1. **Traceable evidence**
   Name the acceptance criterion, implementation branch, invariant, historical defect mechanism, or explicit customer behavior that justifies it.

2. **Named defect**
   State the plausible defect and confirm the case would fail if that defect existed. For a bug, write `base: <what the broken build does> → fix: <what the fixed build does> → <assertion that tells them apart>`, derived from base-branch code or a pre-fix CI failure; this skill never runs the build to find out. When the two builds give the same observation on some topology, choose an oracle that differs there too. A case that gives the same result on the broken build and on the fixed build does not test the fix: keep it only when it names the later change it protects against, and rank it below the cases for the ticket's own defect.

3. **Unique coverage**
   No existing assertion already catches the same defect. Otherwise classify as covered or extend.

4. **Reliable oracle and layer**
   Start at the lowest pmm-qa layer that deterministically observes the named defect: API or CLI before UI, unless the rendered result or another higher-level behavior is itself the contract. A defect with no public pmm-qa observation point is a Finding, not a case. For asynchronous, freshness, restart, recovery, migration, or absence claims, apply the `verification.md` guidance loaded from `SKILL.md`.

   Match the oracle to the mechanism: validation and authorization need the API result plus unchanged state; propagation needs the source of truth plus final consumer; reconnect needs fresh output after its cycle; aggregation needs a query or rendered result over controlled entities. A UI badge alone is insufficient when the owning state is server-side.

5. **Value exceeds cost**
   User/product impact justifies setup, runtime, credentials, and maintenance burden. This is a judgement, so write its one-line reason in the notes beside the verdict. If valuable and deterministic but no lane or helper exists yet, mark it `Automation candidate — infra gap` and name the missing lane or helper.

6. **Blast-radius relevance**
   The test proves either the changed behavior or a credible affected dependency/caller/consumer identified in the impact model.

A Finding becomes a case only when the change decides its expected result deterministically. Behavior the change does not alter, or an expectation resting only on a comment or an open product decision, stays a Finding.

Reject candidates that test an upstream component rather than PMM's contract with it, or values PMM only passes through without adding a contract. A setting PMM configures on the upstream — a retention period, a scrape interval, a flag it renders — is PMM's contract, even when the upstream implements it. Reject generic justification such as "best practice," "edge case," "realistic workflow," or "could break," and assertions such as "works," "page loads," "success," "non-zero exit," or "error appears." This gate is the authoritative refusal policy.

Each surviving case must also follow every applicable rule below, whether manual or automated:

1. **Verify its preconditions.** Assert the starting state rather than assuming it. A case that silently runs from the wrong state reports a defect that is not there, or hides one that is.
2. **Modify only explicitly identified test-owned state.** Name the exact row, service, agent, or file the case created, and address it by an identifier the case itself captured. `select max(id)`, "the most recent row", "the first service in the list" and similar are races against anything else using the environment — capture the identifier at setup and use it.
3. **Synchronize on observable events, not fixed sleeps.** Wait for the request, state transition, log line, or metric. Bound an absence check with a completed opportunity such as a poll cycle or later successful request.
4. **Assert the prohibited side effect the failure model names.** The result alone passes when the product reaches it the wrong way, so when a hypothesis names one — a redirect, a second write, an error notification, an extra request, state left behind — assert that it does not happen. Never add a side-effect row the failure model does not name: an invented one costs a step and catches nothing.
5. **When the case changes persistent or shared state, restore it in cleanup, including when the case fails.** Put restoration where a failure cannot skip it, and say what it restores; a case that changes state only on the happy path poisons every later case in the same environment. An irreversible change — an upgrade, a retention purge — restores by discarding the environment; say so. A read-only case has no cleanup.

One primary failure signal per case still applies. A case that cannot meet the rules that apply without contriving its setup is telling you the behavior is not deterministically testable at that layer — mark it Manual and say which point it fails, or move the assertion to a layer where it holds.

For each surviving case, confirm on the base branch that every pre-existing metric, label, field, endpoint, or other oracle input exists. Read the base branch only for inputs in files the change did not touch; a diff already read shows the base side of the rest. Give anything introduced by the change its own existence assertion; do not let a missing input masquerade as the behavior under test.

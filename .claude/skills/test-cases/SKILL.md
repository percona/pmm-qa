---
name: test-cases
description: Design concise, evidence-backed test cases for a PMM Jira ticket or audit coverage of an existing PMM feature. Use when asked what should be tested for PMM-XXXXX, where existing coverage has gaps, or whether proposed coverage is sufficient. Compare requirements and current implementation with Zephyr and pmm-qa coverage, then produce a review draft of new, extended, covered, and dropped cases. Do not execute tests or write to Jira or Zephyr.
---

# Test cases

Turn a ticket or existing feature into the few test cases that can catch meaningful defects. Treat happy paths, negative scenarios, and edge cases as prompts, not quotas.

## Evidence sources

Read only the skills needed for the current step:

- Ticket context: `../jira/SKILL.md`
- Linked implementation: `../git-diff/SKILL.md`
- Existing manual cases: `../zephyr/SKILL.md`
- Environment dimensions when relevant: `../test-scope/SKILL.md`
- Observation layer or timing when unclear: `../verification-depth/SKILL.md`
- Candidate selection rules: [references/scenario-selection.md](references/scenario-selection.md)
- Known failure shapes: [references/failure-mechanisms.md](references/failure-mechanisms.md)
- Recurring PMM risks: [references/pmm-risk-patterns.md](references/pmm-risk-patterns.md)
- Coverage search and suite placement: [references/coverage.md](references/coverage.md)
- Test-case format and examples: [references/test-case-template.md](references/test-case-template.md)

The references above distill the reusable research from `../test-case-design/`. Keep that older skill as historical reference only; do not inherit its workflow, output size, publishing steps, or evaluation process.

## Workflow

### 1. Establish the test basis

For a ticket, use `jira` to read the summary, description, acceptance criteria, How to test, comments, components, labels, fix version, and linked pull requests.

For a coverage audit, name one narrow feature, then derive its public behavior from current code, API schemas, CLI help, configuration, documentation, and relevant historical bugs. Do not audit all of PMM at once.

Extract:

- the user-visible behavior and customer goal;
- each testable acceptance criterion or public behavior;
- constraints, roles, versions, and supported configurations;
- ambiguities, contradictions, and missing expected behavior.

Do not invent expected behavior to repair a weak ticket. Record uncertainty under Findings.

When ticket fields disagree with each other or with the implementation, the implementation and the pull request's acceptance checklist outrank the description. Report the disagreement as a Finding naming each source and its claim before proposing any case that depends on it.

### 2. Inspect the implementation

For a coverage audit, inspect the current implementation in every relevant repository. Use history and old tickets only to clarify intent; a linked pull request is not required.

Use `git-diff` to inspect **every** linked implementation pull request, regardless of repository. Common homes are `percona/pmm`, `percona/grafana`, `percona/percona-helm-charts`, and the exporter repository named by the ticket or dependency change. A feature may span several of them. Read changed files before hunks, then read behavior-changing code and the pull request's tests.

Inventory the distinct behavior changes before building candidates: one entry per behavior, not per hunk or exported symbol. This inventory is the input to step 3 and to the coverage table in step 7. Cover every linked pull request across repositories; for a coverage audit with no pull request, inventory the feature's current public behaviors the same way.

Inventory a wiring or registration change only when it changes execution, ordering, or availability. A relocated import that changes none of these is not an entry. Resolve such an entry to its own case only when it changes observable behavior beyond what another case already proves.

Use the Jira Development panel first. If it has no links, search the ticket key in each repository implied by the component and behavior; for HA or chart work always include `percona/percona-helm-charts`, and for exporter behavior include the relevant exporter repository. Do not take the no-implementation path until these candidates have been checked. If none contains a change, list the repositories searched in Findings.

A dashboard or component ticket predating a repository consolidation may have been fixed in an archived upstream repository outside the session's scope. Take the candidate name from the feature build's "Custom branches" list, then attach and clone it before reporting no implementation. A feature-build pull request is never the fix.

An inaccessible linked repository is not "no implementation." Report the access gap and do not state implementation-dependent expected results as facts.

When the ticket's fix version predates the current major and the implementation is absent from every candidate repository, treat the feature as removed, not unimplemented. Report obsolescence with the missing paths as evidence and stop.

For chart or HA work, read `../test-scope/references/ha.md` and inspect the effective chart configuration: templates, default values, image/version pins, and feature gates. Do not derive expected behavior from a single-server PMM default when the chart disables or replaces it.

Read the effective value of any constant a precondition will depend on — see "Effective constants" in [coverage.md](references/coverage.md).

Identify validation, errors, permissions, persistence, lifecycle transitions, version gates, shared callers, and externally observable outputs. Confirm on the base branch that every metric, label, field, or endpoint an expected result depends on already exists; give anything the change introduces its own existence assertion, since a missing input to an alert or a query fails silently.

Compare requirements and implementation in both directions:

- an acceptance criterion missing from the implementation is a Finding;
- implemented behavior absent from the ticket is a Finding or candidate, depending on whether it is a public contract;
- developer tests are existing lower-layer coverage, not automatic reasons for another end-to-end case.

For a ticket with no implementation, continue from its requirements and mark implementation-dependent expectations as unverified.

### 3. Build behavior candidates

Read [scenario-selection.md](references/scenario-selection.md), then use the matching area in [pmm-risk-patterns.md](references/pmm-risk-patterns.md). Read [failure-mechanisms.md](references/failure-mechanisms.md) when the change crosses components, persists state, handles retries or versions, or changes dashboards or UI data flow.

Create one candidate per distinct behavior or risk. Consider:

- happy paths for distinct user workflows;
- negative paths only for real validation, permission, error, or recovery behavior;
- edge cases only where a boundary changes behavior;
- regression coverage that reproduces the ticket's original failure;
- persistence, lifecycle, compatibility, upgrade, HA, or database variants only when the ticket or implementation makes them relevant.

Merge data variants only when they share the branch *and* the data that selects it. Keep cases separate when they exercise different branches, carry their own selector or threshold, or would fail for different reasons.

After choosing an induction method, trace it against each entry in the step 2 inventory. Name the entries it may bypass and pick a second method for those. Mutating server state may bypass client-side scheduling; mutating client state may bypass server-side rejection. Trace which applies rather than assuming.

### 4. Find existing coverage

Read [coverage.md](references/coverage.md).

Search both automation and Zephyr before deciding that a case is new.

For `pmm-qa`:

1. Run `git rev-parse --is-shallow-repository`, then `git log --all --grep PMM-XXXX`. In a shallow clone an empty result is not evidence of absence.
2. Search the ticket key and behavior identifiers such as API fields, CLI flags, routes, metrics, and persisted values with `rg --hidden -g '!.git/**'` so `.github/` workflows are included. Never pass `-r`: it is ripgrep's `--replace`, not a recursion flag.
3. Read the assertions of every relevant hit.

For Zephyr, use only read operations from the `zephyr` skill: `search`, `list`, and `get` as appropriate.

If Zephyr returns `truncated: true`, a missing match is inconclusive. Narrow the query or list the relevant feature folder until the result is not truncated; otherwise report `Zephyr dedup: inconclusive — truncated`.

Classify coverage by what the assertion would catch:

- **covered**: an existing assertion would fail if the candidate defect occurred;
- **extend**: the same flow exists but its assertion is too weak;
- **adjacent**: setup or subject is similar, but the behavior is not asserted;
- **none**: no relevant executable coverage exists.

A matching title, command, or ticket key is not coverage by itself.

### 5. Apply the strong-case gate

Keep a candidate only when **all** five conditions hold:

1. **Traceable evidence:** name the acceptance criterion, implementation branch, historical bug, or explicit customer behavior that justifies it.
2. **Named defect:** state the plausible defect that the case catches and confirm the case would fail if that defect existed.
3. **Unique coverage:** no existing assertion already catches the same defect; otherwise mark it covered or extend it.
4. **Reliable oracle:** assert a deterministic public result at the layer that matters, such as an API response, persisted state, CLI result, permission decision, exporter flag, metric, or supported UI behavior. Rejecting a candidate for lack of a deterministic oracle: name the caller or page checked. Accepting an oracle that depends on concurrency: show the concurrent requests are reproducible on the surface under test, and name the layer where the asserted quantity is counted.
5. **Value exceeds cost:** the user or product impact justifies the setup, runtime, credentials, and maintenance burden. Route a candidate that passes on user impact but fails only on automation cost to Manual only with its blocker named; do not drop it.

Reject generic justification such as "best practice," "test an edge case," "realistic workflow," or "could break." Reject assertions such as "works," "page loads," or "error appears."

Each surviving case must have controlled preconditions, bounded waits, cleanup when it changes state, and one primary failure reason.

### 6. Rank and write

Assign priority from failure impact, not ticket priority:

- **High:** security, data integrity, monitoring availability, upgrade safety, or a core workflow without a practical workaround;
- **Normal:** meaningful user-visible failure with a workaround;
- **Low:** cheap supporting coverage that should normally be merged into a stronger case rather than stand alone.

Write related actions and assertions as one flow. Set state through APIs or fixtures when UI setup is not the behavior under test.

### 7. Produce the review draft and stop

Read and follow [test-case-template.md](references/test-case-template.md) for every proposed case. Keep Findings and coverage decisions outside the case body.

Use this review structure:

```markdown
## <PMM-XXXX or feature> — test cases

Basis: <ticket summary or feature> · PRs: <repo#number or none> · Version: <version>

### Findings

- <requirement/implementation contradiction, ambiguity, or missing behavior>

### Implementation coverage

| Behavior | Source | Accounted for |
| --- | --- | --- |
| <what changed, in behavior terms> | <repo#PR — file or symbol> | <Case N / PMM-T key / dropped: reason> |

### Existing coverage

- <covered behavior> — <PMM-T key or path:line> — <assertion or missing assertion to extend>

### Proposed cases

<one test-case-template block per new case>

### Manual only

- <candidate> — <what a human should run> — <automation blocker: no fixture, no CI lane, no deterministic oracle>

### Considered and dropped

- <candidate> — <covered, same branch as case N, no evidence, nondeterministic, or cost exceeds value>
```

Implementation coverage carries one row per inventory entry from step 2, resolved to a case, to existing coverage, or to a stated drop reason. One table covers all linked pull requests together; drop `#PR` from `Source` for a coverage audit with none. A row may cite several cases and a case may resolve several rows.

Omit empty Findings, manual-only, and dropped sections; never omit Implementation coverage. Zero proposed cases is valid when existing coverage already catches every identified defect.

Do not execute cases, create or update Zephyr entries, modify Jira, or begin automation. Those actions require explicit user approval after review.

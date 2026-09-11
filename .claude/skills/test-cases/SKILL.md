---
name: test-cases
description: Design concise, evidence-backed test cases for a PMM Jira ticket or audit coverage of an existing PMM feature. Use when asked what should be tested for PMM-XXXXX, where existing coverage has gaps, or whether proposed coverage is sufficient. Compare requirements, implementation, historical defects, and current Zephyr/pmm-qa coverage; build a change-impact and failure model before proposing cases. Do not execute tests or write to Jira or Zephyr.
---

# Test cases

Turn a PMM ticket or existing feature into the few test cases most likely to catch meaningful defects.

Do not generate tests from category checklists alone. First understand the change, trace its blast radius, identify invariants and plausible failure mechanisms, choose the appropriate test-design technique, then filter against existing coverage.

## Evidence sources

Load no reference up front. Read it only when its workflow step applies:

- Ticket context: `../jira/SKILL.md`
- Linked implementation: `../git-diff/SKILL.md`
- Existing manual cases: `../zephyr/SKILL.md`
- Environment dimensions when relevant: `../test-scope/SKILL.md`
- Change impact and failure modeling: [references/change-impact-and-failure-model.md](references/change-impact-and-failure-model.md)
- Candidate generation and test-design techniques: [references/scenario-selection.md](references/scenario-selection.md)
- Known failure shapes when the initial model needs challenging: [references/failure-mechanisms.md](references/failure-mechanisms.md)
- Historical PMM risks for the behavior-changing areas named in step 4: [references/pmm-risk-patterns.md](references/pmm-risk-patterns.md)
- Worked reasoning examples only when the model or case boundaries remain unclear: [references/examples.md](references/examples.md)
- Coverage search and suite placement: [references/coverage.md](references/coverage.md)
- Test-case format: [references/test-case-template.md](references/test-case-template.md)

The references above are prompts for reasoning, not quotas. A technique, historical bug, or risk category never justifies a test by itself.

## Workflow

### 1. Establish the test basis

For a ticket, use `jira` with `fieldsCsv:"*all"` to read the summary, description, acceptance criteria, How to test, comments, components, labels, and fix version. Read How to test as a candidate induction mechanism before designing preconditions, then verify that it reaches the implementation branch under test.

The Jira relay cannot read the Development panel. Use linked pull requests already present in the supplied ticket context when available; otherwise search the repositories implied by the component and behavior for the ticket key. Report that Development-panel discovery was unavailable, because repository search can miss a linked pull request whose title and branch omit the key.

For a coverage audit, name one narrow feature, then derive its public behavior from current code, API schemas, CLI help, configuration, documentation, and relevant historical bugs. Do not audit all of PMM at once.

Extract:

- user-visible behavior and customer goal;
- each testable acceptance criterion or public contract;
- supported roles, versions, configurations, topologies, and databases;
- constraints and defaults;
- ambiguities, contradictions, and missing expected behavior.

Do not invent expected behavior to repair a weak ticket.

#### Contract conflicts

Do not silently treat implementation as the source of truth. The implementation is the subject under test.

Treat an AI-triage comment's root-cause analysis and recommended fix as unverified hypotheses. Use them to guide inspection, never as test basis; verify them against the linked or shipped implementation and record a mismatch as a Finding.

When ticket fields, documentation, API/CLI contracts, historical behavior, triage claims, PR acceptance notes, or implementation disagree:

1. record each source and what it claims;
2. identify which behavior is externally observable;
3. mark the mismatch as a Finding;
4. avoid asserting the disputed expectation as fact unless a controlling contract is explicit;
5. when useful, propose a test that exposes the mismatch rather than assuming one side is correct.

### 2. Inspect implementation and build a behavior inventory

For a coverage audit, inspect the current implementation in every relevant repository. Use history and old tickets only to clarify intent; a linked pull request is not required.

Use `git-diff` to inspect every supplied or discovered implementation pull request, regardless of repository. Common homes include `percona/pmm`, `percona/grafana`, `percona/percona-helm-charts`, and the exporter repository named by the ticket or dependency change.

Read changed files before individual hunks, then read behavior-changing code and developer tests.

Create one inventory entry per distinct externally meaningful behavior, not per hunk, function, or file.

For each inventory entry record:

- trigger or write surface;
- validation/branch that selects behavior;
- state read or written;
- downstream consumer;
- public observation point;
- shared helper/schema/configuration touched;
- version/topology/role constraints.

Inventory a wiring or registration change only when it changes execution, ordering, or availability.

Search every repository implied by the component and behavior when linked pull requests were not supplied. For HA/chart work include `percona/percona-helm-charts`; for exporter behavior include the relevant exporter repository. List the repositories searched when none contains the implementation.

For a ticket predating repository consolidation, use the feature build's Custom branches list to identify and inspect the archived upstream repository. A feature-build pull request is not the implementation.

An inaccessible linked repository is not "no implementation." Report the access gap.

When a ticket's fix version predates the current major and the implementation is absent from every plausible current repository, verify whether the feature still exists before designing implementation-dependent cases.

For chart or HA work, inspect effective chart configuration: templates, default values, image/version pins, and feature gates.

Read the effective value of any timeout, interval, retention, path, threshold, or other constant used by a proposed precondition or oracle.

Compare requirements and implementation in both directions:

- requirement with no implementation -> Finding;
- implementation with no requirement -> Finding or candidate if it changes a public contract;
- developer tests -> existing lower-layer evidence, not automatic reasons for another end-to-end case.

If no implementation is available, continue from the requirements. List the repositories searched or the access gap, mark implementation-dependent expectations as unverified, and do not present implementation-derived behavior as fact. Build the inventory from externally stated contracts and record `implementation unavailable` as its source.

### 3. Build the change-impact and failure model

Read [change-impact-and-failure-model.md](references/change-impact-and-failure-model.md).

For every behavior inventory entry, trace the shortest real product path:

`trigger -> validation -> state -> propagation -> consumer -> observable result`

Use the reference to inspect blast radius, derive relevant invariants, and write concrete failure hypotheses that name **how** the product could be wrong. Read [failure-mechanisms.md](references/failure-mechanisms.md) to challenge the model when relevant.

After choosing how to induce each behavior, trace that path against every inventory entry. Name any entry the setup bypasses and use a second induction path where needed. Mutating server state can bypass client scheduling; mutating client state can bypass server rejection.

### 4. Challenge with historical PMM defects

For behavior-changing tickets involving state, monitoring data flow, permissions, lifecycle, upgrade, HA, cross-component calls, dashboards, QAN, agents, exporters, or persistence, read and follow [pmm-risk-patterns.md](references/pmm-risk-patterns.md). For cosmetic/text-only changes, skip historical mining unless the implementation touches behavior.

If Jira search is unavailable or remains inconclusive, report the historical check as skipped or inconclusive and continue from requirements and implementation evidence. Do not imply that no relevant defects exist.

### 5. Choose a test-design technique and build candidates

Read [scenario-selection.md](references/scenario-selection.md).

Choose the technique that matches the risk and generate candidates from the failure model, not from a category quota. One case may cover several related hypotheses when they traverse the same product path and use compatible setup and verification layers; name one primary failure signal. Split independently selectable branches, environments, or oracles. Reproduce the ticket's original failure when deterministic.

### 6. Find existing coverage

Read [coverage.md](references/coverage.md).

Search both automation and Zephyr before deciding a case is new.

Use the coverage classifications and decisions in `coverage.md`; they are authoritative.

### 7. Apply the strong-case gate

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
   User/product impact justifies setup, runtime, credentials, and maintenance burden. If valuable but automation cost is the only blocker, route to Manual only and name the blocker.

6. **Blast-radius relevance**
   The test proves either the changed behavior or a credible affected dependency/caller/consumer identified in the impact model.

Reject candidates that test an upstream component rather than PMM's contract with it, or values PMM only passes through without adding a contract. Reject generic justification such as "best practice," "edge case," "realistic workflow," or "could break," and assertions such as "works," "page loads," "success," "non-zero exit," or "error appears." This gate is the authoritative refusal policy.

Each surviving case must have controlled preconditions, bounded waits, cleanup when it changes state, and one primary failure signal.

For each surviving case, confirm on the base branch that every pre-existing metric, label, field, endpoint, or other oracle input exists. Give anything introduced by the change its own existence assertion; do not let a missing input masquerade as the behavior under test.

### 8. Rank and write

Assign priority from failure impact, not ticket priority:

- **High:** security, data integrity, monitoring availability, upgrade safety, or a core workflow without a practical workaround;
- **Normal:** meaningful user-visible failure with a workaround;
- **Low:** cheap supporting coverage that should usually be merged into a stronger case.

Write related actions and assertions as one flow. Set state through APIs or fixtures when UI setup is not the behavior under test.

### 9. Produce the review draft and stop

Read and follow [test-case-template.md](references/test-case-template.md) for every proposed case.

Use this review structure:

```markdown
## <PMM-XXXX or feature> — test cases

Basis: <ticket summary or feature> · PRs: <repo#number or none> · Version: <version>

### Findings

- <contract conflict, ambiguity, missing behavior, inaccessible dependency, or unsupported assumption>

### Impact and failure model

| Behavior | Affected path / dependency | Failure hypothesis | Evidence |
| --- | --- | --- | --- |
| <changed behavior> | <trigger -> state -> consumer> | <specific defect> | <AC / PR / bug / invariant> |

### Implementation coverage

| Behavior | Source | Accounted for |
| --- | --- | --- |
| <what changed, in behavior terms> | <repo#PR — file or symbol / implementation unavailable> | <proposed-case title / PMM-T key / dropped: reason> |

### Existing coverage

- <covered behavior> — <PMM-T key or path:line> — <assertion or missing assertion to extend>

### Proposed cases

<one test-case-template block per new case>

### Manual only

<one test-case-template block per manual case, followed by `Automation blocker: <reason>`>

### Considered and dropped

- <candidate> — <covered / duplicate mechanism / no evidence / nondeterministic / cost exceeds value>
```

Keep the impact table concise: include only changed behaviors and failure hypotheses that materially influenced coverage decisions.

Implementation coverage must contain one row per behavior inventory entry and resolve it to the exact proposed-case title, existing coverage, or a stated drop reason.

Omit empty Findings, Existing coverage, Proposed cases, Manual only, and Considered and dropped sections. Always include Impact and failure model and Implementation coverage.

Zero proposed cases is valid when existing coverage already catches every meaningful identified defect.

Do not execute cases, create/update Zephyr entries, modify Jira, or begin automation without explicit user approval after review.

---
name: test-cases
description: Design evidence-backed test cases for a PMM Jira ticket, or audit test coverage of an existing PMM feature. Use when asked what to test or verify for PMM-XXXXX, for a test plan or QA plan, where Zephyr or pmm-qa automation coverage has gaps, or whether proposed cases are sufficient, even when the user only pastes a ticket key or pull request and asks how to check it. Produces a review draft first. Only after the user approves it, creates the cases in Zephyr and links them to the ticket. Reads Jira but never writes it. Never executes tests or provisions environments. Not for getting a PMM-T key for a test already being written; use the zephyr skill for that.
compatibility: Requires the sibling jira, git-diff, zephyr and test-scope skills, plus git, rg, curl and jq in a pmm-qa checkout, and RELAY_KEY for the Zephyr publishing step.
---

# Test cases

Turn a PMM ticket or existing feature into the few test cases most likely to catch meaningful defects.

Do not generate tests from category checklists alone. First understand the change, trace its blast radius, identify invariants and plausible failure mechanisms, choose the appropriate test-design technique, then filter against existing coverage.

## Evidence sources

Load no reference up front. Read it only when its workflow step applies:

- Ticket context: the `jira` skill
- Linked implementation: the `git-diff` skill
- Existing manual cases: the `zephyr` skill
- Environment dimensions when relevant: the `test-scope` skill
- Change impact and failure modeling: [references/change-impact-and-failure-model.md](references/change-impact-and-failure-model.md)
- Candidate generation and test-design techniques: [references/scenario-selection.md](references/scenario-selection.md)
- Known failure shapes when the initial model needs challenging: [references/failure-mechanisms.md](references/failure-mechanisms.md)
- Historical PMM risks for the behavior-changing areas named in step 4: [references/pmm-risk-patterns.md](references/pmm-risk-patterns.md)
- Worked reasoning examples only when the model or case boundaries remain unclear: [references/examples.md](references/examples.md)
- Coverage search and suite placement: [references/coverage.md](references/coverage.md)
- Test-case format: [references/test-case-template.md](references/test-case-template.md)
- Strong-case gate, the refusal policy for every candidate: [references/strong-case-gate.md](references/strong-case-gate.md)
- Zephyr folder choice and publishing after approval: [references/publish.md](references/publish.md)
- Missing, inaccessible, or conflicting evidence: [references/edge-cases.md](references/edge-cases.md)

The references above are prompts for reasoning, not quotas. A technique, historical bug, or risk category never justifies a test by itself.

When another agent or skill invokes this one, skip whatever that session already has — a skill file it read, ticket fields, pull-request diffs, effective constants, scope decisions — and re-fetch only what is missing. Hand the finished draft back after step 9 and skip step 10: the caller owns execution and any Zephyr writes. Step 10 runs only when a user invoked this skill directly. The workflow below assumes that direct invocation in a fresh session with nothing supplied.

## Workflow

### 1. Establish the test basis

For a ticket, establish the summary, description, acceptance criteria, How to test, comments, components, labels, and fix version — from the caller's supplied ticket context, or with `jira` using `fieldsCsv:"*all"` when none was supplied. Read How to test as a candidate induction mechanism before designing preconditions, then verify that it reaches the implementation branch under test.

Take linked pull requests from the supplied ticket context. When none were supplied, read [edge-cases.md](references/edge-cases.md) for discovery.

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

When ticket fields, documentation, contracts, triage comments, or implementation disagree, read [edge-cases.md](references/edge-cases.md) and record the mismatch as a Finding.

### 2. Inspect implementation and build a behavior inventory

For a coverage audit, inspect the current implementation in every relevant repository. Use history and old tickets only to clarify intent; a linked pull request is not required.

Use `git-diff` to inspect every supplied or discovered implementation pull request the session has not already diffed, regardless of repository. Common homes include `percona/pmm`, `percona/grafana`, `percona/percona-helm-charts`, and the exporter repository named by the ticket or dependency change.

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

When a linked repository is inaccessible, the ticket predates repository consolidation or the current major, or no implementation can be found, read [edge-cases.md](references/edge-cases.md) before continuing.

For chart or HA work, inspect effective chart configuration: templates, default values, image/version pins, and feature gates.

Read the effective value of any timeout, interval, retention, path, threshold, or other constant used by a proposed precondition or oracle.

Compare requirements and implementation in both directions:

- requirement with no implementation -> Finding;
- implementation with no requirement -> Finding or candidate if it changes a public contract;
- developer tests -> existing lower-layer evidence, not automatic reasons for another end-to-end case.

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

Read [strong-case-gate.md](references/strong-case-gate.md). Keep a candidate only when it passes all six gate conditions and all five determinism rules; mark it Manual, move its assertion to another layer, or drop it otherwise.

### 8. Rank and write

Assign priority from failure impact, not ticket priority:

- **High:** security, data integrity, monitoring availability, upgrade safety, or a core workflow without a practical workaround;
- **Normal:** meaningful user-visible failure with a workaround;
- **Low:** cheap supporting coverage that should usually be merged into a stronger case.

Write related actions and assertions as one flow. Set state through APIs or fixtures when UI setup is not the behavior under test. Write each Step as the action a person performs, at the layer a user of the feature uses — UI for UI behavior, `pmm-admin` for CLI behavior, the API only when the API is the contract under test; the exact command, query, or value goes in Data.

Then mark each case `Needs automation` or `Manual`. Automation is a standing maintenance cost, so it is the exception, not the reward for a good case.

Mark `Needs automation` only when all of these hold:

- the setup and the oracle are deterministic, with no timing race and no dependence on a restart, upgrade, or other multi-minute wait;
- it runs in the cheapest environment that can host it, and the suite for that environment already exists;
- existing helpers and page objects already reach the setup and the oracle, or the gap is one small helper;
- the behavior will keep changing, so the test keeps earning its upkeep.

Mark `Manual` otherwise, and say why in one clause. The usual reasons: it needs an expensive environment (HA/LKE) only to re-prove a mechanism an automated case already proves; it depends on a race, a restart, or wall-clock waiting; or it is a one-off verification for this ticket that no later change will regress.

### 9. Produce the review draft and wait for approval

Read and follow [test-case-template.md](references/test-case-template.md) for every proposed case.

The draft is the cases plus the few lines a reader needs to trust them. The impact and failure model, the behavior inventory, the existing-coverage search, and the drop reasons are working notes: they decide what gets written, and they stay out of the draft unless the user asks for them.

Use this review structure:

```markdown
## <PMM-XXXX or feature> — test cases

<Two to five lines of prose. What the change actually is in behavior terms; any correction to
the ticket's own How to test; any coverage the search could not reach. Nothing else — no
headings, no tables, no restating a case the reader is about to read.>

| # | Case | Pri | Env | Status | Folder |
| --- | --- | --- | --- | --- | --- |
| <N> | <short title> | <High \| Normal \| Low> | <Docker \| HA \| CLI \| …> | <Needs automation \| Manual> | <Zephyr folder path> |

---

<one test-case-template block per case, numbered and ordered as in the table>
```

Keep the prose honest and short: a wrong command in the ticket, a rejected root-cause hypothesis, or an unreachable evidence source is worth a line each; nothing else is.

Choose each case's Folder with the rule in [publish.md](references/publish.md), so the reviewer approves its placement with the case.

Every behavior inventory entry must still resolve to a case in the table, to named existing
coverage, or to a drop reason you can state on request. Say in one line that cases were dropped
and why in the aggregate — "the rest of the PR is unit-covered and does not earn an e2e" — rather
than listing each candidate.

Zero proposed cases is valid when existing coverage already catches every meaningful identified defect.

Do not execute cases, create/update Zephyr entries, or begin automation without explicit user approval after review. Approval unlocks Zephyr only (`create`, `steps`, `link-issue`): never post the draft or the cases as a Jira comment, and never write How to test or any other Jira field — the coverage link from step 10 is the ticket's record. Stop here and wait; when another agent invoked this skill, return the draft to it instead.

### 10. Publish the approved cases

Only when a user invoked this skill directly and explicitly approved the reviewed draft: read [publish.md](references/publish.md) and follow it for the approved cases.

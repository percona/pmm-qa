---
name: test-cases
description: Design and publish evidence-backed PMM test cases, audit pmm-qa and Zephyr coverage, select QA deployment and regression scope, define verification requirements for cases, and create, look up, or update PMM-T IDs. Use for test plans, what or how to test, coverage gaps, manual QA scope, Zephyr publishing, or standalone PMM-T operations. Not for executing QA or investigating failures; use test-runner or investigator, which load references/verification.md directly. Not for Jira ticket operations; use relay. Not for screenshots or recordings; use ui-evidence.
---

# Test cases

Own PMM test-case design, scope, verification quality, and Zephyr test-case workflow. Use the separate `relay` skill only for broker transport and payload schemas.

Do not generate tests from category checklists alone. First understand the change, trace its blast radius, identify invariants and plausible failure mechanisms, choose the appropriate test-design technique, then filter against existing coverage.

## Route the request

Load only the references required by the request:

- Full test-case design or coverage audit: follow the workflow below.
- Scope or “how should this be tested?” only: read [references/scope.md](references/scope.md) and, when HA is plausible, [references/ha-scope.md](references/ha-scope.md).
- Direct API, CLI, log, metric, persistence, lifecycle, or absence verification: read [references/verification.md](references/verification.md) after scope is known.
- Standalone PMM-T creation, lookup, status, or steps: read [references/zephyr.md](references/zephyr.md), then use the `relay` skill's Zephyr reference. Do not run the full design workflow for a test already being automated.
- Publishing an approved design: read [references/publish.md](references/publish.md), [references/zephyr.md](references/zephyr.md), and the `relay` skill's Zephyr reference.

## Evidence sources

Load no reference up front. Read it only when its workflow step applies:

- Ticket context and history searches: the `relay` skill's Jira reference
- Linked implementation: the `git-diff` skill
- Zephyr lifecycle and title rules: [references/zephyr.md](references/zephyr.md)
- Deployment, dimension, and regression scope: [references/scope.md](references/scope.md) and [references/ha-scope.md](references/ha-scope.md) when applicable
- Direct evidence depth: [references/verification.md](references/verification.md) when a claim is asynchronous, persistent, lifecycle-dependent, or otherwise indirect
- Change impact and failure modeling: [references/change-impact-and-failure-model.md](references/change-impact-and-failure-model.md)
- Candidate generation and test-design techniques: [references/scenario-selection.md](references/scenario-selection.md)
- Failure catalogue with PMM history, read with the model above: [references/failure-catalogue.md](references/failure-catalogue.md)
- One worked example, only when the model or case boundaries remain unclear: [references/examples.md](references/examples.md)
- Coverage search and suite placement: [references/coverage.md](references/coverage.md)
- Test-case format: [references/test-case-template.md](references/test-case-template.md)
- Strong-case gate, the refusal policy for every candidate: [references/strong-case-gate.md](references/strong-case-gate.md)
- Zephyr folder choice and publishing after approval: [references/publish.md](references/publish.md)
- Missing, inaccessible, or conflicting evidence: [references/edge-cases.md](references/edge-cases.md)

The references above are prompts for reasoning, not quotas. A technique, historical bug, or risk category never justifies a test by itself.

Scripts, run from the skill directory: `scripts/check_draft.py <draft.md>` checks a draft against the template (step 9); `scripts/check_publish_plan.py <plan.json>` checks a publish plan before any Zephyr write (step 10). They print JSON and exit non-zero on a finding or error.

## Gotchas

Facts about PMM's environment that a reasonable first attempt gets wrong:

- A pull request's own description or docs about how a third-party component behaves — VictoriaMetrics retention, ClickHouse partitions, Grafana routing — are the claim under test, not a contract. One such claim once dropped a ticket's acceptance case; the component's own docs said the opposite.
- Do not read or cite product-repository tests — unit tests, percona/pmm `api-tests`, exporter CI. Only pmm-qa tests and Zephyr count as coverage, so every defect the draft names gets a pmm-qa case or an explicit drop reason.
- The implementation can ship under another ticket key named in the ticket's links or comments.
- Review threads of repositories outside this session's scope return 403; read the commit sequence instead.
- An nginx `location` that sets any `proxy_set_header` inherits none from the server level, so a server-level header overwrite does not cover it.
- On HA, vmauth fronts VictoriaMetrics and routes only some endpoints, so an "empty result" oracle can pass on the broken build.

## Depth

Choose the depth once the step 2 inventory exists, record it and its trigger in the notes, and raise it — never lower it — if later steps find more. Choose by risk, not by the size of the diff: a one-file change that deletes data in HA is Deep.

- **Deep** when any inventory entry touches authentication, authorization, a proxy, secrets, HA or chart topology, upgrade or migration, data deletion or retention, a persisted schema, or more than one component.
- **Focused** when the change is local to one component and touches no persisted state, permission, topology, or version gate — a text, link, or style change, or a local fix whose output other components only read, without the change altering how they read it.
- **Standard** otherwise.

Focused skips the per-entry history search (step 4 keeps its one symptom search), scope references, and the worked example, and replaces the step 9 subagent with a self-check: every `Covered` row states what its assertion sees on the base branch. Deep adds the scope references, the route enumeration in [change-impact-and-failure-model.md](references/change-impact-and-failure-model.md) for any proxy or auth change, and always runs the step 9 subagent.

When another agent or skill invokes this one, skip whatever that session already has — a skill file it read, ticket fields, pull-request diffs, effective constants, scope decisions — and re-fetch only what is missing. Hand the finished draft back after step 9 and skip step 10: the caller owns execution and any Zephyr writes. Step 10 runs only when a user invoked this skill directly. The workflow below assumes that direct invocation in a fresh session with nothing supplied.

## Workflow

Keep working notes in `<scratchpad>/<ticket or feature>-notes.md`, one section per step: the behavior inventory and depth (step 2), the failure hypotheses and scope decision (step 3), the coverage ledger (step 6), and the gate verdict per candidate (step 7) with its mechanism, test level, scope dimension, topology, and oracle. Write a step's section before starting the next step; a candidate absent from the notes is not in the draft, and a dropped one keeps its row. The notes are what the user gets when they ask why a case is or is not there. Keep them terse — one line per entry, hypothesis, ledger row, and verdict, citing paths and lines instead of quoting code, diffs, or ticket text — since every later step re-reads them. Batch independent reads and searches into one command, and search only when the answer can change a case.

### 1. Establish the test basis

For a ticket, establish the summary, description, acceptance criteria, How to test, comments, components, labels, and fix version — from the caller's supplied ticket context, or with the `relay` skill's Jira `read` operation when none was supplied. Read How to test as a candidate induction mechanism before designing preconditions, then verify that it reaches the implementation branch under test.

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

Read the list of changed files before any hunk, then read only the hunks of behavior-changing code; skip the pull request's test files. Read the pull request's review threads as well — or, when they are unreachable, its commit sequence, per [edge-cases.md](references/edge-cases.md) — and compare the merged state with the ticket text: behavior that moved during review, which the description or How to test predates, is a Finding. Compare the first commit's intent with the merged state explicitly — a scope that moved (from HA to AMI-only, from one symptom to every link) is always stated in Findings, even when no case changes.

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

### 3. Build the change-impact and failure model

Read [change-impact-and-failure-model.md](references/change-impact-and-failure-model.md).

For every behavior inventory entry, trace the shortest real product path:

`trigger -> validation -> state -> propagation -> consumer -> observable result`

Use the reference to inspect blast radius, derive relevant invariants, and write concrete failure hypotheses that name **how** the product could be wrong. Then read [failure-catalogue.md](references/failure-catalogue.md) and add every mechanism the path can reach.

At Standard and Deep depth, read [scope.md](references/scope.md) and, when applicable, [ha-scope.md](references/ha-scope.md). Record the deployment mode and each extra dimension — HA, upgrade, database or version, role — with a one-line reason. A proxy or auth change also checks the HA request path. Candidates take their topology and environment from this decision; no separate dimension matrix is needed.

For every check, gate, filter, or trusted input the change adds or widens, write both directions as separate hypotheses: it fails to apply where it must (missing, skipped, bypassed, forged), and it applies where it must not (over-blocks, over-filters, errors on a legitimate caller). Each direction has its own oracle and its own case.

After choosing how to induce each behavior, trace that path against every inventory entry. Name any entry the setup bypasses and use a second induction path where needed. Mutating server state can bypass client scheduling; mutating client state can bypass server rejection.

### 4. Challenge with historical PMM defects

Follow the Fresh history section of [failure-catalogue.md](references/failure-catalogue.md): one Jira query per qualifying inventory entry, built from the entry's own identifiers, plus one on the ticket's own symptom, with the queries and hits recorded in the notes. At Focused depth run only the symptom query.

If Jira search is unavailable or remains inconclusive, report the historical check as skipped or inconclusive and continue from requirements and implementation evidence. Do not imply that no relevant defects exist.

### 5. Choose a test-design technique and build candidates

Read [scenario-selection.md](references/scenario-selection.md).

Choose the technique that matches the risk and generate candidates from the failure model, not from a category quota. The strong-case gate owns layer selection and the scenario reference owns candidate boundaries.

### 6. Find existing coverage

Read [coverage.md](references/coverage.md).

Search both automation and Zephyr before deciding a case is new.

Use the coverage classifications and decisions in `coverage.md`; they are authoritative.

### 7. Apply the strong-case gate

Read and apply [strong-case-gate.md](references/strong-case-gate.md).

### 8. Rank and write

Read and follow [test-case-template.md](references/test-case-template.md) for every proposed case.

Assign priority from failure impact, not ticket priority:

- **High:** security, data integrity, monitoring availability, upgrade safety, or a core workflow without a practical workaround;
- **Normal:** meaningful user-visible failure with a workaround;
- **Low:** cheap supporting coverage that should usually be merged into a stronger case.

Then use `coverage.md`'s execution-reality rules to mark each case `Needs automation`, `Automation candidate — infra gap`, or `Manual` and record its lane or reason.

### 9. Produce the review draft and wait for approval

Before writing, check the notes: every inventory entry has a ledger row; every hypothesis resolves to a case, a cited assertion, or a drop reason; every `Needs automation` names its lane and every infra gap its blocker; every implementation Evidence names a location. After writing, run `python3 scripts/check_draft.py <draft>` and fix what it reports until it passes, then read each case without its Data column. Then, at Standard and Deep depth, give the diff paths and the notes file, not the draft, to one subagent and ask it for hypotheses the notes miss and for ledger citations that would not fail on the named defect. Wait for its report; it is an input to the draft, not a parallel task. When this session cannot start a subagent, make the same review a separate adversarial pass over the notes before finalizing, and say in the draft that it was a self-review. Add what survives the gate and record the rest as drops. A zero-case draft needs this review most: its every claim is a coverage citation.

The draft is the cases plus the few lines a reader needs to trust them. The impact and failure model, the behavior inventory, the coverage ledger, and the drop reasons stay in the notes file: they decide what gets written, and they stay out of the draft unless the user asks for them.

Use this review structure:

```markdown
## <PMM-XXXX or feature> — test cases

<Two to five lines of prose. What the change actually is in behavior terms, and any coverage
the search could not reach. Nothing else — no headings, no tables, no restating a case the
reader is about to read.>

Findings:
- <One line each: a contract conflict, a correction to How to test, a behavior moved during
review, a lane no workflow provides. A Finding changes a case, corrects the ticket, or needs a
product decision; an observation that does none of these stays in the notes. Omit the block
when there are none.>

| # | Case | Pri | Lane | Status | Folder |
| --- | --- | --- | --- | --- | --- |
| <N> | <short title> | <High \| Normal \| Low> | <workflow file · job or shard, or none> | <Needs automation \| Automation candidate — infra gap \| Manual> | <Zephyr folder path> |

---

<one test-case-template block per case, numbered and ordered as in the table>
```

Keep the prose short; a wrong command in the ticket, a rejected root-cause hypothesis, or a behavior the review round moved goes in Findings, one line each.

Choose each case's Folder with the rule in [publish.md](references/publish.md), so the reviewer approves its placement with the case.

Every behavior inventory entry must still resolve to a case in the table, to named existing
coverage, or to a drop reason you can state on request. Say in one line that cases were dropped
and why in the aggregate — "the rest of the PR is unit-covered and does not earn an e2e" — rather
than listing each candidate.

Zero proposed cases is valid when existing coverage already catches every meaningful identified defect. Then the table is replaced by one line per mechanism, `Covered by: <mechanism> → <pmm-qa test path:line or PMM-T key>`, and any Findings still apply.

Do not execute cases, create/update Zephyr entries, or begin automation without explicit user approval after review. Approval unlocks Zephyr only (`create`, `steps`, `link-issue`): never post the draft or the cases as a Jira comment, and never write How to test or any other Jira field — the coverage link from step 10 is the ticket's record. Stop here and wait; when another agent invoked this skill, return the draft to it instead.

### 10. Publish the approved cases

Only when a user invoked this skill directly and explicitly approved the reviewed draft: read [publish.md](references/publish.md) and follow it for the approved cases.

## Evals

When changing this skill, read [references/evals.md](references/evals.md) and run the evals it names before merging.

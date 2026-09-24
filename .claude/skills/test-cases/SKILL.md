---
name: test-cases
description: Design evidence-backed test cases for a PMM Jira ticket, or audit test coverage of an existing PMM feature. Use when asked what to test or verify for PMM-XXXXX, for a test plan or QA plan, where Zephyr or pmm-qa automation coverage has gaps, or whether proposed cases are sufficient, even when the user only pastes a ticket key or pull request and asks how to check it. Produces a review draft first. Only after the user approves it, creates the cases in Zephyr and links them to the ticket. Reads Jira but never writes it. Never executes tests or provisions environments. Not for getting a PMM-T key for a test already being written; use the zephyr skill for that.
compatibility: Requires the sibling jira, git-diff, zephyr and test-scope skills, plus git, rg, curl, jq and python3 in a pmm-qa checkout, and RELAY_KEY for the Zephyr publishing step.
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
- Which layer each assertion belongs at: [references/test-level-selection.md](references/test-level-selection.md)
- Failure catalogue with PMM history, read with the model above: [references/failure-catalogue.md](references/failure-catalogue.md)
- One worked example, only when the model or case boundaries remain unclear: [references/examples.md](references/examples.md)
- Coverage search and suite placement: [references/coverage.md](references/coverage.md)
- Test-case format: [references/test-case-template.md](references/test-case-template.md)
- Strong-case gate, the refusal policy for every candidate: [references/strong-case-gate.md](references/strong-case-gate.md)
- Zephyr folder choice and publishing after approval: [references/publish.md](references/publish.md)
- Missing, inaccessible, or conflicting evidence: [references/edge-cases.md](references/edge-cases.md)

The references above are prompts for reasoning, not quotas. A technique, historical bug, or risk category never justifies a test by itself.

Scripts, run from the skill directory: `scripts/check_draft.py <draft.md>` checks a draft against the template (step 9); `scripts/check_publish_plan.py <plan.json>` checks a publish plan before any Zephyr write (step 10). Both print JSON and exit 1 on a finding.

## Gotchas

Facts about PMM's environment that a reasonable first attempt gets wrong:

- A pull request's own description or docs about how a third-party component behaves — VictoriaMetrics retention, ClickHouse partitions, Grafana routing — are the claim under test, not a contract. One such claim once dropped a ticket's acceptance case; the component's own docs said the opposite.
- Do not read or cite product-repository tests — unit tests, percona/pmm `api-tests`, exporter CI. Only pmm-qa tests and Zephyr count as coverage, so every defect the draft names gets a pmm-qa case or an explicit drop reason.
- A Zephyr case marked `Automated` may have no test on `origin/main`. Only the test's assertions are coverage.
- This checkout can lag `origin/main` by many commits, including CI restructures. Read workflows and tests from `origin/main`.
- A nightly shard that provisions databases may select no tests. It is not a lane.
- The implementation can ship under another ticket key named in the ticket's links or comments.
- Review threads of repositories outside this session's scope return 403; read the commit sequence instead.
- An nginx `location` that sets any `proxy_set_header` inherits none from the server level, so a server-level header overwrite does not cover it.
- On HA, vmauth fronts VictoriaMetrics and routes only some endpoints, so an "empty result" oracle can pass on the broken build.

## Depth

Choose the depth once the step 2 inventory exists, record it and its trigger in the notes, and raise it — never lower it — if later steps find more. Choose by risk, not by the size of the diff: a one-file change that deletes data in HA is Deep.

- **Deep** when any inventory entry touches authentication, authorization, a proxy, secrets, HA or chart topology, upgrade or migration, data deletion or retention, a persisted schema, or more than one component.
- **Focused** when the change is local to one component and touches no persisted state, permission, topology, or version gate — a text, link, or style change, or a local fix whose output other components only read, without the change altering how they read it.
- **Standard** otherwise.

Focused skips the per-entry history search (step 4 keeps its one symptom search), `test-scope`, and the worked example, and replaces the step 9 subagent with a self-check: every `Covered` row states what its assertion sees on the base branch. Deep adds `test-scope`, the route enumeration in [change-impact-and-failure-model.md](references/change-impact-and-failure-model.md) for any proxy or auth change, and always runs the step 9 subagent.

When another agent or skill invokes this one, skip whatever that session already has — a skill file it read, ticket fields, pull-request diffs, effective constants, scope decisions — and re-fetch only what is missing. Hand the finished draft back after step 9 and skip step 10: the caller owns execution and any Zephyr writes. Step 10 runs only when a user invoked this skill directly. The workflow below assumes that direct invocation in a fresh session with nothing supplied.

## Workflow

Keep working notes in `<scratchpad>/<ticket or feature>-notes.md`, one section per step: the behavior inventory and depth (step 2), the failure hypotheses and scope decision (step 3), the coverage ledger (step 6), and the gate verdict per candidate (step 7) with its mechanism, test level, scope dimension, topology, and oracle. Write a step's section before starting the next step; a candidate absent from the notes is not in the draft, and a dropped one keeps its row. The notes are what the user gets when they ask why a case is or is not there.

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

Read changed files before individual hunks, then read the behavior-changing code; skip the pull request's test files. Read the pull request's review threads as well — or, when they are unreachable, its commit sequence, per [edge-cases.md](references/edge-cases.md) — and compare the merged state with the ticket text: behavior that moved during review, which the description or How to test predates, is a Finding. Compare the first commit's intent with the merged state explicitly — a scope that moved (from HA to AMI-only, from one symptom to every link) is always stated in Findings, even when no case changes.

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

At Standard and Deep depth, read the `test-scope` skill now and record its decision in the notes: the deployment mode and each extra dimension — HA, upgrade, database or version, role — with a one-line reason. A proxy or auth change also checks the HA request path. Candidates take their topology and environment from this decision; no separate dimension matrix is needed.

For every check, gate, filter, or trusted input the change adds or widens, write both directions as separate hypotheses: it fails to apply where it must (missing, skipped, bypassed, forged), and it applies where it must not (over-blocks, over-filters, errors on a legitimate caller). Each direction has its own oracle and its own case.

After choosing how to induce each behavior, trace that path against every inventory entry. Name any entry the setup bypasses and use a second induction path where needed. Mutating server state can bypass client scheduling; mutating client state can bypass server rejection.

### 4. Challenge with historical PMM defects

Follow the Fresh history section of [failure-catalogue.md](references/failure-catalogue.md): one Jira query per qualifying inventory entry, built from the entry's own identifiers, plus one on the ticket's own symptom, with the queries and hits recorded in the notes. At Focused depth run only the symptom query.

If Jira search is unavailable or remains inconclusive, report the historical check as skipped or inconclusive and continue from requirements and implementation evidence. Do not imply that no relevant defects exist.

### 5. Choose a test-design technique and build candidates

Read [scenario-selection.md](references/scenario-selection.md) and [test-level-selection.md](references/test-level-selection.md).

Choose the technique that matches the risk and generate candidates from the failure model, not from a category quota. Place each at the lowest pmm-qa layer that observes its defect — API or CLI before UI. A defect no pmm-qa test can reach becomes a Finding. One case may cover several related hypotheses when they traverse the same product path and use compatible setup and verification layers; name one primary failure signal. Split independently selectable branches, environments, or oracles. Reproduce the ticket's original failure as a pmm-qa case when deterministic; see the Regression rule in scenario-selection.md.

### 6. Find existing coverage

Read [coverage.md](references/coverage.md).

Search both automation and Zephyr before deciding a case is new.

Use the coverage classifications and decisions in `coverage.md`; they are authoritative.

### 7. Apply the strong-case gate

Read [strong-case-gate.md](references/strong-case-gate.md). Keep a candidate only when it passes all six gate conditions and the determinism rules that apply to it; mark it Manual, move its assertion to another layer, or drop it otherwise.

### 8. Rank and write

Assign priority from failure impact, not ticket priority:

- **High:** security, data integrity, monitoring availability, upgrade safety, or a core workflow without a practical workaround;
- **Normal:** meaningful user-visible failure with a workaround;
- **Low:** cheap supporting coverage that should usually be merged into a stronger case.

Write related actions and assertions as one flow. Set state through APIs or fixtures when UI setup is not the behavior under test. Write each Step as the action a person performs, at the layer a user of the feature uses — UI for UI behavior, `pmm-admin` for CLI behavior, the API only when the API is the contract under test. Even then the Step says what the person does in product words; the exact command, path, header, query, or value goes in Data. A Zephyr case is read by people who did not write it, so it has to make sense without the Data column.

Then mark each case `Needs automation`, `Automation candidate — infra gap`, or `Manual`. Automation is a standing maintenance cost, so it is the exception, not the reward for a good case.

Mark `Needs automation` only when all of these hold:

- the setup and the oracle are deterministic, with no timing race and no dependence on a restart, upgrade, or other multi-minute wait;
- it runs in the cheapest environment that can host it, and you can name the workflow file and job or shard that already provisions its preconditions;
- existing helpers and page objects already reach the setup and the oracle, or the gap is one small helper.

Mark `Automation candidate — infra gap` when the case is deterministic and worth automating but no lane runs its preconditions, or it needs more than one small helper; name the missing lane or helper. "No lane provisions this" is a claim about `.github/workflows/` on `origin/main`: search it for each required service or tool and record the search in the notes before making it.

Mark `Manual` otherwise, and say why in one clause. The usual reasons: it needs an expensive environment (HA/LKE) only to re-prove a mechanism an automated case already proves; or it depends on a race, a restart, or wall-clock waiting. A check that confirms this ticket once, and that no later change could regress, is not a case: it belongs in the ticket's own QA run, not in Zephyr. The reason and the lane travel into Zephyr with the case.

### 9. Produce the review draft and wait for approval

Read and follow [test-case-template.md](references/test-case-template.md) for every proposed case.

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

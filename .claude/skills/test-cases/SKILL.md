---
name: test-cases
description: Design a concise set of strong, evidence-backed test cases for a PMM Jira ticket. Use when asked what should be tested for PMM-XXXXX, or when reviewing whether proposed coverage is sufficient. Read the ticket and implementation through the existing Jira and git-diff skills, compare candidates with Zephyr and pmm-qa coverage, and produce a review draft of new, extended, covered, and dropped cases. Do not execute tests or write to Jira or Zephyr.
---

# Test cases

Turn a ticket's intended and implemented behavior into the few test cases that can catch meaningful defects. Treat happy paths, negative scenarios, and edge cases as prompts, not quotas.

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

The references above distill the reusable research from `../test-case-design/`. Keep that older skill as historical reference only; do not inherit its workflow, output size, publishing steps, or evaluation process.

## Workflow

### 1. Establish the test basis

Use `jira` to read the summary, description, acceptance criteria, How to test, comments, components, labels, fix version, and linked pull requests.

Extract:

- the user-visible behavior and customer goal;
- each testable acceptance criterion;
- constraints, roles, versions, and supported configurations;
- ambiguities, contradictions, and missing expected behavior.

Do not invent expected behavior to repair a weak ticket. Record uncertainty under Findings.

### 2. Inspect the implementation

Use `git-diff` to inspect **every** linked implementation pull request, regardless of repository. Common homes are `percona/pmm`, `percona/grafana`, `percona/percona-helm-charts`, and the exporter repository named by the ticket or dependency change. A feature may span several of them. Read changed files before hunks, then read behavior-changing code and the pull request's tests.

Use the Jira Development panel first. If it has no links, search the ticket key in each repository implied by the component and behavior; for HA or chart work always include `percona/percona-helm-charts`, and for exporter behavior include the relevant exporter repository. Do not take the no-implementation path until these candidates have been checked. If none contains a change, list the repositories searched in Findings.

An inaccessible linked repository is not "no implementation." Report the access gap and do not state implementation-dependent expected results as facts.

For chart or HA work, read `../test-scope/references/ha.md` and inspect the effective chart configuration: templates, default values, image/version pins, and feature gates. Do not derive expected behavior from a single-server PMM default when the chart disables or replaces it.

Identify validation, errors, permissions, persistence, lifecycle transitions, version gates, shared callers, and externally observable outputs. Compare requirements and implementation in both directions:

- an acceptance criterion missing from the implementation is a Finding;
- implemented behavior absent from the ticket is a Finding or candidate, depending on whether it is a public contract;
- developer tests are existing lower-layer coverage, not automatic reasons for another end-to-end case.

If no implementation exists, continue from the ticket and mark implementation-dependent expectations as unverified.

### 3. Build behavior candidates

Read [scenario-selection.md](references/scenario-selection.md), then use the matching area in [pmm-risk-patterns.md](references/pmm-risk-patterns.md). Read [failure-mechanisms.md](references/failure-mechanisms.md) when the change crosses components, persists state, handles retries or versions, or changes dashboards or UI data flow.

Create one candidate per distinct behavior or risk. Consider:

- happy paths for distinct user workflows;
- negative paths only for real validation, permission, error, or recovery behavior;
- edge cases only where a boundary changes behavior;
- regression coverage that reproduces the ticket's original failure;
- persistence, lifecycle, compatibility, upgrade, HA, or database variants only when the ticket or implementation makes them relevant.

Merge data variants that exercise the same branch. Keep cases separate when they exercise different branches or would fail for different reasons.

### 4. Find existing coverage

Read [coverage.md](references/coverage.md).

Search both automation and Zephyr before deciding that a case is new.

For `pmm-qa`:

1. Run `git log --all --grep PMM-XXXX`.
2. Search the ticket key and behavior identifiers such as API fields, CLI flags, routes, metrics, and persisted values with `rg --hidden -g '!.git/**'` so `.github/` workflows are included.
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
4. **Reliable oracle:** assert a deterministic public result at the layer that matters, such as an API response, persisted state, CLI result, permission decision, exporter flag, metric, or supported UI behavior.
5. **Value exceeds cost:** the user or product impact justifies the setup, runtime, credentials, and maintenance burden.

Reject generic justification such as "best practice," "test an edge case," "realistic workflow," or "could break." Reject assertions such as "works," "page loads," or "error appears."

Each surviving case must have controlled preconditions, bounded waits, cleanup when it changes state, and one primary failure reason.

### 6. Rank and write

Assign priority from failure impact, not ticket priority:

- **High:** security, data integrity, monitoring availability, upgrade safety, or a core workflow without a practical workaround;
- **Normal:** meaningful user-visible failure with a workaround;
- **Low:** cheap supporting coverage that should normally be merged into a stronger case rather than stand alone.

Write related actions and assertions as one flow. Set state through APIs or fixtures when UI setup is not the behavior under test.

### 7. Produce the review draft and stop

Use this compact structure:

```markdown
## PMM-XXXX — test cases

Ticket: <summary> · PRs: <repo#number or none> · Version: <version>

### Findings

- <requirement/implementation contradiction, ambiguity, or missing behavior>

### Existing coverage

- <covered behavior> — <PMM-T key or path:line> — <assertion>

### Proposed cases

#### 1. <Zephyr case name without key or automation tag>

Disposition: new | extend <PMM-T key/path>
Priority: High | Normal | Low
Risk: <named defect and user impact>
Evidence: <AC, implementation branch, or bug>
Preconditions: <role, services, versions, configuration>
Test data: <values that select the behavior>
Steps:
| Action | Data | Expected result |
|---|---|---|
| <action> | <data> | <specific observable result> |
Verify via: <API, CLI, persisted state, permission, flag, metric, or UI contract>

### Considered and dropped

- <candidate> — <covered, same branch as case N, no evidence, nondeterministic, or cost exceeds value>
```

Omit empty Findings and dropped sections. Zero proposed cases is valid when existing coverage already catches every identified defect.

Do not execute cases, create or update Zephyr entries, modify Jira, or begin automation. Those actions require explicit user approval after review.

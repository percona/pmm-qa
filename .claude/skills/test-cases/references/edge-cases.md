# Edge cases in the test basis

Read the section that matches the situation; the rest does not apply.

## Linked pull requests were not supplied

The Jira relay cannot read the Development panel. Search the repositories implied by the component and behavior for the ticket key. For HA/chart work include `percona/percona-helm-charts`; for exporter behavior include the relevant exporter repository. Then repeat the search for every ticket key in the ticket's issue links and comments: the change often ships under a parent, a duplicate, or a ticket a developer names ("done in PMM-14012"). Take pull-request URLs written in the description or comments as found. List the repositories and keys searched when none contains the implementation, and report that Development-panel discovery was unavailable, because repository search can miss a linked pull request whose title and branch omit every key.

## Review threads are unreachable

A repository outside this session's GitHub scope answers 403 to review-thread reads. Read the pull request's commit sequence instead: commits pushed after the pull request opened show what review moved. Say in the draft that review threads were not read.

## Sources disagree

Treat an AI-triage comment's root-cause analysis and recommended fix as unverified hypotheses. Use them to guide inspection, never as test basis; verify them against the linked or shipped implementation and record a mismatch as a Finding.

When ticket fields, documentation, API/CLI contracts, historical behavior, triage claims, PR acceptance notes, or implementation disagree, label each source's claim in the notes and weigh them in this order:

1. **Normative contract** — acceptance criteria, documented public API/CLI behavior, product documentation that predates the change, and, for behavior a third-party component owns (VictoriaMetrics, ClickHouse, Grafana, an operator), that component's own documentation or source.
2. **Observed behavior** — an FB or CI result, a recorded reproduction.
3. **Implementation-derived** — the code, the pull request description, and documentation written in the same pull request. It is the subject under test, never the contract: it cannot override an acceptance criterion, and it cannot justify dropping a case.
4. **Historical** — older tickets, existing Zephyr cases, existing automation.
5. **Hypothesis** — triage comments and unverified claims.

Then:

1. identify which behavior is externally observable;
2. mark the mismatch as a Finding, naming each side's source and label;
3. avoid asserting the disputed expectation as fact unless a higher-ranked source settles it; a claim about a third-party component's behavior is settled only by that component's own documentation or source;
4. when useful, propose a test that exposes the mismatch rather than assuming one side is correct — it publishes as Zephyr `Draft` until the Finding is resolved;
5. when existing automation asserts one side of the dispute, say so in the Finding: that test will fail or be rewritten once the Finding is resolved.

## Archived or inaccessible repository

For a ticket predating repository consolidation, use the feature build's Custom branches list to identify and inspect the archived upstream repository. A feature-build pull request is not the implementation.

An inaccessible linked repository is not "no implementation." Report the access gap.

## Fix version predates the current major

When the implementation is absent from every plausible current repository, verify whether the feature still exists before designing implementation-dependent cases.

## No implementation available

Continue from the requirements. List the repositories and ticket keys searched or the access gap, mark implementation-dependent expectations as unverified, and do not present implementation-derived behavior as fact. Build the inventory from externally stated contracts and record `implementation unavailable` as its source.

# Edge cases in the test basis

Read the section that matches the situation; the rest does not apply.

## Linked pull requests were not supplied

The Jira relay cannot read the Development panel. Search the repositories implied by the component and behavior for the ticket key. For HA/chart work include `percona/percona-helm-charts`; for exporter behavior include the relevant exporter repository. List the repositories searched when none contains the implementation, and report that Development-panel discovery was unavailable, because repository search can miss a linked pull request whose title and branch omit the key.

## Sources disagree

Treat an AI-triage comment's root-cause analysis and recommended fix as unverified hypotheses. Use them to guide inspection, never as test basis; verify them against the linked or shipped implementation and record a mismatch as a Finding.

When ticket fields, documentation, API/CLI contracts, historical behavior, triage claims, PR acceptance notes, or implementation disagree:

1. record each source and what it claims;
2. identify which behavior is externally observable;
3. mark the mismatch as a Finding;
4. avoid asserting the disputed expectation as fact unless a controlling contract is explicit;
5. when useful, propose a test that exposes the mismatch rather than assuming one side is correct.

## Archived or inaccessible repository

For a ticket predating repository consolidation, use the feature build's Custom branches list to identify and inspect the archived upstream repository. A feature-build pull request is not the implementation.

An inaccessible linked repository is not "no implementation." Report the access gap.

## Fix version predates the current major

When the implementation is absent from every plausible current repository, verify whether the feature still exists before designing implementation-dependent cases.

## No implementation available

Continue from the requirements. List the repositories searched or the access gap, mark implementation-dependent expectations as unverified, and do not present implementation-derived behavior as fact. Build the inventory from externally stated contracts and record `implementation unavailable` as its source.

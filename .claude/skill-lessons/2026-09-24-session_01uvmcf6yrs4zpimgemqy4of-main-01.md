# .claude/agents/investigator.md — Dedup against open PMM PRs, not just Jira, before writing any product fix

- Added: 2026-09-24
- Applies to: .claude/agents/investigator.md
- Evidence: After confirming a valkey_exporter TLS root cause, a full product fix (valkey.go + unit tests + a locally built golangci-lint) was written and validated before searching, then discarded on finding the bug was already ticketed (PMM-15322) and fixed by an open, actively-reviewed percona/pmm PR (#5854).
- Proposed change: In the dedup step, require searching open percona/pmm PRs (e.g. `search_pull_requests repo:percona/pmm <PMM-key>`) in addition to Jira, and require this dedup to complete before any product-code fix is written; also compare a failing e2e test against its sibling DB tests before assuming a product bug.

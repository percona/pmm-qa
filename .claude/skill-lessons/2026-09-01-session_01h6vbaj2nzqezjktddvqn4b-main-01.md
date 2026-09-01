# .claude/agents/investigator.md — finish both dedup checks, Jira included, before any VM is provisioned

- Added: 2026-09-01
- Applies to: target only
- Evidence: On a scheduled `Helm tests` CI failure the open-PR dedup came back clean (a prior product-bug verdict leaves no pmm-qa PR), while the Jira relay search — which step 1 asks for only on a "question or suspected bug" — returned PMM-15404, already In Review with fix PR percona/pmm#5867 open; a Linode VM had been provisioned in parallel with that search and was destroyed unused.
- Proposed change: In step 1, require the Jira relay `search` for every source including CI/FB, and state that provisioning in step 2 starts only after both dedup checks return clean.

# .claude/agents/investigator.md — the step-1 dedup sweep cannot see sibling sessions fired by the same batch

- Added: 2026-09-09
- Applies to: .claude/agents/investigator.md
- Evidence: `notify_investigator` fires once per failed run, so a nightly dispatched as nine runs (one per `pmm_client_version`) failing on one shared cause woke seven Investigator sessions at once; each opened its own PR for the identical fix (percona/pmm-qa#1392-#1398, 19:37-20:11) because every step-1 open-PR sweep ran before any sibling had opened one, and the seven PR matrices plus the nightly batch then had E2E runs cancelled repo-wide for capacity.
- Proposed change: Re-run the open-PR sweep immediately before `create_pull_request`, not only at step 1, and also look for sibling branches sharing the session-branch prefix pushed within the hour; when the trigger is one run of a batch dispatched minutes apart on the same head_sha, treat the batch as a single investigation rather than opening a per-run PR.

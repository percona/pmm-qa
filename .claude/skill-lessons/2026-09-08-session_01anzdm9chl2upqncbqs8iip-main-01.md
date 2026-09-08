# .claude/agents/investigator.md — run the step-1 dedup sweep before any root-cause work, not after

- Added: 2026-09-08
- Applies to: target only
- Evidence: A nightly-triggered run read the failed job log, then spent ~15 tool calls root-causing (fetching two npm tarballs of the test framework, diffing the changed helper across versions, surveying every call site in the repo) before the mandatory dedup sweep — which then hit an immediate stop condition, an open pmm-qa PR already listing that exact spec path and test under `## Failures fixed (investigator)` with the identical root cause written up. All the root-cause work was discarded.
- Proposed change: In step 1, state that dedup needs only the failing identifiers (spec path, test name, tag) that one read of the failed job log yields, and that root-cause analysis, dependency archaeology and call-site surveys must not start until both dedup checks return clean.

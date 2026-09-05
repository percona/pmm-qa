# candidate: jenkins-mcp — Percona Jenkins MCP calls need an explicit `master`, and PMM's is `pmm`

- Added: 2026-09-05
- Applies to: all agents that read Jenkins builds (investigator, fb-reporter, test-runner)
- Evidence: Three batched Percona_Jenkins_MCP calls (get_build_failure_summary, get_build_stages, get_build_parameters) for `pmm3-ui-tests-nightly-gssapi` #455 all failed with "No Jenkins master selected. Configured: ['ps80','psmdb','pxc','cloud','pmm','pxb','ps57','rel','pg']"; re-running the identical batch with `master: "pmm"` succeeded. A follow-up get_build_console_tail call also failed because it takes `lines`, not `limit`.
- Proposed change: Add a short skill documenting that every per-master Percona Jenkins MCP tool requires `master`, that all PMM `pmm3-*` jobs use `master: "pmm"`, that get_build_failure_summary is the right first call for a FAILED build, and that get_build_console_tail's line-count parameter is `lines`.

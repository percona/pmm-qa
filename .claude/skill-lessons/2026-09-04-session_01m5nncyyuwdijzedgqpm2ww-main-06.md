# .claude/agents/investigator.md — Jenkins build history via the MCP is capped at 100 builds, and cron runs are identifiable by timestamp

- Added: 2026-09-04
- Applies to: .claude/agents/investigator.md
- Evidence: `get_build_history` on the pmm master returned at most 100 builds whatever `count` was passed (the REST tree is `builds{0,100}`), so daily jobs with many matrix children (pmm3-package-testing-arm, pmm3-upgrade-tests) only reached back three weeks; the scheduled daily run of a job was reliably separated from manual and RC re-runs because Jenkins cron builds start within two seconds of the cron minute (timestamps ending in HH:00:00.27x UTC).
- Proposed change: Add a note that nightly trend questions must work within the 100-build window, that matrix runners are better read than their `-matrix` parents, and that a build is the scheduled run when its timestamp falls within two seconds of the job's cron time.

# .claude/agents/investigator.md — A status stuck at the wrong value for the whole timeout is a real failure, not a short timeout

- Added: 2026-09-24
- Applies to: .claude/agents/investigator.md
- Evidence: A pmm-qa test failed waiting for a service to reach "Up"; the fix raised the wait from 2 to 5 minutes, but the re-run failed again with the status "Down" for the entire 5-minute window — proving the flow never completes, not that it was slow.
- Proposed change: Before treating a `waitForServiceStatus`/wait-for-condition failure as a too-short timeout, check whether the observed value was stuck at the wrong state for the whole window (real failure — diagnose the actual connection/auth/startup error) versus trending toward success near the deadline (genuine timing); only bump the timeout for the latter.

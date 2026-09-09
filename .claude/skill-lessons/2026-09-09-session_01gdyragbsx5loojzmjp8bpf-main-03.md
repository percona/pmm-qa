# .claude/agents/investigator.md — spend the one CI re-run only when no further push is pending

- Added: 2026-09-09
- Applies to: .claude/agents/investigator.md
- Evidence: a cancelled CI run on a PR's head was re-run to get a real result; three minutes later a push addressing review comments landed, and the concurrency group cancelled the re-run before it produced anything. The single allowed re-run was consumed on a commit that stopped being head, and the new head got an ordinary run anyway.
- Proposed change: alongside the at-most-once re-run rule, say to check for work already in hand — unanswered review findings, a fix mid-verification — before triggering it, since a push supersedes the re-run and the new head starts its own run for free.

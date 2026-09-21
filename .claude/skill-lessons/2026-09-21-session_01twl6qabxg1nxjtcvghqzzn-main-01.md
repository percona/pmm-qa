# .claude/skills/qa-code-review/SKILL.md — a finding that cites repository history must name the commit it read

- Added: 2026-09-21
- Applies to: target only
- Evidence: A finding argued against halving `WAIT_POLL_INTERVAL_SECONDS` partly on the claim that a shorter interval "has already been reverted once". The author accepted the substantive point and corrected the evidence: `git log -S WAIT_POLL_INTERVAL_SECONDS` over the last 200 commits of `main` returns only two commits and both *introduce* the variable already at 600, so no such revert exists (https://github.com/percona/pmm-qa/pull/1416#discussion_r4061616538).
- Proposed change: In section 6, require a finding that asserts repository history — a value was reverted, an approach was tried before, a convention was established — to name the commit and the command that found it, or to drop the claim and rest the finding on the diff and the current tree.

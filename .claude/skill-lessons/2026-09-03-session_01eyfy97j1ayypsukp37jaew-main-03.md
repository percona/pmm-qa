# .claude/skills/qa-code-review/SKILL.md — anchor threads on line numbers read from the head commit, not counted from the diff

- Added: 2026-09-03
- Applies to: .claude/skills/qa-code-review/SKILL.md
- Evidence: While reviewing percona/pmm-qa#1220 the head advanced by one commit between `pull_request_read get` and the file reads, and line numbers hand-counted from `get_diff` hunks disagreed with the head file, which would have mis-anchored every `suggestion` block.
- Proposed change: Before posting, re-resolve the head SHA, pin the pending review's `commitID` to it, and take anchor lines from `git fetch origin <head-branch>` plus `git show <sha>:<path> | cat -n` in the local clone rather than from diff hunk arithmetic.

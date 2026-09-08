# .claude/skills/repos/SKILL.md — address the repo with `git -C`; the shell working directory resets between calls

- Added: 2026-09-08
- Applies to: .claude/skills/repos/SKILL.md
- Evidence: Two consecutive git calls failed with "fatal: not a git repository" because the shell had reset to the primary working directory (the multi-repo parent, which is not a checkout) after an earlier command changed directory; both worked unchanged once rewritten as `git -C <repo>`.
- Proposed change: In the Cloud environment section, state that the shell working directory is not guaranteed to persist between tool calls in multi-repo sessions, so git commands should carry `git -C <repo path>` rather than rely on a previous `cd`.

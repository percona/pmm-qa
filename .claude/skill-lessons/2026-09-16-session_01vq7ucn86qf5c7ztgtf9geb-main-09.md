# .claude/skills/qa-code-review/SKILL.md — rate an injection-class finding in a repo-local recipe on correctness, not external reachability

- Added: 2026-09-16
- Applies to: .claude/skills/qa-code-review/SKILL.md
- Evidence: An author took the fix but pushed back on the severity framing of a word-splitting finding in a skill reference recipe — reaching it requires having already checked out the untrusted branch, whose workflows, framework scripts and test files the reader is running anyway (https://github.com/percona/pmm-qa/pull/1430#discussion_r4024222690).
- Proposed change: Add a severity note beside the existing skip-verification scoping in section 5 / check 9: where the only attack path runs through a branch the reader has already checked out and executed, the finding is correctness-grade, not a blocker on external reachability.

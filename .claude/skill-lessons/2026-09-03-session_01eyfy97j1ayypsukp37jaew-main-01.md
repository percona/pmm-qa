# .claude/skills/qa-code-review/SKILL.md — a thread is one paragraph plus a `suggestion` block, not prose describing the fix

- Added: 2026-09-03
- Applies to: .claude/skills/qa-code-review/SKILL.md
- Evidence: The reviewing user corrected a posted review of percona/pmm-qa#1220 to "one paragraph max, the rest as suggestions" after section 6's claim/why/change prose produced multi-paragraph threads that described the fix instead of applying it.
- Proposed change: In section 6, cap the thread body at one paragraph and put the concrete change in a ```suggestion block anchored on the exact lines it replaces (an empty block deletes them); a fix that spans other files or regions gets companion threads that name the main thread.

# .claude/skills/skill-gardener/SKILL.md — deleting pushed entries from the checkout hides which ordinals are taken

- Added: 2026-09-08
- Applies to: target only
- Evidence: with several subagents capturing in one session under a shared checkout, the main agent pushed entries `investigator-01`..`04` and then removed them from the checkout as the Capture steps direct. A later subagent, seeing an empty `.claude/skill-lessons/`, wrote four entries of genuinely different content and reused the same four names; the main agent had to diff each against the week branch and renumber to `08`..`11` before committing, and an overwrite would have silently destroyed the first four.
- Proposed change: make the ordinal search authoritative on the week branch rather than the checkout — direct the writer to resolve the next `<nn>` against `git ls-tree` of `origin/skill-gardener/<YYYY>-W<WW>` (falling back to the checkout only when that ref is unavailable) — and tell the committing agent to treat a name that already exists on the branch with differing content as a renumber, never a replace.

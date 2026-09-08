# .claude/skills/skill-gardener/SKILL.md — enforce the next-ordinal rule instead of restating it

- Added: 2026-09-08
- Applies to: .claude/skills/skill-gardener/SKILL.md
- Evidence: A second capture in the same session wrote entries at guessed ordinals 06-09 with plain `>` redirection and silently overwrote four immutable entries an earlier capture in that same session had already committed at those names; the damage was visible only as ` M` in `git status` and had to be reverted with `git checkout --`.
- Proposed change: Make Capture step 6 structural rather than advisory — list the existing entries for the prefix and compute the next ordinal from them, and write with a no-clobber mechanism (`set -o noclobber`, or `cp -n`) so an ordinal collision fails loudly instead of destroying a prior lesson.

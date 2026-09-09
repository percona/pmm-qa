# .claude/skills/skill-gardener/SKILL.md — address the worktree with `git -C`, never a bare `cd` that can fall through

- Added: 2026-09-09
- Applies to: any session committing to a lesson branch from a shared checkout
- Evidence: In a `set -e` block, `git worktree add` failed and the following `cd "$WT/.claude/skill-lessons"` errored, but execution continued in the user's shared checkout — the heredoc wrote the entry to the repo root and `git commit` landed it on the unrelated feature branch another agent was using; only the push failing on a non-fast-forward kept it from spreading, and it had to be undone with `git reset`.
- Proposed change: In the commit steps, require every git and file operation to be addressed absolutely — `git -C "$WT" …` and `"$L/<file>"` — with an explicit `test -d "$WT/.claude/skill-lessons" || exit 1` after creating the worktree, so a failed worktree add cannot silently commit into the user's checkout.

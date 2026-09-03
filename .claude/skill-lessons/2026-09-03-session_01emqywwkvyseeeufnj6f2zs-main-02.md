# .claude/skills/repos/SKILL.md — the session checkout has only its own branch's refs

- Added: 2026-09-03
- Applies to: target only
- Evidence: `git diff origin/main...HEAD` failed with `fatal: bad revision 'origin/main...HEAD'` in the session's checkout; the same command succeeded immediately after `git fetch origin main`, and `git fetch origin <branch>` was likewise needed before reading the branch's own remote state.
- Proposed change: in the "Cloud environment" section, note that the checkout carries only the branch it was cloned for, so any remote ref used in a comparison (`origin/main`, another branch) must be fetched by name first.

# .claude/skills/skill-gardener/SKILL.md — a validator that selects no files is not evidence it passed

- Added: 2026-09-07
- Applies to: all skills and agents that cite a validator or linter as validation
- Evidence: Three gardener PR bodies cited "linter clean" for docs-only diffs after `.claude/hooks/lint-changed.sh` exited 0; a reviewer showed the dispatcher has no markdown group, so it had selected zero files. Confirmed directly afterwards: the script prints nothing for a `.md` path and `==> shellcheck` for a `.sh` one, both exiting 0. All three bodies had to be corrected post-review.
- Proposed change: In Publish step 8, require that a cited validator be shown to have actually selected the changed files — a dispatcher that no-ops on the changed file kind means "no gate covers this diff", which is what the record should say instead of "clean".

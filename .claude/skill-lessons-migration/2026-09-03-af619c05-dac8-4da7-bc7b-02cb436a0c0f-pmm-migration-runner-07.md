# .claude/skills/codeceptjs-migration/branch-workflow.md - give the tracker edit the same line-ending guard the patch checkpoint already has

- Added: 2026-09-03
- Applies to: `.claude/skills/codeceptjs-migration/branch-workflow.md` and `.claude/skills/codeceptjs-migration/run.md`
- Evidence: "Checkpointing uncommitted work" warns that a `>` redirect or pipe re-encodes bytes as CRLF on this Windows setup and mandates `git diff --output=`, but "Tracker completion and cleanup" says only "commit and push only the tracker change" with no equivalent guard, and `tracker.md` is LF-only; row 4 hit the flip at its `in-progress` step, where a whole-file rewrite turned all 164 lines CRLF and had to be amended back, and the same row's `done` step avoided it only because the hazard was passed down by hand rather than read from the workflow.
- Proposed change: In the tracker sections of both files, require the row edit to be an anchored substring replacement rather than a whole-file rewrite, and require `git diff --numstat` to show a 1-insertion/1-deletion change plus `grep -c $'\r'` to return 0 before staging - the same shape of guard the checkpoint section already carries.

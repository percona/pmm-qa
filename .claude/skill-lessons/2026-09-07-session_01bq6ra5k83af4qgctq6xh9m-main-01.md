# .claude/skills/verification-depth/SKILL.md — a sweep that finds nothing needs a positive control before it is reported as "nothing else exists"

- Added: 2026-09-07
- Applies to: all skills and agents claiming a repository-wide search found no further instances
- Evidence: An AST sweep for CodeceptJS 3→4 extra-argument breakages reported 0 hits over 221 files, which became evidence only after re-running it against the pre-fix tree (`git archive <sha>~1`), where it flagged all 17 known sites, and after a second sweep flagged every known-removed method in a synthetic file.
- Proposed change: Before reporting that a search found no further instances, run the same detector over a corpus known to contain the defect (an earlier commit or a synthetic file) and state that it fired there; absent that, report "not found" rather than "does not exist" — same family as this week's entry that a validator selecting no files is not evidence it passed.

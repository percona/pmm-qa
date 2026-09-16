# .claude/skills/git-diff/SKILL.md — never `git grep` a blobless clone

- Added: 2026-09-16
- Applies to: .claude/skills/git-diff/SKILL.md
- Evidence: The skill's own anonymous-read recipe clones with `--filter=blob:none`. A follow-up `git grep <pattern> <ref>` on that checkout fetched blobs for the whole tree, exceeded the 120s command timeout, and had to be killed by pid.
- Proposed change: In the "When the session doesn't have the repo" section, state that the `--filter=blob:none` clone supports `git show <ref>:<path>` and range diffs but not `git grep` over a ref, and give `git show <ref>:<path> | grep` as the way to read a known file, with a full (unfiltered) clone as the only option for a tree-wide search.

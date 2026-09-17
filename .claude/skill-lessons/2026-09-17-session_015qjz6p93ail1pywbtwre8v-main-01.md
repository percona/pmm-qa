# CLAUDE.md (House style) — Parallel Bash calls share one working directory, so `cd <repo> && git …` reads the wrong repo

- Added: 2026-09-17
- Applies to: all skills and agents that read files from more than one checkout in a multi-repo session
- Evidence: Two Bash calls issued in the same response each began `cd /workspace/<repo> && git show origin/<branch>:<file>`; the second failed with "Not a valid object name origin/main" because the other call's `cd` had moved the shared shell directory to a different repo between them.
- Proposed change: Extend the "Address a directory by its literal absolute path" bullet so that a git read in a batched or parallel Bash call uses `git -C /workspace/<repo> …` (and absolute file paths) instead of a leading `cd`, since concurrent Bash calls share one working-directory state.

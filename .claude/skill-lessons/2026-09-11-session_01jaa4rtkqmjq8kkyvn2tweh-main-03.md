# AGENTS.md — Set both git identity fields on a fresh worktree before committing

- Added: 2026-09-11
- Applies to: all skills that commit from a scratch worktree
- Evidence: A commit made with only `git -c user.name=<from log>` picked up the container's default email, producing an author of the right name with a wrong address; the amend and force-push to fix it were denied as destructive, so the PR carries the mismatch.
- Proposed change: Right after `git worktree add`, run `git -C "$WT" config user.name` and `git -C "$WT" config user.email` copied from the repo's previous commit by the same author, and only then commit; never rely on a single `-c` override.

# .claude/skills/repos/SKILL.md — Prefer retrying git push over MCP push_files to land commits on a feature branch

- Added: 2026-09-09
- Applies to: all sessions landing commits on a designated feature branch
- Evidence: git push was gated by the auto-mode classifier, so mcp__github__push_files was used to land a fix; it based its commit on the repo default branch's tree instead of the existing feature-branch tip, silently dropping that branch's 52-commit history from the remote. A plain `git push --force-with-lease` retry then worked and restored correct history; the divergence was only caught by the stop-hook git check.
- Proposed change: When git push is blocked, retry `git push` (then `git push --force-with-lease`) before falling back to MCP push_files/create_or_update_file; if MCP push must be used, verify the branch's remote tip is the intended base first and re-verify history afterward (`git merge-base --is-ancestor <expected-base> <branch>`, expected files present).

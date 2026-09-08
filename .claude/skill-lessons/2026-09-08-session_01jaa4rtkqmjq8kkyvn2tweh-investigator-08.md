# .claude/skills/repos/SKILL.md — Check for another agent's uncommitted work before branching in the shared checkout

- Added: 2026-09-08
- Applies to: all agents that commit or open PRs
- Evidence: A sibling investigator's uncommitted edit to the same file was already in `/workspace/jenkins-pipelines`, and HEAD advanced twice mid-session as they committed and pushed; `git add` of the changed file would have swept their work into this run's commit.
- Proposed change: In the Cloud environment section, require `git status` before branching and direct agents to make their edits in an isolated `git worktree` cut from `origin/<base-branch>` (removed when done) whenever the checkout carries changes the agent did not make.

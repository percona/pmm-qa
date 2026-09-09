# .claude/skills/repos/SKILL.md — a `workflow_dispatch` evidence run attaches red check runs to the PR head

- Added: 2026-09-09
- Applies to: .claude/skills/repos/SKILL.md
- Evidence: Two `workflow_dispatch` runs dispatched on a PR's head SHA to prove a playbook change added 8 red check runs to that PR alongside its 35 green required ones; the PR's own CI was entirely green, but the checks list now reads red to a reviewer, and only the PR body and comments explain why.
- Proposed change: Record that a manually dispatched run on a PR head becomes a check run on that PR, so when dispatching evidence runs on a branch with known-broken environment legs, say in the PR body which check names come from the dispatch and are not the PR's own CI.

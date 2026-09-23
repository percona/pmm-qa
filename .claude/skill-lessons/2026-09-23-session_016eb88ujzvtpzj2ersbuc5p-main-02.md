# .claude/skills/git-diff/SKILL.md — two fetches into FETCH_HEAD silently compare a ref with itself

- Added: 2026-09-23
- Applies to: .claude/skills/git-diff/SKILL.md
- Evidence: Measuring how far a percona/pmm feature branch trailed main ran `git fetch origin <branch>` then `git fetch origin main`, both landing in FETCH_HEAD; the second clobbered the first, so merge-base and rev-list compared main against main and reported "behind by 0, own commits 0". Re-fetching into named refs (`+refs/heads/<branch>:refs/remotes/origin/<local>`) gave the real answer: 18 commits behind, 55 own. The wrong result looked plausible and was nearly reported.
- Proposed change: state that comparing two remote refs fetches each into its own named ref and never relies on FETCH_HEAD, which holds only the most recent fetch.

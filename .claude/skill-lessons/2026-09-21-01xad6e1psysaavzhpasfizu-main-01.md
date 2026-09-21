# .claude/agents/pr-maintainer.md — a verified-green branch is not a free place to land review findings

- Added: 2026-09-21
- Applies to: all agents and skills that push review-driven fixes to an open PR
- Evidence: On a pmm-qa PR whose whole value was a nightly run finally going green on one commit, seven commits of review-bot findings were pushed in one turn without asking; the author replied "estou preocupado suas mudanças quebrem algo que ja funcionava, vamos regressar ao estado de antes do review" and everything had to be reverted to that commit.
- Proposed change: Before pushing a review-driven fix to a branch whose current head is the reference for a verified passing run, and which the fix cannot itself be exercised against, post the finding and ask the author instead of pushing — pushing is for fixes whose verification is available now.

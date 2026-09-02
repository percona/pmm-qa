# .claude/integrations/slack/relay/deploy.sh — deploy the relay from the merged default branch and verify the deployed file's content, not a hand-run checkout

- Added: 2026-09-02
- Applies to: .claude/integrations/slack/relay/deploy.sh (relay deploy process)
- Evidence: A hand-run deploy (git checkout <feature-branch> + cp relay.js) silently checked out a pre-existing stale local branch of the same name after an auth-glitched fetch and copied regressed code over the running relay; a `diff -q` reported "in sync" against that stale checkout, hiding the regression.
- Proposed change: Drive relay deploys through deploy.sh, sourcing the merged default branch (never a feature branch), and verify success by grepping the deployed file for the new behavior (e.g. a marker string) rather than only diffing it against the possibly-stale checkout.

# CLAUDE.md (House style) — a fix born of a long investigation pulls its mechanism into the file comment, where the rule says it must not go

- Added: 2026-09-15
- Applies to: CLAUDE.md House style ("Minimal comments"); all agents that open fix PRs
- Evidence: On one two-file fix PR, the automated reviewer opened a 🟡 finding on each file, both citing the house-style rule: a three-line comment restating what the call below already says, and a three-line comment that was the PR body's own paragraph copied into the file. The rule loads in every session and still did not prevent it; the shared cause is that the change's justification had just been established at length, so the mechanism felt like it belonged next to the code.
- Proposed change: In the "Minimal comments" bullet, name this failure mode explicitly — when a change is the product of an investigation, its mechanism, version history and measured numbers are a decision record that belongs in the PR body; the file comment keeps only what a reader at that line cannot infer from the code beside it.

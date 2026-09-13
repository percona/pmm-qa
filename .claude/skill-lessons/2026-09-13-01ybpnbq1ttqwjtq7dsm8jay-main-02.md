# .claude/agents/investigator.md — a load repro counts only when the failing step matches CI's, not merely that it went red

- Added: 2026-09-13
- Applies to: .claude/agents/investigator.md
- Evidence: Reproducing PMM-T2048 on a 6-vCPU box, the skill's named 12 busy-loops failed 2/2 but at `I.scrollTo` (the config's 20 s action timeout), a different step from CI's `I.waitForElement(..., 5)`; 6 hogs passed; 9 hogs reproduced CI's actual step. Trace screencast gaps put local stalls at 21-70 s against CI's 8.96 s, showing 12 hogs overshot the runner's contention rather than matching it.
- Proposed change: In the timing-shaped-failure paragraph, treat 12 hogs as a starting point rather than the recipe: sweep the load level until the *failing step* matches CI's, and compare the local stall magnitude (trace screencast gaps) with the CI run's to tell whether the box is harsher or lighter than the runner.

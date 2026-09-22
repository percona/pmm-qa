# .claude/agents/investigator.md — a green load level is not a negative answer until the sweep has gone above it

- Added: 2026-09-22
- Applies to: target only
- Evidence: A timing-shaped CI failure ran 3/3 green idle on a 6-vCPU VM and 3/3 green at 9 CPU hogs (load ~11); at 14 hogs (load ~15) it failed 2/3 with the byte-identical failing step and the identical malformed query in the trace. Stopping at the first green load level would have classified a confirmed test bug as "didn't reproduce".
- Proposed change: Where the agent file already calls twelve hogs "a starting point, not the recipe", state that a green result at one load level settles nothing — the sweep must keep raising the level until either the CI failing step is matched or the box's load clearly exceeds the runner's, and only then may the failure be called unreproducible.

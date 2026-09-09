# .claude/agents/investigator.md — a burst of sibling sessions looks like repo-wide CI breakage, not like itself

- Added: 2026-09-09
- Applies to: .claude/agents/investigator.md
- Evidence: with six sibling sessions each pushing a fix branch, `E2E tests Matrix` ended `cancelled` on five `claude/eager-knuth-*` branches at once with zero job failures, and 26 of the last 40 PR runs of that workflow were cancelled. This was investigated as possible org-level Actions concurrency/spending exhaustion and reported to the user that way; the actual cause was the sibling sessions' own ~200 queued jobs, which only became visible when one PR was closed as a duplicate of five others. Two thirds of PR runs cancelling is a real symptom, but the wrong diagnosis reached the user first.
- Proposed change: where the agent judges a CI cancellation not attributable to its own diff, have it first check for other in-flight runs on sibling branches of the same batch (a `claude/*` branch pattern with runs of the same workflow in the same window) and name that as the likely cause, before reaching for an org-level explanation or reporting one.

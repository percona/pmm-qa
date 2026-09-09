# .claude/agents/investigator.md — dedup is blind to sibling Investigator sessions racing on the same bug

- Added: 2026-09-09
- Applies to: .claude/agents/investigator.md
- Evidence: one systemic regression failed five nightly runs the same night; each failure fired its own Investigator routine, each ran the step 1 PR and Jira sweep before the others had opened anything, and six PRs (#1392, #1393, #1394, #1396, #1397, #1398) were opened against the same file within 35 minutes. Their combined CI (six 36-job matrices) then contended for org Actions capacity and runs were cancelled mid-step. No individual sweep was wrong; step 1 is a point-in-time check and nothing re-checks before the PR is opened.
- Proposed change: in step 1, when the trigger is a scheduled workflow, first check whether sibling runs of that same workflow failed the same way that night — several failures of one workflow usually mean one cause and one fix, not one fix each — and re-run the open-PR sweep immediately before opening the PR in step 5, treating a PR opened minutes earlier under the same marker as the stop condition it would have been at step 1.

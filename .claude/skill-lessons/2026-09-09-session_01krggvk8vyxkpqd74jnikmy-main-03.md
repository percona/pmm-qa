# .claude/agents/investigator.md — a review-driven push leaves the PR body's verification evidence describing code that no longer ships

- Added: 2026-09-09
- Applies to: target only
- Evidence: Step 5's PR body carried a Verification section with quoted run output. Two review rounds then changed the loop the PR adds, and the body still said containers without the client "just log a skip" and still quoted an output line (`pmm-admin unregister skipped for container …`) that the shipped code no longer produces. The body was only corrected because a later check of the PR happened to re-read it; nothing in the workflow prompts for it.
- Proposed change: In step 5, state that when review feedback changes the fix, the PR body is updated in the same round as the push — its Verification section quotes real output and silently becomes wrong otherwise, and it is what reviewers read.

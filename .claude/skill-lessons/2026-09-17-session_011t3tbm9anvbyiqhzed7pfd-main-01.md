# .claude/skills/qa-code-review/SKILL.md — re-resolving the head must re-read the PR body and draft state, not only the changed files

- Added: 2026-09-17
- Applies to: .claude/skills/qa-code-review/SKILL.md (section 6 anchoring, checks 2 and 10)
- Evidence: On percona/pmm-qa#1445 the review's summary comment (11:47:24Z) said the body still claimed `@nightly @dashboards` and "No new FB matrix job" and asked for the PR to be made a draft, 76 seconds after the author had drafted it and rewritten the body (11:46:08Z); the file-level threads in the same round had been re-anchored to the new head, so only the body and draft state were stale. The author recorded the miss so nobody would act on it — https://github.com/percona/pmm-qa/pull/1445#issuecomment-5713854757 and https://github.com/percona/pmm-qa/pull/1445#discussion_r4036471612 ("this landed a minute after the fix, so we crossed").
- Proposed change: In section 6, extend the re-resolve step beyond the changed files — when the head has advanced, re-read the PR's body and `draft` flag too, and drop any check 2 or check 10 finding they already satisfy, because those two checks read state that the head SHA does not carry.

---
description: Evidence-first workflow for turning logs, screenshots, and brief context into a concise Jira-ready bug report
---

# Rules

- Report only confirmed facts (prompt, screenshots, logs, CLI, MCP, code). No fixes, test plans, or unproven root causes.
- Unproven-but-likely details → `Unverified`. Missing details → note in `Repro Notes`, don't block.
- Keep evidence minimal: exact error text, failed requests, stack lines, short log excerpts.
- Ask follow-ups only if the report would otherwise be misleading.

# Analysis Order

1. Identify affected feature / page / API / component.
2. Classify: UI | functional | backend/API | performance/stability | access | install/upgrade/config.
3. Extract proof: error text, broken UI state, timestamp, failed request, stack/log line.
4. State user impact.
5. Infer shortest credible repro steps from evidence only.
6. State expected behavior from context and normal product behavior.
7. Set severity conservatively (lowest that matches confirmed impact).

# Title format

`[Component] Short factual description` — no root-cause guesses.

- `[Dashboards] Filter panel stays blank after reload`
- `[Backup] Restore action returns 500`

# Output

- **Title**: `[Component] Short bug description`
- **Summary**: 2-3 lines — defect + impact
- **Severity**: `Critical|Urgent|High|Medium|Low`. Default `Medium` when impact is unclear.
- **Component**: affected PMM area
- **Steps to Reproduce**: numbered
- **Actual**: confirmed observed behavior (evidence-backed)
- **Expected**: intended user-visible behavior (not a fix)
- **Evidence**: short proof bullets
- **Unverified**: _(only if needed)_
- **Repro Notes**: missing details, consistency, timing, role, environment, workaround

# Final Check

- [ ] Title names the affected component
- [ ] Severity matches confirmed impact
- [ ] Steps are reproducible or clearly partial
- [ ] `Actual` is supported by evidence
- [ ] `Expected` describes behavior, not a fix
- [ ] Uncertain points appear only in `Unverified`
- [ ] Short enough to paste into Jira without cleanup

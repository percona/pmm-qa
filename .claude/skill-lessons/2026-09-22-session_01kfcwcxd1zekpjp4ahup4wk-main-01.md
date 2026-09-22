# .claude/skills/qa-code-review/references/codeceptjs-legacy.md — assertions inside CodeceptJS page objects are the suite's convention

- Added: 2026-09-22
- Applies to: `.claude/skills/qa-code-review/SKILL.md` rule 11's codeceptjs clause, which treats a page method that "hides an assertion" as the reason to raise it
- Evidence: The author declined a 🟡 asking to move an `I.waitForText` out of `explorePage.setSqlQuery` into the scenario, because `tests/**/pages/` already carries ~209 `I.see*`/`I.waitForText` calls (e.g. `backup/pages/locationsPage.js:135-139`) and keeping it in the method gives every caller the guarantee — https://github.com/percona/pmm-qa/pull/1473#discussion_r4068456150 (companion: https://github.com/percona/pmm-qa/pull/1473#discussion_r4068456493).
- Proposed change: Scope "assertions live in the test, not the page object" to `e2e_tests/` (playwright-suite.md) and state in codeceptjs-legacy.md that a page-object assertion guarding its own action is the convention there and not a finding; drop "hides an assertion" as the trigger in SKILL.md rule 11.

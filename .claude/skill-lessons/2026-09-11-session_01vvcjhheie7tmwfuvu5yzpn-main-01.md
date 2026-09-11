# .claude/skills/qa-code-review/SKILL.md — the one-caller rule needs a suite scope for page-object methods

- Added: 2026-09-11
- Applies to: target only
- Evidence: check 11 ("a method with one caller does not need to exist ... applies to page-object methods") drew opposite human verdicts in the same window. In `e2e_tests/` it was upheld against the author's repo-prevalence defence — the author listed ten single-caller page methods and declined, and the reviewer answered "apply this" three times (https://github.com/percona/pmm-qa/pull/1411#discussion_r3989154727). In `codeceptjs-e2e/` the same finding was declined and the decline stood: "element interaction lives in `tests/pages/` by convention here, and the note about how this editor mishandles a programmatic clear belongs next to its locator" (https://github.com/percona/pmm-qa/pull/1414#discussion_r3991914118).
- Proposed change: scope check 11's page-object clause by suite — in `e2e_tests/` inline the single caller and treat "other single-caller page methods exist" as no defence; in `codeceptjs-e2e/` element interaction stays in `tests/pages/`, so raise it only when the method hides an assertion.

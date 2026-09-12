# .claude/skills/qa-code-review/references/playwright-suite.md — `JSON.stringify(row)` cannot reproduce a migrated CodeceptJS DataTable title

- Added: 2026-09-12
- Applies to: target only
- Evidence: A 🟡 suggestion on percona/pmm-qa#1417 asked for the hand-maintained `titleSuffix` literals to be dropped and the suffix derived with `JSON.stringify(panel)`, citing `verifyAnnotations.test.ts` as precedent. The author had already shipped that form once and measured 7 of 8 titles diverging from the source: `perfectionist/sort-objects` alphabetises the migrated object literal while CodeceptJS keys the JSON in `new DataTable([...])` column order, and the migrated row carries the destination POM key (`diskDetails`) where the source carried `osDiskDetails` (https://github.com/percona/pmm-qa/pull/1417#discussion_r3994508912).
- Proposed change: note in the migration guidance that a byte-identical migrated title needs its literal suffix — the lint rule's key ordering and a renamed POM key both break `JSON.stringify(row)` — so "derive the suffix from the row" is wrong for a ported DataTable title even though it is right for a native one.

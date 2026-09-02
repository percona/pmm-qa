# .claude/skills/qa-code-review/SKILL.md — check member-ordering before calling "drop `private`" a one-line diff

- Added: 2026-09-02
- Applies to: target only
- Evidence: A thread applied item 13 to a `getLocations` method in `e2e_tests/api/backups.api.ts` that the PR had made public, arguing "dropping `private` in place would have been a one-line diff"; leaving the method in place and removing only the keyword fails `eslint` with `Member getLocations should be declared before all private method definitions` (@typescript-eslint/member-ordering) and `Expected "getLocations" (function-property) to come before "getArtifacts" (private-function-property)` (perfectionist/sort-classes), so the relocation the PR made was forced and only the accompanying rename was avoidable.
- Proposed change: In section 3 item 13, note that `e2e_tests/eslint.config.mjs:126` orders public members before private ones, so un-privatising a method necessarily relocates it — read the config (do not run it, per section 1) before describing the size of the resulting diff, and scope the finding to the rename or other avoidable churn.

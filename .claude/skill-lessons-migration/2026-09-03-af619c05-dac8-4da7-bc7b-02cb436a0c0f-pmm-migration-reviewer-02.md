# .claude/skills/codeceptjs-migration/audit-checklist.md - name a working non-ASCII check, and scope it to added lines

- Added: 2026-09-03
- Applies to: target only
- Evidence: At the row 4 final gate, the ASCII item ("Changed migration docs contain ASCII punctuation only") was checked with `grep -nP '[^\x00-\x7F]'` in a per-file loop; every invocation failed with "grep: -P supports only unibyte and UTF-8 locales" on this Windows/Git-Bash setup, printing eight errors and zero results, which reads as eight file failures rather than one unusable matcher. A single Python byte scan over the changed-file list worked, but being file-scoped it flagged a pre-existing em-dash at `e2e_tests/README.md:46` that was not in the diff - the branch's only added line there was pure ASCII.
- Proposed change: In the Playwright-quality ASCII item, state that `grep -P` is unavailable here and give the working form - one byte scan over `git diff -U0 <base>..HEAD` added lines (or a file scan cross-checked against `git diff -U0`) - so the check measures what this migration added rather than what the file already contained.

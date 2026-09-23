# .claude/agents/investigator.md — Run the repo's own linter on committed code before handing back

- Added: 2026-09-23
- Applies to: .claude/agents/investigator.md
- Evidence: An investigator-authored fix commit passed reproduction but carried an eslint @stylistic/padding-line-between-statements error that only the delegating session caught with the repo linter before push.
- Proposed change: Before committing a code fix, run the repository's own linters over the changed files (e.g. `eslint`/`eslint --fix`, `actionlint`, `bash -n`) and only commit once clean, so handed-back commits are push-ready.

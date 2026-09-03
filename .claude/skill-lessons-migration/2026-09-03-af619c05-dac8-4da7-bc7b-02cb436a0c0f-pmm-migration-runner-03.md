# .claude/skills/codeceptjs-migration/branch-workflow.md — bound the reverse-direction check by first establishing which test files the migration changed

- Added: 2026-09-03
- Applies to: target only
- Evidence: `run.md` step 5b asks for the reverse-direction check "even when the edit only added a job", but leaves it as an unbounded re-list of existing expressions; on row 4 `git diff --name-status origin/main HEAD -- e2e_tests/tests/` returned exactly one `A` and zero `M`, which proves no existing expression's selection can change except by newly matching the added file and reduces the whole check to running each expression once and grepping its output for that filename — 14 expressions, 14 zero-hit results, one loop.
- Proposed change: In the "Check selectability per scenario and across every consumer" section, tell the runner to run `git diff --name-status origin/main HEAD -- e2e_tests/tests/` first and, when it shows no modified test file, to satisfy the reverse direction by listing each existing expression once and confirming zero hits for the added file's name.

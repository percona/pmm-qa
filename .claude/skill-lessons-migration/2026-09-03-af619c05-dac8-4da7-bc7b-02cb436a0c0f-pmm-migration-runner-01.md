# .claude/skills/codeceptjs-migration/run.md — name the README generator command; there is no npm script behind the `--check` it references

- Added: 2026-09-03
- Applies to: `.claude/skills/codeceptjs-migration/run.md` and `.claude/skills/codeceptjs-migration/branch-workflow.md`
- Evidence: Step 9 says to "regenerate `e2e_tests/README.md` and re-run the generator's `--check`" without naming a command, and `e2e_tests/package.json` defines only `prepare`, `lint`, `lint:ts`, `lint:ts:fix` and `typecheck`, so the natural guess `npm run readme:check` exits 1 with a missing-script error that reads like a failing check rather than a missing one; the real generator is `python support_scripts/generate_readme.py [--check]` at the repository root, invoked by `.husky/pre-commit` when a staged path matches `e2e_tests/tests/.*\.ts`.
- Proposed change: Write the literal command `python support_scripts/generate_readme.py --check` (run from the repository root, not `e2e_tests/`) into the step 9 sentence in `run.md` and into `branch-workflow.md`'s "Revalidate, every time" list.

# .claude/skills/qa-code-review/SKILL.md — this repo's linters are dispatched from a hook script, not named in the workflows

- Added: 2026-09-09
- Applies to: .claude/skills/qa-code-review/SKILL.md
- Evidence: a review of a workflow-only diff asserted that "the repo ships .github/actionlint.yaml but no workflow invokes actionlint, so nothing lints these files", and used it to argue the diff had no gate at all. A grep for `actionlint` under `.github/workflows/` is indeed empty, but `lint.yml` runs on `pull_request` with the single step `git ls-files -z | xargs -0 bash .claude/hooks/lint-changed.sh`, and that script selects `^\.github/workflows/.*\.ya?ml$` and runs actionlint plus `yamllint --strict` on it; running the script over the two changed files returned EXIT=0.
- Proposed change: state that lint coverage in this repo is resolved through `.claude/hooks/lint-changed.sh` (shared by `lint.yml` and the PreToolUse commit gate), so a coverage claim must read that script rather than grep the workflows — and that running it over the changed files is the way to show a diff passes.

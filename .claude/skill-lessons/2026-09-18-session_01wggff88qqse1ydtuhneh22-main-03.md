# CLAUDE.md — a green `Lint` check does not mean the diff was linted

- Added: 2026-09-18
- Applies to: the House style section of CLAUDE.md (the `.claude/hooks/lint-changed.sh` line); all agents opening percona/pmm-qa PRs
- Evidence: A PR changing two `codeceptjs-e2e/*.js` files rode a green `Lint` check. A reviewer pointed out those files were linted by nothing. Confirmed in the dispatcher: `lint-changed.sh` selects TypeScript with `select_files '\.ts$'`, then `grep -q '"lint"' "$ws/package.json" || continue` skips any workspace without a lint script — and `codeceptjs-e2e/package.json` has none. So a `.js`-only diff there passes the gate unlinted, and `Lint` is green because it linted other files.
- Proposed change: Beside the existing "call the underlying tool" line, note that `lint-changed.sh` dispatches by extension and silently skips a workspace with no `"lint"` script, so before citing a green gate a PR must check that the dispatcher actually selected the changed files, and say "no gate covers these files" plus what was run instead (e.g. `node --check`) when it did not.

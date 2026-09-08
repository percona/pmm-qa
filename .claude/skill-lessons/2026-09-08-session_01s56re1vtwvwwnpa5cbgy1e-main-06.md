# CLAUDE.md — never run a PreToolUse hook by hand; it reports success without doing anything

- Added: 2026-09-08
- Applies to: all agents and routines in this repo
- Evidence: `.claude/hooks/pre-commit-lint-gate.sh` reads its payload with `input=$(cat)`, so two manual invocations reported `gate exit=0` while linting nothing (stdin was /dev/null, the `git commit` grep found no command, early exit 0) and a third hung on stdin for five minutes and had to be killed — after which `.claude/hooks/lint-changed.sh <files>` ran the real yamllint/shellcheck in seconds.
- Proposed change: In the House style section, state that hooks under `.claude/hooks/` are invoked by the harness with a JSON payload on stdin and must never be run manually as a check — call the underlying tool (`lint-changed.sh <files>`) instead, and let the gate fire on `git commit`.

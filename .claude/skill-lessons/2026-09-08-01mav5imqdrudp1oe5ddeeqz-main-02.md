# CLAUDE.md — `cd "$VAR" || cd fallback` silently keeps the current directory when the variable is unset

- Added: 2026-09-08
- Applies to: all skills and agents
- Evidence: `cd "$SCRATCH" 2>/dev/null || cd <absolute scratch path>` ran with `SCRATCH` unset; `cd ""` exits 0 without moving, so the fallback never ran and downloaded CI artifacts were written into the tracked `pmm-qa` checkout, needing a cleanup move before the branch was usable.
- Proposed change: Add to the House style section that a directory must be addressed by its literal absolute path, and that `cd "$VAR"` guarded only by `||` is forbidden because an unset variable makes it a successful no-op rather than a failure.

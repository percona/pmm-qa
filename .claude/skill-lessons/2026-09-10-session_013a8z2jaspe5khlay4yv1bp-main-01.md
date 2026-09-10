# CLAUDE.md (House style) — Run scratch/package-manager commands in a verified scratch dir, never a fall-through cwd

- Added: 2026-09-10
- Applies to: all skills
- Evidence: `cd "$SCRATCHPAD" || cd /fallback` both failed silently (var unset, fallback dir absent), so `npm init`/`npm install` ran in the tracked repo root and created package.json, package-lock.json and node_modules that had to be moved out.
- Proposed change: Instruct agents to `mkdir -p` an absolute scratch subdir and `cd <dir> || exit 1` (confirming pwd) before any file-creating or package-manager command, rather than chaining a fallback `cd`; reinforce the existing "local tooling workaround never mutates a tracked file" rule.

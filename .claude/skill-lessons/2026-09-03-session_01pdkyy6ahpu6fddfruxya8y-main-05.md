# .claude/skills/ui-evidence/SKILL.md — an ad-hoc Playwright script must live in .claude/scripts/ or it cannot resolve playwright

- Added: 2026-09-03
- Applies to: target only
- Evidence: A one-off Playwright script written to the session scratchpad and to `/tmp` failed with `Cannot find module 'playwright'` even when run with the repo as the working directory, twice; Node resolves `node_modules` from the script's own directory, and the only install is `.claude/scripts/node_modules`. Copying the same file into `.claude/scripts/` ran immediately. Requiring `./lib/proxy` from the sibling directory also only works from there.
- Proposed change: In the "writing your own Playwright script" guidance, say the file must be created inside `.claude/scripts/` (not `/tmp` or a scratchpad) because module resolution and the `./lib/proxy` require are relative to the script's directory.

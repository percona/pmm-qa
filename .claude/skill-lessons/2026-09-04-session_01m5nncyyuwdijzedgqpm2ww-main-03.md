# .claude/skills/ui-evidence/SKILL.md — pw-screenshot.js covers local HTML previews too, but the skill only triggers on PMM UI

- Added: 2026-09-04
- Applies to: .claude/skills/ui-evidence/SKILL.md
- Evidence: To take the one pre-publish look at an artifact HTML file, a bespoke Playwright script was written in the scratchpad and failed twice (playwright not resolvable, then ESM ignoring NODE_PATH) before an absolute import of /opt/node22/lib/node_modules/playwright/index.mjs worked; `.claude/scripts/pw-screenshot.js` already takes any URL, including file://, and would have worked first time.
- Proposed change: Extend the skill description to cover screenshots of any URL or local HTML file (artifact previews, reports), and add a one-line example `node .claude/scripts/pw-screenshot.js file:///path/page.html out.png` so no session hand-rolls a Playwright script.

# .claude/skills/ui-evidence/SKILL.md — a bespoke Playwright script must set executablePath, or it dies on a missing headless shell

- Added: 2026-09-07
- Applies to: target only
- Evidence: a custom probe script calling `chromium.launch()` failed with "Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-<rev>" and a "run npx playwright install" banner, while the repo helpers work because they pass `executablePath: "/opt/pw-browsers/chromium"`; the skill invites copying `pw-record.js` without saying the launch options are load-bearing.
- Proposed change: in the "copy pw-record.js" note, state that any bespoke script must reuse `executablePath: "/opt/pw-browsers/chromium"` plus `lib/proxy`'s launch options, because Playwright's bundled-browser resolution points at a revision that is not installed.

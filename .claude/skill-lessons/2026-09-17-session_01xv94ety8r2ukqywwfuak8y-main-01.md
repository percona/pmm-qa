# .claude/skills/ui-evidence/SKILL.md — a saved PMM login session is single-use, so re-login before every screenshot

- Added: 2026-09-17
- Applies to: target only
- Evidence: Following the skill's advice to reuse one session name for follow-up screenshots, a login followed by two `pw-screenshot.js` calls produced one correct image and one of the login page; a login followed by three calls produced one correct image and two login pages. Re-running `pmm-ui-login.js` immediately before each screenshot produced correct images every time, on the same box and URLs.
- Proposed change: Replace the "reuse the same ticket key for follow-up screenshots so the login isn't repeated" guidance with the opposite — Grafana rotates the auth token on use, so call `pmm-ui-login.js` immediately before each `pw-screenshot.js`/`pw-record.js` invocation (a shell function wrapping login+shot) rather than once per ticket.

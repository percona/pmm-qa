# .claude/skills/ui-evidence/SKILL.md — a bespoke Playwright script must copy pw-screenshot.js's launch and re-login

- Added: 2026-09-16
- Applies to: target only
- Evidence: A scratch capture script failed three ways the helpers already handle: no `executablePath` ("Executable doesn't exist at .../chromium_headless_shell-1234"); `proxyLaunchOptions(url)` instead of the options object, after which every page rendered "upstream request failed" while curl to the same URL returned 200; and a storage state written by `pmm-ui-login.js` minutes earlier that screenshotted the login page.
- Proposed change: In the "anything more interactive" note, require a copied script to pass `executablePath: "/opt/pw-browsers/chromium"`, call `proxyLaunchOptions({ spkiPins })` with an options object (never a URL), and log in inline from `ADMIN_PASSWORD` when the login form is present rather than trusting a saved session.

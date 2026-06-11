---
description: Execution, browser, and locator strategy rules for PMM Playwright tasks
---

# Execution
- Execute directly. No plans or reasoning unless blocked.
- Search first; read smallest possible files (prefer nearby tests, POMs, helpers). No broad repo scans.

# API Setup
- Use PMM REST API to build state; UI only to verify behavior.
- Check `apiIndex.md` first. Open `pmmApi.json` only for precise schema definitions.

# Login
- Follow `pmmLogin.md`. Basic Auth headers only.
- Never use the UI login form or `/graph/login` (except when debugging auth).

# Browser
- Batch multiple actions (fills, clicks, asserts) into one `browser_run_code` call.
- Use `browser_wait_for` or Playwright assertions. No manual sleeps.
- Do not reload or re-authenticate unless state explicitly demands it.
- If blocked: `browser_snapshot` once, stop, reassess.
- After navigation: verify expected route and visible page-specific content/controls. HTTP `200` alone is not a valid assertion.

# Locators & POM
- Priority: `getByTestId` > `getByRole` > `getByLabel` > `getByPlaceholder`.
- Reuse existing POM locators.
- If missing: one DOM discovery pass → update POM. Never re-evaluate the same page's DOM.
- Avoid: `nth()`, `first()`, `last()`, dynamic XPath, text-heavy selectors.

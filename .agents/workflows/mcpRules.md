---
description: Execution, browser, and locator strategy rules for PMM Playwright tasks
---

# Execution & Context
- Execute directly; DO NOT output plans or reasoning unless blocked.
- Search first, read smallest possible files second (prefer nearby tests, POMs, helpers).
- NO broad repo scans.

# API Setup
- Use PMM REST API to build test state; use UI ONLY to verify behavior.
- Check `apiIndex.md` first for routes. Open `pmmApi.json` ONLY for precise schema definitions.

# Login
- Follow `pmmLogin.md`.
- Basic Auth headers ONLY.
- NEVER use the UI login form or `/graph/login` (except when debugging auth).

# Browser interactions
- Batch multiple actions (fills, clicks, asserts) into one `mcp_playwright_browser_run_code` call.
- Use `browser_wait_for` or Playwright assertions. NO manual sleeps.
- Do not reload or re-authenticate unless state explicitly demands it.
- If blocked, `browser_snapshot` once, stop, and reassess.

# Locators & POM
- Priority: `getByTestId` > `getByRole` > `getByLabel` > `getByPlaceholder`.
- Reuse existing POM locators.
- If missing: do EXACTLY ONE DOM discovery pass, then update the POM. NEVER re-evaluate the same page's DOM.
- AVOID: `nth()`, `first()`, `last()`, dynamic XPath, and text-heavy selectors.

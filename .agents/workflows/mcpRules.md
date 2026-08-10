---
description: Execution, browser, and locator strategy rules for PMM Playwright tasks
---

# Execution & Context
- Execute directly; DO NOT output plans or reasoning unless blocked.
- Search first, read smallest possible files second (prefer nearby tests, POMs, helpers).
- NO broad repo scans.

# Browser tool — Playwright MCP only
- **Use only `mcp__playwright__*` for all browser automation.** No other tool, no
  exceptions.
- **Verify it's connected before relying on it.** This file assumes a connected Playwright
  MCP server (tools named `mcp__playwright__browser_run_code_unsafe`,
  `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_wait_for`, etc.). Check
  the current tool list first. If those tools are absent, stop and report that the
  Playwright MCP server isn't connected — do not substitute any other tool.

# API Setup
- Use PMM REST API to build test state; use UI ONLY to verify behavior.
- Check `apiIndex.md` first for routes. Open `pmmApi.json` ONLY for precise schema definitions.

# Login
- Follow `pmmLogin.md`.
- Basic Auth headers ONLY.
- NEVER use the UI login form or `/graph/login` (except when debugging auth).

# Browser interactions
- Batch multiple actions (fills, clicks, asserts) into one `mcp__playwright__browser_run_code_unsafe` call.
- Use `mcp__playwright__browser_wait_for` or Playwright assertions. NO manual sleeps.
- Do not reload or re-authenticate unless state explicitly demands it.
- If blocked, `mcp__playwright__browser_snapshot` once, stop, and reassess.

# Locators & POM
- Priority: `getByTestId` > `getByRole` > `getByLabel` > `getByPlaceholder`.
- Reuse existing POM locators.
- If missing: do EXACTLY ONE DOM discovery pass, then update the POM. NEVER re-evaluate the same page's DOM.
- AVOID: `nth()`, `first()`, `last()`, dynamic XPath, and text-heavy selectors.

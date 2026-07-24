---
description: Playwright handoff report
---

# Core Rules

- Output ONLY a structured exploration report using a template.
- NO speculative plans, raw DOM dumps, reasoning, or Playwright code generation.
- If blocked execution: Stop immediately, report blocker.
- PREFER `[API]` for state creation. Use `[Auth]` only for session state. Use `[Nav]` for URL routing. Use `[UI]` inside pages.

# Output Format

## Steps

- Ordered execution trace (e.g. `1. [API] Stop session`, `2. [Nav] Admin path`).

## Key Locators

- Element | Purpose | Locator

## State (Before & After)

- URL
- Values/Selections
- Visible Errors/Messages
- _(Log changed/relevant fields ONLY)_

## Assertions

- `Verify:` Behavior that happened.
- `Assert:` Playwright check needed.

## Stability notes

- Log: dynamic IDs, long waits, flake risk, useful traces.

---

# Templates (Pick One)

## POM Discovery

- **Steps:** `[Nav]`, `[UI]`
- **Locators:** New elements.
- **State:** Before/After visual limits.
- **Stability:** Selectors, loads.

## API Setup

- **Steps:** `[API]`, then `[UI]/[Nav]` checks.
- **Locators:** Verification elements.
- **Assertion:** End-state expectation.
- **Stability:** Race conditions.

## Bug Investigation

- **Steps:** `[Auth]`, `[Nav]`, `[UI]`
- **State:** Before/After (highlight explicit error!).
- **Stability:** Intermittent triggers.
- **IMPORTANT:** If a bug is confirmed, use `bugReport.md` (`/bugReport`) to format the report.

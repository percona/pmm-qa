---
description: Playwright handoff report
---

# Rules

- Output ONLY a structured report using the template below.
- No speculative plans, raw DOM dumps, reasoning, or Playwright code generation.
- If blocked: stop immediately, report blocker.
- Prefer `[API]` for state creation. Use `[Auth]` for session state. `[Nav]` for URL routing. `[UI]` inside pages.

# Output Template

## Steps

Ordered execution trace — e.g. `1. [API] Stop session`, `2. [Nav] /pmm-ui/inventory`

## Key Locators

| Element | Purpose | Locator |

## State (Before & After)

- URL
- Values / Selections
- Visible Errors / Messages
  _(changed or relevant fields only)_

## Assertions

- `Verify:` behavior that happened
- `Assert:` Playwright check needed

## Stability Notes

Dynamic IDs, long waits, flake risk, useful traces.

---

# Templates

## POM Discovery

Steps: `[Nav]`, `[UI]` · Locators: new elements · Stability: selectors, loads

## API Setup

Steps: `[API]` then `[UI]/[Nav]` checks · Locators: verification elements · Assertion: end-state · Stability: race conditions

## Bug Investigation

Steps: `[Auth]`, `[Nav]`, `[UI]` · State: before/after (highlight error) · Stability: intermittent triggers
→ If bug confirmed: use `bugReport.md` (`/bugReport`) to format the report.

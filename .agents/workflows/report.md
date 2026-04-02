---
description: Playwright handoff report
---

Perform the provided scenario and return only a structured exploration report for later Playwright authoring.

# Step type meanings:
- [API] = setup or data creation done programmatically
- [Auth] = authentication/session setup
- [Nav] = page-to-page movement using URL or browser navigation
- [UI] = interaction with elements inside the current page

# Rules:
- Use [API] for setup when possible (see `.agents/workflows/pmmApi.json`)
- Use [Auth] for auth state
- Use [Nav] for URL navigation unless navigation controls are under test
- Use [UI] for in-page actions
- Stay within the provided scope
- Do not generate Playwright code

# Output format:

# Steps:
- List the executed steps in order, prefixed with [API], [Auth], [Nav], or [UI]

# Key locators:
- List only important elements used or observed
- For each element include:
  - Element
  - Purpose
  - Locator

# Before:
- Record the relevant state before the key action:
  - URL
  - selected/input values
  - visible data/messages
  - error/no-data state

# After:
- Record the relevant state after the key action:
  - URL
  - selected/input values
  - visible data/messages
  - error/no-data state

# Expect/Assertion:
- For each relevant check include:
  - Verify: what behavior should be validated
  - Assert: what the later Playwright test should check

# Stability notes:
- Mention:
  - dynamic values
  - waits/loading concerns
  - fragile locators
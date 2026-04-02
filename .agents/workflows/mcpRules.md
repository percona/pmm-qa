---
description: Rules to save LLM tokens
---

# STRICT Login Rules
----------------------------
- When performing a login, strictly follow the instructions defined in pmmLogin.md.
- Do not attempt to locate or reference any alternative URLs, environment variables, or configuration files.
- Treat the defaults specified in pmmLogin.md as the single source of truth.
- Do not read any files inside `e2e_tests/`.
- Do not provide explanations unless explicitly requested. Just say `Done`.

# CRITICAL Rules
----------------------------
- Auth via Basic Auth header only (see `pmmLogin.md`).
- NEVER use UI login form.
- NEVER call `/graph/login` unless explicitly debugging authentication.
- Snapshots OFF by default.
- If completely blocked, use `mcp_playwright_browser_snapshot` once only.
- NEVER dump raw DOM.

----------------------------
# HIGH Priority Rules
----------------------------
- Prefer PMM REST API over UI (see `.agents/workflows/pmmApi.json`).
- Use `browser_evaluate` for:
  - text checks
  - attribute checks
  - state validation
- Use `browser_wait_for(text = '...')` instead of polling or loops.
- Batch all actions into a single `mcp_playwright_browser_run_code` block:
  - fills
  - clicks
  - assertions
- Avoid multiple sequential tool calls when one can do the job.

----------------------------
# EXECUTION Strategy
-------------------------
- Navigate directly to target page (avoid extra redirects).
- Do not reload page unless strictly required.
- Do not re-authenticate if already authenticated.
- Do not re-scan DOM if selectors are already known.

----------------------------
# SELECTOR Strategy
----------------------------
- Use stable selectors only:
  - getByTestId (preferred)
  - getByRole
  - getByPlaceholder
- Avoid:
  - text-heavy selectors
  - dynamic XPath
  - full DOM traversal

----------------------------
# ANTI-PATTERNS
----------------------------
- UI login flows unless specified
- Calling `/graph/login` in normal execution
- Repeated snapshots
- Raw HTML extraction
- Multiple small MCP calls instead of one batched call
- Unnecessary waits, reloads, or navigation loops
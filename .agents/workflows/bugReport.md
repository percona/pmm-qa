---
description: Evidence-first workflow for turning logs, screenshots, and brief context into a concise Jira-ready bug report
---

# Purpose

Use this workflow to convert bug evidence into a compact report.

Allowed input:
- user context
- screenshots
- logs
- trace snippets
- console errors
- network errors
- directly relevant code references

Reporting only:
- Do not propose fixes or a test plan.
- Do not invent root cause, environment, or steps.

# Core Rules

- Report only confirmed facts from prompt, screenshots, logs, CLI, MCP, or code.
- Put anything likely but unproven in `Unverified`.
- Prefer concrete evidence over interpretation.
- Summarize noisy logs to the smallest useful line.
- Separate `Actual` from `Expected`.
- If details are missing, still write the report and note the gap in `Repro Notes`.
- Ask follow-up questions only if the report would otherwise be misleading.

# Analysis Order

1. Identify the affected feature, page, API, or component.
2. Classify the issue: UI, functional, backend/API, performance/stability, access, or install/upgrade/config.
3. Extract only proof: visible error text, broken UI state, timestamp, failed request, stack line, or log line.
4. State user impact.
5. Infer the shortest credible repro steps from provided evidence only.
6. State expected behavior from context and normal product behavior.
7. Set severity conservatively.

# Input Rules

## Screenshots

- Capture visible page names, URLs, controls, and exact error text.
- Describe only what is visible.
- Mark an element as missing only when the intended element is clear.
- Reference the screenshot in `Evidence`.

## Logs

- Keep only the smallest lines that prove failure.
- Prefer explicit errors, status codes, timeouts, connection failures, and service names.
- Do not paste large log blocks.
- Move suspected root cause to `Unverified`.

## Minimal Context

- Do not block on missing details.
- Provide a constrained title, minimal steps, explicit evidence, and note gaps in `Repro Notes`.

# Severity

Choose the lowest severity that matches confirmed impact.

- `Critical`: data loss, security issue, complete outage, blocked install/upgrade, or unusable core workflow with no workaround
- `Urgent`: primary workflow broken, repeated hard failure, or severe impact with impractical workaround
- `High`: strong functional impact, incorrect results, partial workflow breakage, or major usability degradation
- `Medium`: limited functional issue, secondary workflow problem, or contained UI/behavior issue
- `Low`: cosmetic or low-impact polish issue

Default to `Medium` if impact is unclear.

# Title

- Format: `[Component] Short factual description`
- Do not include root-cause guesses.

Examples:
- `[Dashboards] Filter panel stays blank after reload`
- `[Backup] Restore action returns 500`

# Output Format

Provide exactly these sections:

- **Title**: `[Component] Short bug description`
- **Summary**: 2-3 short lines covering the defect and impact
- **Severity**: `Critical|Urgent|High|Medium|Low`
- **Steps to Reproduce**:
  1. Step one
  2. Step two
- **Actual**: Confirmed observed behavior
- **Expected**: Intended user-visible behavior
- **Evidence**: Short proof bullets
- **Unverified**: Only if needed
- **Repro Notes**: Missing details, consistency, timing, role, environment, or workaround notes

# Evidence Rules

Keep `Evidence` compact.

Examples:
- `Screenshot: settings-page-error.png shows "Failed to load user"`
- `Log: pmm-managed timeout waiting for inventory sync`
- `API: GET /v1/inventory/nodes returned 500`
- `Console: TypeError on dashboard load`

Avoid full stack traces, long logs, broad narratives, and unsupported root-cause claims.

# Final Check

- Title names the affected component.
- Severity matches confirmed impact.
- Steps are reproducible or clearly partial.
- `Actual` is supported by evidence.
- `Expected` describes behavior, not a fix.
- Uncertain points appear only in `Unverified`.
- Keep the report short enough to paste into Jira without cleanup.

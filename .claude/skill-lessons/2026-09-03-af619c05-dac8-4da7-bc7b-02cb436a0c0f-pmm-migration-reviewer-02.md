# AGENTS.md — PowerShell `Out-File -Encoding utf8` writes a BOM that breaks every Node `JSON.parse` downstream

- Added: 2026-09-03
- Applies to: all skills
- Evidence: Piping `npx playwright test --list --reporter=json` to a file with `Out-File -Encoding utf8` and reading it back in Node failed with `SyntaxError: Unexpected token '﻿'`, costing a retry; this repo tells agents to prefer PowerShell on Windows while most of its tooling parses the output in Node, so the collision is structural rather than incidental.
- Proposed change: Add one line to the PowerShell guidance stating that redirection and `Out-File`/`Set-Content -Encoding utf8` emit a UTF-8 BOM, and that any file a Node script will parse must be written with `[System.IO.File]::WriteAllText(...)` or have the leading BOM stripped on read.

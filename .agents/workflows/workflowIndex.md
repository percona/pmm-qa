---
description: Entry point for PMM LLM + Playwright workflow selection
---

# Workflow Mappings
| File | Slash | Open when… |
|---|---|---|
| `pmmLogin.md` | `/pmmLogin` | Needs auth/session setup. |
| `mcpRules.md` | `/mcpRules` | Core execution strategy (READ THIS FIRST). |
| `pomRules.md` | `/pomRules` | Needs POM creation/updates. |
| `report.md` | `/report` | Needs handoff report or blocked exploratory task. |
| `bugReport.md` | `/bugReport` | A bug is found during exploration. |
| `apiIndex.md` | `/apiIndex` | Needs PMM API route groups. |
| `pmmApi.json` | — | Exact API schema lookup needed. |

# Priority & Execution
1. Follow `mcpRules.md` aggressively.
2. PREFER API setup (`apiIndex.md`) over UI execution (`pmmLogin.md`).
3. Reuse existing POMs/Helpers. NEVER rediscover mapped elements.
4. If missing, do ONE targeted DOM pass and log to POM (`pomRules.md`).
5. Use `report.md` ONLY for exploratory handoffs or hard blockers. If a bug is found during exploration, switch to `bugReport.md`.

# Hard Constraints
- Read ONLY the smallest necessary files.
- BATCH Playwright actions. No spamming MCP calls.
- DO NOT plan/narrate. Execute directly.
- Fail TWICE? Stop and report. DO NOT retry blindly.
- Repo/Code is SOURCE OF TRUTH if docs conflict.
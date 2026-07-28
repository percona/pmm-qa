# Validation checklist (first cloud run)

Run these once after merging agent files to `main`. Document results in a comment on the validating PR.

| # | Test | Expected | Documented? |
|---|------|----------|-------------|
| 1 | Desktop Cloud → `/test-runner PMM-XXXX` as **first** prompt | Agent reads `.cursor/agents/test-runner.md` and follows workflow | Partial |
| 2 | cursor.com/agents → PMM → same prompt | Same behavior | Partial |
| 3 | `.cursor/agents/` loaded in cloud session | Auto-delegation by `description` works | **No** |
| 4 | Subagent loads `.cursor/skills/` | Skills auto-load OR read-by-path works | **No** |
| 5 | Multi-repo environment: which `AGENTS.md` wins? | Note which repo's rules apply | **No** |
| 6 | Skills from both `pmm` and `pmm-qa` loaded? | List which skills appear | **No** |
| 7 | Desktop: pick environment `PMM` explicitly | May be automatic only | **No** |
| 8 | `beforeShellExecution` blocks `git clone ... pmm-submodules` | Deny with message | Yes |
| 9 | Jira comment without visibility | Hook or agent stops | Partial |

**Pass criteria for rollout:** items 1–2 work via read-by-path; items 3–7 documented for team; 8–9 verified.

If item 3 fails, workers in Fase 3 stay unused — roles still work via path pointers.

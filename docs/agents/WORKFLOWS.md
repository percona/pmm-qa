# `.agents/workflows` vs `.cursor/agents`

Two different mechanisms — do not confuse them.

## `.agents/workflows/` (IDE workflow prompts)

| | |
|--|--|
| **What** | Task-specific instruction files for LLM-assisted **local** test development in this repo |
| **Who reads them** | Cursor / VS Code / Antigravity chat when you invoke `#apiIndex`, `/pmmLogin`, etc. |
| **Documented by** | [`.agents/README.md`](../../.agents/README.md) — **not** a Cursor platform feature; repo convention from PR #908 |
| **Examples** | `pmmLogin.md`, `pomRules.md`, `bugReport.md`, `workflowIndex.md` |
| **Cloud QA roles?** | **No** — reference only (e.g. login selectors for computer use) |

These are **not** subagents and are **not** loaded automatically in cloud automations.

## `.cursor/agents/` (cloud QA roles)

| | |
|--|--|
| **What** | Test Runner, Test Healer, Test Reporter — versioned role definitions |
| **Who reads them** | Cloud agents via slash `/test-runner`, auto-delegation, or dashboard pointer prompts |
| **Documented by** | [ROLES.md](ROLES.md), [AUTOMATIONS.md](AUTOMATIONS.md) |
| **Knowledge** | `.cursor/skills/pmm-*/` loaded by path from the role file |

## `.cursor/skills/` (domain knowledge)

On-demand playbooks (Jira, FB tests, provisioning, git diff, etc.). Any agent — cloud or local — can read them by path.

## When to use which

| Task | Use |
|------|-----|
| Manual QA on a Jira ticket (cloud) | `.cursor/agents/test-runner.md` + skills |
| Write a new Playwright POM locally | `.agents/workflows/pomRules.md` |
| PMM UI login patterns | `.agents/workflows/pmmLogin.md` (reference for computer use) |
| Jenkins parambuild on your PC | `.cursor/skills/pmm-jenkins-staging/SKILL.md` |
| Provision PMM on Cursor MicroVM | `.cursor/skills/pmm-provisioning/SKILL.md` → `cursor-qa-integration/` |

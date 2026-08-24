---
name: model-router
description: "Choose a cost-appropriate model tier for delegated work. Use before spawning or fanning out subagents. Does not change the current session model."
---

# Model router

This skill selects the model for delegated work, not for the current conversation. Direct users to `/config` or the model picker when they want to change the current session.

## Decide whether to delegate

Do work directly when it needs only one or two tool calls or a handful of small edits in one working tree. Delegate only self-contained work that benefits from isolated context, independent execution, or substantial exploration.

Batch identical work into one task. Five equivalent file edits are one agent call, not five. Split only genuinely independent work or work requiring separate repositories or worktrees.

## Choose the tier

State the tier and reason in one line before delegating.

- **haiku**: Mechanical, unambiguous, and cheaply verified. Spot-check the actual result. If it fails, retry with sonnet; retries can reduce or erase the savings.
- **sonnet**: Explicit default for normal implementation, debugging, multi-file changes, research, synthesis, and review.
- **opus**: Ambiguous or high-stakes work where an error would be costly and hard to detect, such as architecture, security review, or subtle root-cause analysis.

Always pass an explicit tier. If uncertain between haiku and sonnet, use sonnet. If uncertain between sonnet and opus, use sonnet unless the high-stakes rule applies. Inherit only when matching the parent model is intentional.

After a successful escalation, identify the cause. Capture a missing reusable instruction for the relevant task-specific skill; if stronger reasoning was required or the cause is unclear, route that task type to the successful tier. Ignore one-off failures, and never let subagents modify routing files.

## Apply and audit

Read the active delegation tool's schema and use its documented model field and accepted values. For Claude Code's Agent tool, pass `model: "haiku" | "sonnet" | "opus"`. For other tools or Workflow APIs, use their documented field; never invent or assume one.

Aliases vary by provider and can change over time. For cost audits, never ask a model to identify itself. Use authoritative runtime data:

- Claude Code OpenTelemetry: `model`, `query_source`, and `agent_id`.
- Claude Agent SDK: `modelUsage` or `model_usage`, plus reported token and cost fields.

If those are unavailable, record the requested alias and provider and mark the resolved model unknown.

Judge savings by cost per successful task, including retries, cached and uncached input, output, and tool use. A response-only routing eval proves policy compliance, not savings; cost claims require real delegated runs with runtime usage data.

---
name: model-router
description: "Pick the right model tier (haiku/sonnet/opus) for work you're about to delegate via the Agent tool or a Workflow's agent() calls. Use whenever you're about to delegate, fan out, spin up agents for, or spread a task across subagents — before the Agent/Workflow call, not after. Does not change the current session's own model; that's a /config or app-UI action for the user, not something a skill can do."
---

# Model router

A skill can't change the model of the conversation it's running in. What it *can* do is choose which model each delegated subagent runs on — the `model` param on the Agent tool, or `opts.model` in a Workflow's `agent()` calls. This skill is that choice.

If the user is asking about switching their own session's model, tell them that's a `/config` or app-UI action — this skill has no effect there.

## First, check delegation is worth it at all

A model tier only matters once you've decided to delegate. Spinning up an agent has real overhead — latency, coordination, a separate context to review — so it only pays for itself on work that's genuinely open-ended or independent, not on something you could just do directly in one or two tool calls. A handful of known, small, single-tree edits is usually faster and easier to verify done inline than farmed out, no matter what tier you'd pick. If delegating doesn't clearly help, say so and do the work directly instead of picking a tier for it.

## Once delegating, classify the subtask

One line, stated before the call: what tier, and why. Judge the subtask being handed off, not the overall task it's part of — a "big" project can still have a mechanical subtask, and a "small" task can hide a genuinely ambiguous call.

**haiku** — mechanical, spec is unambiguous, a wrong output would be obviously wrong on inspection. Renaming a variable everywhere, running a known command and reporting output, reformatting a file, summarizing a short doc, a grep/lookup with an obvious target. Haiku is cheap per token, not cheap per outcome — if the subtask is even slightly likely to need a retry or a correction pass, the savings disappear the moment that happens. Reserve it for cases where you (or the user) can check the result at a glance. If a haiku-tier result doesn't hold up on that cheap check — including its own summary of what it did, which is worth spot-checking against the actual diff rather than trusting outright — don't just retry haiku again; escalate the retry to sonnet. Whatever made the task harder than expected likely isn't a fluke, and a second haiku attempt is liable to fail the same way, burning the tokens you were trying to save.

**sonnet** — the default for real work. Typical implementation, debugging, multi-file changes, moderate research or synthesis, most code review. If nothing about the subtask stands out as trivial or as unusually high-stakes, this is it.

**opus** — the call is ambiguous, the tradeoffs are real, or getting it wrong would be costly *and* hard to catch later. Architecture or design decisions, security review, root-causing a subtle or intermittent bug, reconciling conflicting sources, judging correctness where there's no cheap way to check the answer.

## Applying it

Pass the tier through the delegation call itself — check the tool's current schema for the exact parameter name and accepted values rather than assuming from memory; these are tool-version-dependent and can drift.

- Agent tool: `model: "haiku" | "sonnet" | "opus"`
- Workflow `agent()`: `opts.model` (same values, per the tool's own description — it doesn't enumerate them as explicitly as the Agent tool does, so double-check if in doubt)

If the subtask lands squarely on sonnet — the default tier, most of what you delegate — say so explicitly (`model: "sonnet"`) rather than omitting the param. Omitting it inherits whatever model is running the current session, which may not be sonnet: if the session itself is on opus, an omitted override on routine delegated work silently pays opus rates for it.

Genuinely torn between two tiers? Still pick one and say so — "torn between sonnet and opus, going with sonnet since nothing here is irreversible" is a real, auditable decision; omitting the param isn't a third option, it's just hiding the same decision inside whatever the session happens to be running. The only time omission is actually correct is when you want exactly that inheritance — e.g. a sub-step of a larger delegated task that should obviously match its parent's tier.

The tier names here — haiku, sonnet, opus — are today's three; don't assume they're permanent. Model families get renamed, added, retired, and aliases can resolve to a different underlying model over time or across providers. Before relying on them, check the delegation tool's *current* schema for what values it actually accepts (see above), and if the available set has changed, remap using the same complexity heuristic (cheap-and-checkable / default / high-stakes-and-hard-to-verify) rather than reflexively reaching for these three names. When it matters to know exactly what ran — auditing a cost/quality tradeoff, or verifying an alias actually resolved the way you expected — the tool call itself won't tell you; the resolved model isn't exposed in the Agent/Workflow result metadata. What works is asking the delegated agent to report its own model identity as part of what it hands back (e.g. "state which model you are in your final report") — models generally know their own name and version, so this is real, recordable data, not a guess.

Fanning out several subtasks at once (parallel Agent calls, a Workflow `parallel()`/`pipeline()`) doesn't mean they all get the same tier — classify each one on its own merits. But fanning out isn't the same as batching: several genuinely independent subtasks (a security review and an unrelated flaky-test fix) each get their own agent call, one per subtask. A pile of *identical* rote edits across many files is a different shape — that's one subtask with many targets, not many subtasks, so it's one haiku-tier agent given the whole list, not one agent per file. Splitting it into N agents multiplies the fixed per-agent overhead (spin-up, a separate context to review) for identical work that didn't need isolating in the first place; only split by file when the files genuinely need independent handling (e.g. different repos/worktrees, or a scale where true concurrency matters more than the added overhead).

---
name: skill-gardener
description: Capture high-signal lessons from completed work and turn them into reviewable improvements to skills, agents, or shared instruction docs. Use after a user correction, a repeated workflow, a demonstrated better technique, or a gap in an existing skill; also use when asked to review skill lessons, improve a skill from experience, identify a new skill candidate, or reflect on how a task was done. Do not use for routine task completion, one-off preferences, generic retrospectives, or when no reusable lesson emerged.
---

# Skill Gardener

Preserve proven lessons without turning every task into process work. Keep the primary task first, record only reusable evidence, and never change a target without explicit authorization.

## Choose the mode

- **Capture:** Record a lesson from work that just happened.
- **Review:** Turn open lessons into a small set of concrete proposals.
- **Apply:** Update or create targets the user explicitly approved.

When invoked without a mode, infer it from the request. During ordinary task work, use Capture only after a qualifying signal appears.

## What counts as a target

Behavior in this repository lives in more than skills. A lesson may target any of:

- a skill under `.claude/skills/<name>/SKILL.md`
- an agent under `.claude/agents/<name>.md`
- a shared instruction doc — `AGENTS.md`, or the House style section of `CLAUDE.md`
- `candidate: <name>` for a skill that does not exist yet

Name the concrete file. A lesson that cannot name one is too vague to record.

## Not a substitute for memory

This skill and the auto-memory at `~/.claude/projects/<project>/memory/` capture different things. Recording the same lesson in both produces two copies that drift.

- **Memory** — who the user is, and durable personal preferences about how they want to be worked with, including corrections that apply across every repository.
- **Skill lesson** — a change to a method, workflow, or instruction that belongs in a file the whole team reads.

If a correction is both, put the preference in memory and the file change in the lesson log, and have each mention the other.

## Capture

1. Finish or stabilize the user's primary task before doing bookkeeping.
2. Record a lesson only when at least one signal is present:
   - the user corrected behavior in a way that should generalize;
   - an existing skill or agent caused or failed to prevent a concrete mistake;
   - the same manual workflow or workaround appeared at least twice;
   - a technique produced demonstrably better accuracy, safety, or efficiency;
   - the user explicitly asks to preserve the lesson.
3. Reject observations that are one-off preferences, task facts, generic advice, tool failures unrelated to method, speculation, or already covered by current instructions.
4. For a new-skill candidate, require two concrete occurrences unless the user explicitly requests the skill.
5. Read `.claude/skill-lessons.md` if it exists. Search for the same target and lesson before writing.
6. Append one compact entry, or add evidence to the existing entry instead of duplicating it. Create the file only for the first qualifying lesson; start a new file with `# Skill Lessons` and `Open, sanitized lessons awaiting review.`

Use this format:

```markdown
## <target file, or "candidate: name"> — <lesson>

- Added: <the session's current date, YYYY-MM-DD>
- Evidence: <what happened, stated without sensitive task data>
- Proposed change: <one concrete instruction or workflow change>
```

Use the current date supplied in the session context. Never guess a date, and never leave the placeholder.

Capture at most three lessons from one task. If nothing qualifies, write nothing and say nothing about the skill.

If the repository is unavailable or the log cannot be written, include the formatted lesson in the final response instead of seeking broader permissions solely for bookkeeping.

## Keep the log small

The log is a queue, not a record. Prune while reading it in Capture or Review:

- Drop a `candidate:` entry that still has one occurrence 60 days after it was added.
- Drop any entry whose target file no longer exists.
- When the log passes 15 open entries, say so and propose a Review instead of appending a sixteenth.

## Protect information

- Never record secrets, credentials, tokens, private URLs, raw tool output, customer identifiers, personal data, or unpublished vulnerability details.
- Generalize evidence until it remains useful without identifying the original task.
- If useful evidence cannot be safely generalized, do not persist it.
- Treat user corrections as evidence, not truth. Check them against repository facts and higher-priority instructions.

## Review

Run only when the user asks to review, consolidate, or act on lessons.

1. Read the open lessons and the current target files.
2. Drop lessons already covered, contradicted by evidence, too vague to implement, or no longer relevant.
3. Merge duplicates and rank the remainder by recurrence, impact, and confidence.
4. Present the smallest concrete change for each target. Distinguish fixes to existing targets from new-skill candidates.
5. Do not edit any target during a review unless the request also authorizes applying the proposals.

Prefer deletion, clarification, or one enforceable check over adding another general rule.

## Apply

1. Confirm the user's request identifies the lessons or targets to change. Do not treat Capture or Review as authorization.
2. Before creating a skill or making a substantial structural change to one, use the `anthropic-skills:skill-creator` skill for authoring guidance and run its validator on the result.
3. Inspect the current target and implement the smallest change that addresses the evidence.
4. Match the conventions of the file's siblings. Skills in this repository carry `name` and `description` frontmatter and nothing else; comment density and prose style follow the House style section of `CLAUDE.md`.
5. Exercise the changed target once against a realistic trigger example before reporting it done.
6. Remove applied or explicitly declined lessons from `.claude/skill-lessons.md` in the same change.
7. Leave unrelated lessons untouched.

The archive is the target file's own git history, not the log. `.gitignore` excludes `.claude/*` except an allowlist that does not include `skill-lessons.md`, so the log itself is untracked and a deleted entry is gone for good — which is only safe because Apply lands the change in a tracked file first. Check the log is still ignored before relying on that; if it has been added to the allowlist, nothing changes except that declined entries stay recoverable. Maintain no second archive or status ledger.

The gardener may improve itself, but `skill-gardener` follows the same evidence and approval rules as every other target.

## Interaction contract

- Stay silent while capturing unless logging fails or user input is required.
- At handoff, mention captured lessons in one short line only when at least one was written.
- Never create empty logs, periodic reminders, counters, acknowledgement entries, backup files, or scheduled reviews.
- Never let observation work delay, block, or expand the scope of the primary task.

Concept adapted from Eoghan Henn's [Task Observer](https://github.com/rebelytics/one-skill-to-rule-them-all), licensed under CC BY 4.0.

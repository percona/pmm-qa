# .claude/skills/jira/SKILL.md — resolve X-Actor from get_me before the first relay call, never from the user's email

- Added: 2026-09-11
- Applies to: .claude/skills/jira/SKILL.md and .claude/skills/zephyr/SKILL.md (same relay gate)
- Evidence: The first `/jira/read` call used an actor guessed from the session's user email local-part and returned `403 identity_not_authorized`; the roster-valid actor was the GitHub MCP `get_me` `.login`, which differed from the email.
- Proposed change: In the Operations snippet, make the `get_me` lookup the first step of the relay batch and add an explicit "never derive ACTOR from the user's email, display name, or Jira account" line next to the existing fail-closed check.

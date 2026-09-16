# CLAUDE.md — `.claude/hooks/` holds only harness-invoked hooks; every other script goes in `.claude/scripts/`

- Added: 2026-09-16
- Applies to: all agents and skills
- Evidence: A maintainer questioned a standalone script added under `.claude/hooks/` — "looks like a good fit for scripts as this is meant for stuff that we put under claude hooks" (https://github.com/percona/pmm-qa/pull/1442#discussion_r4027388590) — and the author moved it (https://github.com/percona/pmm-qa/pull/1442#discussion_r4027630844).
- Proposed change: Extend the existing House style hook rule with its placement half — a file belongs under `.claude/hooks/` only when `.claude/settings.json` wires it to a hook event, and anything else belongs under `.claude/scripts/`.

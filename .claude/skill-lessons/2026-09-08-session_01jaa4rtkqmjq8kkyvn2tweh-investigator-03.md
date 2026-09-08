# .claude/agents/investigator.md — an off-peak probe of an external fetch is not evidence about the busy window

- Added: 2026-09-08
- Applies to: target only
- Evidence: the agent's existing "query that URL's current state first" rule was followed and returned 36 MB/s, reproducing the same unsound inference an existing PR had already made from a post-incident measurement; what actually settled the question was a sibling CI job that fetched the same artifact inside the failing window in 64s.
- Proposed change: qualify the external-fetch rule so a current-state probe may only rule an origin in or out for *now*, and require an in-window control — the same step on the same runner type in a sibling run during the failing minutes — before attributing or excluding load as the cause.

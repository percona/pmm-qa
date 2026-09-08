# .claude/skills/jira/SKILL.md — the relay's search response is `{"issues": [...]}`, so an empty dedup result needs the raw payload checked

- Added: 2026-09-08
- Applies to: .claude/skills/jira/SKILL.md
- Evidence: A dedup search piped through `jq -r '.body.issues[]?'` printed nothing for four JQL queries and read as "no tracking ticket exists"; the same call dumped raw showed `{"issues":[{...PMM-14919...}]}` — the skill describes the action as returning "the Jira REST response (status + body)", which invited the wrong path, and `?` swallowed the mismatch silently.
- Proposed change: In the `search` recipe, show the response shape (`.issues[]`, with `.total`) alongside the call, and add that a search returning zero rows is only trusted after the unfiltered payload has been looked at once — a jq path mismatch and a genuinely clean dedup are indistinguishable otherwise.

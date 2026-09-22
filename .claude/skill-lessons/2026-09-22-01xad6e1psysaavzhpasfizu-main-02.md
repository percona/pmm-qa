# .claude/skills/repos/SKILL.md — recurrence: the CCR review-threads shape trap repeated in Python one day later

- Added: 2026-09-22
- Applies to: target only
- Evidence: Recurrence of 2026-09-21-feb9bad6-...-main-05 in a different language, so documenting the field names alone did not prevent it. Filtering the CCR `review_threads` response with `not t.get('is_resolved')` (the GraphQL spelling; the real key is `resolved`) made every absent key falsy, counted all 15 threads as unresolved on a PR where all 15 were resolved, and was one sentence away from being reported to the user as 15 open review threads. `sorted(d[0].keys())` showed the real shape immediately.
- Proposed change: Alongside the recorded field names, state the failure mode generally: a predicate over an absent key fails open and inverts the answer, so index a key that must exist (`t['resolved']`, which raises) rather than `.get()` it, and confirm the shape with `.[0] | keys` before any filter. Recurrence in a second language suggests the rule belongs where any response-parsing code is written, not only next to the route list.

# .claude/skills/zephyr/SKILL.md — say that test-case-to-Jira-issue links are not brokered

- Added: 2026-09-17
- Applies to: .claude/skills/zephyr/SKILL.md
- Evidence: Asked to create test cases and attach them to a Jira ticket, six cases were created and only then did linking turn out to be impossible: the relay answers `unknown_action` for link, links, link-issue, issuelink, traceability, raw and passthrough, and the Zephyr API key is not in the environment. The skill's action table lists what exists but never states that `POST /testcases/{key}/links/issues` is absent, so the gap surfaced after the writes rather than before them.
- Proposed change: In the Operations table's surrounding notes, state that linking a test case to a Jira issue is NOT brokered (upstream `POST /testcases/{testCaseKey}/links/issues`, which takes the Jira issue's numeric id, not its key), and name the fallback: record the keys in the ticket's `How to test` (customfield_10083) and a Developers-only comment, then tell the user the Zephyr traceability panel needs a human.

# .claude/agents/investigator.md — the Jira relay's `text ~` search is fuzzy, so a noisy dedup reads like a clean one

- Added: 2026-09-16
- Applies to: .claude/agents/investigator.md
- Evidence: Step 1's Jira dedup ran `text ~ "ssl_mysql"` through the relay `search` action and got 20 tickets back — Mongo backups, PMM encryption, an nginx `SSL_read` log message — none about the failure under investigation. The term is tokenized, so a single broad query returns a full page whether or not a matching ticket exists, and `total` came back `null` rather than a count.
- Proposed change: In the dedup step, note that the relay's `text ~` is tokenized and returns loosely related tickets, so a full result page is not a hit: run several narrow queries built from the failure's own identifiers (exact spec filename, exact setup-script name, exact error string), and read each summary before treating anything as a tracking ticket or declaring the sweep clean.

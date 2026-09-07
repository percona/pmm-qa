# .claude/agents/investigator.md — a self-contradictory assertion message means read the helper source at its pinned version

- Added: 2026-09-07
- Applies to: .claude/agents/investigator.md
- Evidence: A nightly failure printed `expected url to include https://<host>/&var-replication_set=rs, but found <url>` where the found URL plainly contained `&var-replication_set=rs`, which reads as a 2-second timing flake; CodeceptJS 4.1.0's `waitInUrl` in fact resolves a relative argument against the base URL and searches for that concatenation, so the match could never succeed.
- Proposed change: In step 3's classification rules, add that when a framework's failure message is self-contradictory (the "found" value appears to satisfy the "expected" one), the message is likely the literal comparison and the helper source at the exact pinned version must be read before calling it timing/flake — `curl https://cdn.jsdelivr.net/npm/<pkg>@<version>/<path>` fetches the shipped source without installing, and diffing it against the previously pinned version names the regression window.

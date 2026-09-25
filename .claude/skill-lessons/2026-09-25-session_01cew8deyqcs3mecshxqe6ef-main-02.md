# .claude/agents/investigator.md — An intermittent metric-presence timeout can be transient test data, not test-scope or a product bug

- Added: 2026-09-25
- Applies to: .claude/agents/investigator.md
- Evidence: A postgres upgrade test flakily timed out on pg_stat_user_tables_analyze_count; the historical test tag suggested a client-upgrade scoping fix, but reproduction showed the metric was equally intermittent on both client versions because the data-load loop only created/dropped transient tables, so the per-table view was usually empty.
- Proposed change: For a flaky "metric present" timeout, before blaming test scope/tags or the product, verify the metric's underlying data source persists across scrapes (e.g. a per-table view needs a permanent, analyzed table); fix by seeding persistent data in setup rather than loosening the assertion or widening the timeout.

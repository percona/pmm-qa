# .claude/skills/fb-tests/SKILL.md — Always pass per_page=100 on the run-jobs listing; the default 30 truncates a matrix run

- Added: 2026-09-11
- Applies to: .claude/skills/fb-tests/SKILL.md ("Reading history in bulk")
- Evidence: percona/pmm-qa e2e matrix runs returned 32-37 jobs each (max 37 of 44 runs sampled), so the REST default `per_page=30` silently drops jobs, while an explicit `per_page=100` fit every run on one page and no `page=2` fetch was ever needed.
- Proposed change: In the bulk jobs-listing recipe, state explicitly `actions/runs/<id>/jobs?per_page=100&filter=latest`, note that the default 30 truncates these 32-37 job matrix runs, and keep a `total_count` vs `(.jobs|length)` comparison as the cheap guard rather than a speculative second-page fetch.

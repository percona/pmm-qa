# .claude/skills/repos/SKILL.md — `list_workflow_jobs` truncates at 30 jobs while `total_count` reports more

- Added: 2026-09-11
- Applies to: target only
- Evidence: Searching percona/pmm-qa scheduled `e2e-tests-matrix.yml` runs for a `@pmm-ps-integration` job, `actions_list` → `list_workflow_jobs` returned `{"jobs": {"total_count": 36, "jobs": [...30 items...]}}` with no warning; two runs looked like zero hits and were about to be reported as "the job never runs on schedule" — the job was items 31-36. A `perPage: 100, page: 2` probe returned an empty list (total <= 100), which looks like confirmation of no more data.
- Proposed change: In the "Big listings overflow the result cap" section, note that the default page size is 30 and the returned array is often shorter than `total_count`, so after parsing a spilled listing compare `len(items)` against `total_count` and fetch further pages until they match (or pass `perPage: 100` on page 1); never treat an empty `page: 2` as proof the first page was complete, and remember that `filter: "all"` includes every `run_attempt`, so `total_count` can far exceed the job-matrix size and one logical job can land on a later page.

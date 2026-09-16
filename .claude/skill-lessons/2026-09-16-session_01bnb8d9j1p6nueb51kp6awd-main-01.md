# .claude/skills/repos/SKILL.md — record the spilled JSON shape of each Actions tool, not just "parse the saved file"

- Added: 2026-09-16
- Applies to: .claude/skills/repos/SKILL.md
- Evidence: Following the existing spill-and-parse guidance, `json.load(f)['jobs']` on a spilled `list_workflow_jobs` result raised `TypeError: string indices must be integers` — the job array sits one level deeper, at `['jobs']['jobs']` beside `total_count` — costing a failed call plus an extra round trip just to print the shape; a spilled `get_job_logs` is `{"logs_content": "..."}` whose newlines are literal `\n` and must be expanded before grepping.
- Proposed change: In the "Big listings overflow the result cap" section, name the two spilled shapes — `list_workflow_jobs` → `d['jobs']['jobs']`, `get_job_logs` → `d['logs_content']` with `\n` escapes to expand — so the first parse of a spilled result works.

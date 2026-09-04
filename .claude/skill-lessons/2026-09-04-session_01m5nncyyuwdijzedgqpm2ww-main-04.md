# .claude/skills/fb-tests/SKILL.md — bulk-reading FB Tests history through the proxy needs manual paging and date windows

- Added: 2026-09-04
- Applies to: .claude/skills/fb-tests/SKILL.md
- Evidence: Pulling a year of "FB Tests" workflow runs from Percona-Lab/pmm-submodules with `gh api --paginate` failed with HTTP 403 because the Link headers point at `repositories/{id}/...` URLs the proxy refuses, and a manual `page=N` loop then stopped at 1000 results, the REST cap for a run listing; splitting the request by `created=YYYY-MM-DD..YYYY-MM-DD` windows and paging each window recovered all 1816 runs, and fetching per-run jobs one at a time took ~4 s each until run through `xargs -P 10`.
- Proposed change: Add a short "Reading history in bulk" note: page with explicit `page=N` (never `--paginate`), window `created=` ranges so no listing exceeds 1000, and parallelise per-run `actions/runs/<id>/jobs?filter=latest` calls; also note that `gh api --jq` takes no `--arg`, so add fields like the run id in a second jq pass.

# .claude/skills/qa-code-review/SKILL.md — Grafana table panels need a "contains data" check, not per-cell non-empty

- Added: 2026-09-23
- Applies to: PMM dashboard e2e tests (e2e_tests/components/dashboards/panels/*)
- Evidence: A sharded-cluster dashboard test failed with "Panel: Size/Count of Collections in Shards has empty values!" although the tables were fully populated — the assertion required every gridcell non-empty and tripped on the Grafana "Total" footer row, whose non-aggregated label columns (DB/Collection Name) are legitimately blank.
- Proposed change: When reviewing/authoring a dashboard table-data assertion, require the table to contain data (>=1 non-empty value cell), not every cell; reserve strict per-value checks for non-table panels; rely on verifyAllPanelsHaveData for the "No data" case.

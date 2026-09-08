# candidate: jenkins-builds — never extend a verified ID range by numeric adjacency

- Added: 2026-09-08
- Applies to: all agents that attribute CI runs, builds or queue items to a parent run
- Evidence: eight GitHub Actions workflow runs were verified as belonging to a Jenkins parent by reading their `created_at`, and two numerically adjacent runs immediately below that range were then attributed to the same parent without being read; a derived headline figure (total bytes fetched inside a 15-minute window) was reported to the user as verified on that basis. The two runs had been created eight hours earlier by a different parent, overstating the figure by a quarter.
- Proposed change: state that consecutive run, build or queue numbers do not imply a common trigger — every item attributed to a parent must have its own `created_at`/`timestamp` (or `get_build_parameters`) read — and that a figure aggregated over a set may not be quoted until every member of the set, boundaries included, has been individually confirmed.

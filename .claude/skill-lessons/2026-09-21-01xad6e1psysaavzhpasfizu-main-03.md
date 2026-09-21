# .claude/skills/qa-code-review/SKILL.md — a bug claim against green CI must carry its own non-coverage proof

- Added: 2026-09-21
- Applies to: all skills and agents that report a defect in a repository whose CI is passing
- Evidence: A real per-node loop defect in an Ansible task was reported as "a live bug" with only the assertion that "the nightly only runs single-node MySQL"; the author pushed back with "se é um bug, pq nao falhou nada?", and the answer required tracing that every `--database mysql` invocation in CI omits SETUP_TYPE, that nodes_count then stays 1, and that the GR/replication lanes use a different playbook entirely.
- Proposed change: When reporting a defect that CI did not catch, state in the same message which invocations reach the code path and which parameter value keeps the defect unreachable, citing the file and line of each — never offer "CI does not cover it" as a bare assertion.

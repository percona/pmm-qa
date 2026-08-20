# Parallelization Ledger

Candidates for overlapping migration workflow steps, with the evidence gathered so far.

Owned by this skill. `skill-gardener` reads this file and updates verdicts from timeline evidence;
it does not create it and keeps no equivalent of its own. A parallelization observation updates a
row here instead of opening a lesson in `.claude/skill-lessons.md`, and becomes a lesson only once
its evidence supports a verdict.

Evidence comes from `.claude/migration-observations/<row>-<slug>.md`, written by the migration
agents. A candidate needs timing data from at least two migrations before moving off
`needs-evidence`.

Status values: `implemented` | `safe` | `unsafe` | `needs-evidence`.

| Candidate | Status | Constraint | Evidence |
| --- | --- | --- | --- |
| Provisioning concurrent with the writer | implemented | Env bucket must be confirmed from the source `Before`/`BeforeSuite` and `Data(...)` hooks before the background start; a writer-derived setup that contradicts it forces a teardown and re-provision | Provisioning is the long pole; the bucket is known at step 1. Record the saving and any re-provision on the timeline. Row 3: provision 6m (4 engines + haproxy) fully hidden inside a 21m writer phase, 0 re-provisions, writer-derived setup matched the parent-confirmed bucket exactly. Second data point still needed for a bucket where provisioning outlasts the writer. |
| Static review while PMM provisions | implemented | Completeness review needs no live environment; MCP locator checks still wait for readyz | Present in `run.md` since before the ledger. |
| Source and target graph refresh in parallel | needs-evidence | Two `graphify . --update` runs from different roots; unknown disk and CPU contention | None yet. Needs refresh durations, serial and overlapped. |
| Reviewer completeness read vs MCP locator checks | needs-evidence | Both are reviewer work in one subagent; splitting them means two agents sharing one review verdict | None yet. Needs the reviewer phase split by activity on the timeline. |
| Env reuse across consecutive same-bucket tracker rows | needs-evidence | Conflicts with the step 8 teardown invariant. The tracker already orders rows so consecutive rows share a bucket, so the saving is a full provision cycle per row. Risk is state leaking between migrations. | None yet. Needs provision duration and any evidence of cross-row state contamination. |
| Two migrations concurrently | unsafe | One control worktree, one Docker environment with fixed resource names (`pmm-server`, `client_container`, `pmm-data`, the `pmm-qa` network), one tracker file. Would need separate worktrees and distinct container names and ports. | Ruled out by design, not by measurement. Revisit only if the provisioner gains per-run resource naming. |

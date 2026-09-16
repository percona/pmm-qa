# Parallelization Ledger

Candidates for overlapping migration workflow steps, with the evidence gathered so far. `orchestration.md` permits only overlaps recorded here as `implemented`.

Evidence comes from `.claude/migration-observations/<row>-<slug>.md`. A candidate needs timing data from at least two migrations before moving off `needs-evidence`. `skill-gardener` updates verdicts here from that evidence; a parallelization observation updates a row instead of opening a lesson entry, and any resulting lesson stays on the control branch in `.claude/skill-lessons-migration/`.

Status values: `implemented` | `safe` | `unsafe` | `needs-evidence`.

| Candidate | Status | Constraint | Evidence |
| --- | --- | --- | --- |
| Provisioning concurrent with the writer | implemented | Env bucket confirmed from the source `Before`/`BeforeSuite` and `Data(...)` hooks before the background start; a writer-derived setup that contradicts it forces a teardown and re-provision | Row 3: provision 6m (4 engines + haproxy) fully hidden inside a 21m writer phase, 0 re-provisions, writer-derived setup matched the confirmed bucket. Second data point still needed for a bucket where provisioning outlasts the writer. |
| Static review while PMM provisions | implemented | Completeness review needs no live environment; MCP locator checks wait for readyz | Present in the workflow since before the ledger. |
| Reviewer completeness read vs MCP locator checks | needs-evidence | Both are reviewer work in one subagent; splitting them means two agents sharing one review verdict | None yet. Needs the reviewer phase split by activity on the timeline. |
| Env reuse across consecutive same-setup tracker rows | investigated, not pursued | Provisioning is not the saving (row 3: 6m hidden inside a 21m writer). The saving is the per-row fixed cost, final gate, publish phase, one PR's review, amortised over k rows. Risks: state leaking between rows and shared-path entanglement, so any trial needs an explicit state reset per row and must not batch rows that edit the same region of a shared file | None yet. Batching is not defined in the workflow; its first use must be an explicitly designated trial recording per-row phase timings and any cross-row contamination. Two such trials move this row to `implemented` or `unsafe`. |
| Two migrations concurrently | unsafe | One control worktree, one Docker environment with fixed resource names (`pmm-server`, `client_container`, `pmm-data`, the `pmm-qa` network), one tracker file | Ruled out by design. Revisit only if the provisioner gains per-run resource naming. |

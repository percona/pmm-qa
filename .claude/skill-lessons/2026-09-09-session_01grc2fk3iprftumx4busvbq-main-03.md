# .claude/agents/investigator.md — nightly fires as a batch, one run per client version; read the siblings as the control group

- Added: 2026-09-09
- Applies to: .claude/agents/investigator.md
- Evidence: The 2026-09-09 nightly dispatcher fired nine runs minutes apart, one per `pmm_client_version` (3-dev-latest, 3.7.1, 3.8.1, 3.9.0, ...), each against its own PMM Server IP; reading three siblings' failure lists together showed the same four tests failing on every version and ruled out a version-specific cause in one step.
- Proposed change: Extend the nightly paragraph's "compare against the same deployment type" rule — also read the other runs of the same dispatch batch, since they vary only by client version and act as a ready-made control group, and compare against the last run *before* the batch for a before/after.

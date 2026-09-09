# .claude/skills/linode-docker-provisioning/SKILL.md — stream a long wait's progress to the scratchpad, not only to the task's output

- Added: 2026-09-09
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: A container restart killed two long-running background waits ("Wait for psmdb setup to reach a terminal marker", "Wait for pmm-framework to finish"); each task's output file contained only `[killed]`, so nothing at all was recovered about how far the setup had got, while the scratchpad directory and its files survived the restart intact.
- Proposed change: In the run/wait steps, have the long wait tee its progress to a scratchpad log (`… |& tee -a "$SCRATCH/pmm-framework.log"`) so a restart or timeout leaves a readable trace, and check that log before re-provisioning.

# .claude/skills/linode-docker-provisioning/SKILL.md — a run_id collides with an earlier investigation of the same PR

- Added: 2026-09-02
- Applies to: target only
- Evidence: Provisioning with the documented Investigator run_id `heal-<submodules-pr>` returned `502` with `run_id 'heal-4543' already has a state file ... pick a unique run_id, or down.sh it first` — an earlier investigation of the same PR had left relay state behind, and destroying it to reuse the name would have torn down whatever VM it still tracked.
- Proposed change: In "Pick a run_id", note that the `heal-<pr>` / `nightly-<workflow>-<date>` forms repeat across investigations, so a `502 provision_failed` naming an existing state file means picking a distinct suffix (e.g. `heal-<pr>-<test>`) rather than destroying that run, and reporting the orphaned state in the run summary.

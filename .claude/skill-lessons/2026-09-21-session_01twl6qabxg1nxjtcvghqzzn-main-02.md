# .claude/skills/qa-code-review/SKILL.md — an evidence demand must name the run to dispatch, not the shape of an environment

- Added: 2026-09-21
- Applies to: target only
- Evidence: A finding on a hardcoded panel allowlist asked the author to "cite a run of these three tests on a nightly-shaped environment — DB shards provisioned, not server-only". The author answered with a hand-provisioned DB-backed server and reported the lists unchanged; the human reviewer still replied "I think this one deserves a nightly run to confirm pointing it to this branch" (https://github.com/percona/pmm-qa/pull/1450#discussion_r4063560935).
- Proposed change: In section 6's "measure this first" case, require the thread to name the run that would settle it — the workflow to dispatch and the branch to point it at — rather than an environment shape that an ad-hoc provision can appear to satisfy.

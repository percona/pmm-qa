# .claude/skills/qa-code-review/SKILL.md — "it is a port" does not defer a duplication finding

- Added: 2026-09-11
- Applies to: target only
- Evidence: a check 7 finding on a triplicated test prologue was declined as out of scope because the migration's instructions require preserving the CodeceptJS source's behaviour and forbid improving on it while porting. The reviewer rejected the deferral in one line — "preserving behavior doesn't require preserving duplication. keep the execution order and state handoff unchanged" (https://github.com/percona/pmm-qa/pull/1411#discussion_r3989133268) — and the author then applied it, confirming the two had been conflated (https://github.com/percona/pmm-qa/pull/1411#discussion_r3989206640).
- Proposed change: state in check 7 that a behaviour-preserving port constrains execution order and state handoff, not code shape, so hold a duplication finding when the author defers it as porting fidelity.

# .claude/skills/qa-code-review/SKILL.md — validate a new CI guard against the legitimate-empty case, not only the failure case

- Added: 2026-09-05
- Applies to: target only
- Evidence: A guard added to two pmm-qa runner workflows failed the job when `tests/output/result.xml` was missing **or** held zero `<testcase>` entries. It was exercised against three synthetic inputs and called validated. The user asked "but launchable may want to run 0 tests.. I think it's valid, no?" — measuring both cases showed a harness crash writes no report at all, while a run whose `--grep` matches nothing writes a 65-byte report with zero testcases and exits 0, so the zero-testcase branch would have turned valid runs red. The `has_subset` skip did not cover it: that gate only tests whether the Launchable subset file is non-empty before the run.
- Proposed change: When reviewing a workflow step that fails a job on a missing or empty artifact, require that the diff distinguish the broken-tooling signature from a legitimate zero-work run by measuring each, and reject a guard validated only against synthetic inputs.

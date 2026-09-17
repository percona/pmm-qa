# .claude/skills/fb-tests/SKILL.md — a tailed job log shows the cleanup epilogue, never the test results

- Added: 2026-09-17
- Applies to: .claude/skills/fb-tests/SKILL.md ("Reading history in bulk", the job-log fetch recipe)
- Evidence: `get_job_logs` with `tail_lines: 120` on a failed Playwright e2e job returned only the artifact-upload table, the `actions/upload-artifact` env dump and the git credential cleanup — no test line at all — because a Playwright job's epilogue is longer than any sane tail. The full fetch (`gh api --allow-escape-sequences .../logs`, 248 KB) grepped for `✘|passed|failed|Error:` found the verdict immediately, at lines 2415-2522 of 2776.
- Proposed change: Note in the job-log recipe that `tail_lines` is for identifying *which* job failed, never for reading a test verdict — the log ends in artifact upload and runner cleanup — and that the pass/fail tally and failing spec names come from fetching the whole log to a file and grepping it.

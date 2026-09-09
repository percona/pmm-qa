# .claude/skills/verification-depth/SKILL.md — task order plus absent `ignore_errors` proves the earlier tasks passed

- Added: 2026-09-09
- Applies to: .claude/skills/verification-depth/SKILL.md
- Evidence: A CI leg was killed mid-play after entering a task at line 157 of the playbook; showing that the changed task at line 101 had run would have meant pulling thousands of log lines, but `grep -c ignore_errors` on the exact revision that ran returned 0, so reaching the later task was itself proof every earlier task succeeded.
- Proposed change: Record that in an Ansible-driven run, task ordering plus a verified absence of `ignore_errors`/`failed_when` on the revision that ran is sufficient evidence that every task before the observed one succeeded, and is preferable to fetching the log region.

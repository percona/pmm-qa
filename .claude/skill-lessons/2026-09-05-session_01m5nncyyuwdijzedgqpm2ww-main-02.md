# .claude/skills/fb-tests/SKILL.md — `gh api .../actions/jobs/<id>/logs` needs `--allow-escape-sequences` or it yields an empty file

- Added: 2026-09-05
- Applies to: .claude/skills/fb-tests/SKILL.md; .claude/agents/investigator.md
- Evidence: Redirecting `gh api repos/Percona-Lab/pmm-submodules/actions/jobs/<id>/logs` to a file produced 0 bytes twice; the only hint was a stderr line saying the response contains terminal escape sequences, while the GitHub MCP `get_job_logs` tail showed only artifact-upload cleanup.
- Proposed change: In the log-reading recipe, run `gh api --allow-escape-sequences .../jobs/<id>/logs | sed 's/\x1b\[[0-9;]*m//g' > log.txt` and grep it for `✘`, `.failed.png` and `FAILED` to name the failing test.

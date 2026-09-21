# CLAUDE.md — Harness backgrounding and `nohup ... &` must not be combined

- Added: 2026-09-21
- Applies to: all skills
- Evidence: A remote multi-step command (clone, bootstrap, `docker compose up`) was wrapped in `nohup ... &` inside a Bash call that already set `run_in_background`. The call returned "started" with exit code 0 and the harness reported the task completed, but only the first step had run; both the redirected log file and the task output file were empty, which reads as success rather than truncation.
- Proposed change: In the House style section, state that a command given to the Bash tool with `run_in_background` must not also be backgrounded with `nohup`/`&` — the harness backgrounds it and delivers a completion notification, while an inner `&` detaches the work and makes the wrapper exit immediately; reserve `nohup`/`&` for calls that do not use harness backgrounding, and treat an empty output file on a "completed" background task as evidence the work was orphaned, not that it succeeded quietly.

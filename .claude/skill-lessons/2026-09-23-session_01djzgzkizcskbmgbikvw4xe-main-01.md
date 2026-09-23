# CLAUDE.md — A readiness poll must test the failure state before the success marker

- Added: 2026-09-23
- Applies to: all skills
- Evidence: A wait loop polled two containers for a log marker and, in the same iteration, checked container status. It evaluated the success condition first, so a container that printed the marker and then exited 1 was reported as "BOTH SEEDED"; the exit was only noticed on a later manual inspection. The success marker was genuinely present, so the log grep alone could never have caught it.
- Proposed change: In the House style section, require a readiness or completion poll to evaluate terminal-failure conditions (container Exited/Restarting, process gone, non-zero rc) before the success condition in each iteration, and to treat a success marker as valid only when the producing process is still in the expected state.

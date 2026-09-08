# candidate: jenkins-builds — the stage API reports still-running parallel branches as SUCCESS

- Added: 2026-09-08
- Applies to: all agents that read Jenkins build results (investigator, test-runner, fb-reporter)
- Evidence: `get_build_stages` on an IN_PROGRESS build returned `"status":"SUCCESS"` for six parallel branches that `get_build_history` on the downstream job showed as `"building":true,"duration":0`; their reported stage durations were 723ms and five negative values, and an upstream brief had already been written treating those six as passes.
- Proposed change: require that when a build is IN_PROGRESS, every branch verdict be confirmed against the downstream job's `get_build_history` (`building:true`) or the parent's own console echo lines, and state that a near-zero or negative stage duration means the stage graph is unreliable, not that the stage was fast.

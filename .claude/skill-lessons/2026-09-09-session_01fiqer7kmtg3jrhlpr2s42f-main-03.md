# .claude/skills/linode-docker-provisioning/SKILL.md — Grafana's brute-force lockout clears itself in ~5 minutes of silence, so waiting beats recreating the server

- Added: 2026-09-09
- Applies to: target only
- Evidence: After an agent registration failed on "Invalid username or password", re-running `change-admin-password` and re-probing auth returned 401 each time, with `grafana.log` showing `password-auth.failed] too many consecutive incorrect login attempts for user - login for user temporarily blocked` — so a correct password still read as wrong. One `sleep 330` followed by a single check returned 200 with no server rebuild. Separately, `change-admin-password` was invoked as `| tail -2`, which swallowed its "Admin password changed successfully" line and left no way to tell whether the change had applied.
- Proposed change: In step 2, record that the lockout is time-based and self-clearing — stop issuing auth requests entirely for ~5 minutes, then check once — as the first recovery, ahead of recreating the server on a fresh volume; and never pipe `change-admin-password` through `tail`/`head`, since its success line is the only confirmation the change landed.

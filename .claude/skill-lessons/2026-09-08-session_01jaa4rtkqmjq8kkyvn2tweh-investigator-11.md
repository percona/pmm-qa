# .claude/skills/linode-docker-provisioning/SKILL.md — Take the PMM admin credential from the pipeline being reproduced

- Added: 2026-09-08
- Applies to: target only
- Evidence: The documented `GF_SECURITY_ADMIN_PASSWORD` with a generated password left a released pmm-server image rejecting both that password and the default, agent registration failed on "Invalid username or password", and the repeated attempts tripped Grafana's brute-force lockout, which then masked the real auth state on every later probe; the CI job being reproduced sets the admin password to `admin`.
- Proposed change: In step 2, tell agents to reproduce the credential the pipeline under investigation sets before generating one, and to recreate the server on a fresh volume once Grafana reports a brute-force lockout, since the lockout invalidates further auth evidence.

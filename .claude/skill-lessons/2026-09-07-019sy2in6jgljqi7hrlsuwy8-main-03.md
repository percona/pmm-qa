# .claude/skills/linode-docker-provisioning/SKILL.md — absolute paths for local files read into a run.sh command, not just for run.sh itself

- Added: 2026-09-07
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: `ADMIN_PASSWORD="$(cat terraform/linode-runner/runs/<id>/admin_password)"` in a `run.sh` invocation resolved against the harness's reset working directory, silently produced an empty value, and the remote suite ran a full 40 s scenario before failing on "Invalid username or password".
- Proposed change: Extend the "Absolute path, always" rule in "Calling `run.sh`" to cover every local file read whose value is interpolated into the remote command (`admin_password`, `ip`, `pmm_cert.pem`), and note that the failure mode is an empty interpolation rather than an error.

# .claude/skills/linode-docker-provisioning/SKILL.md — pkill -f over the exec channel matches run.sh's own wrapper and kills the caller's shell

- Added: 2026-09-02
- Applies to: target only
- Evidence: `pkill -f codeceptjs` sent through `run.sh` matched the exec-server's own `bash -c "... codeceptjs run ..."` wrapper, killed the calling remote shell (exit 241), and left the intended orphan process alive.
- Proposed change: warn that a `pkill -f` pattern also matches the exec-server's wrapper for the very command carrying it, and to kill by explicit PID or a self-excluding pattern (`'codecept[j]s'`) instead.

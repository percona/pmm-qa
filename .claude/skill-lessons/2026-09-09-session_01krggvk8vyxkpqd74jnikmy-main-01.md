# .claude/skills/linode-docker-provisioning/SKILL.md — the skill's own detached-launch recipe still blocks; `nohup … &` does not release the exec-server's stdout pipe

- Added: 2026-09-09
- Applies to: target only
- Evidence: Step "Anything longer than ~10 minutes runs detached" prescribes `run.sh <run_id> -- "cd <dir> && nohup bash -c '<command>; …' >/root/<name>.log 2>&1 & echo $!"`. Run verbatim to start `pmm-framework --database ps`, the call did not return: it was still running at the 120s tool timeout and the harness moved it to the background, even though the setup had started on the box and later finished cleanly. Backgrounding the local `run.sh` invocation as well returned immediately, but leaves the remote process still holding the pipe.
- Proposed change: Replace `nohup … &` in that recipe with an fd-detached launch (`setsid bash -c '<command>; echo DONE_MARKER=$? >>/root/<name>.log' >/root/<name>.log 2>&1 </dev/null &`) so the exec-server sees EOF and `run.sh` returns, and state that `nohup … &` alone is not enough because the grandchild inherits the captured stdout pipe.

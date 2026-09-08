# .claude/agents/investigator.md — the loaded-repro recipe needs its file descriptors detached to survive run.sh

- Added: 2026-09-08
- Applies to: .claude/agents/investigator.md
- Evidence: The prescribed load recipe `for n in $(seq 12); do (while :; do :; done) & done`, run verbatim through `run.sh`, killed the call with `curl: (52) Empty reply from server` / "failed to reach exec-server" — the busy-loop grandchildren inherit the exec-server's captured stdout pipe, so it never sees EOF — even though both the load and the setup under test had in fact started on the box.
- Proposed change: Write the load recipe with its fds detached (`for n in $(seq 12); do setsid bash -c 'while :; do :; done' >/dev/null 2>&1 </dev/null & done`) and note that after such a dropped call the box's state must be inspected before relaunching, since the work is already running and a second launch would double-start it.

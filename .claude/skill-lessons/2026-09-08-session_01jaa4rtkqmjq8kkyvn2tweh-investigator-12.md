# .claude/skills/linode-docker-provisioning/SKILL.md — A long job started through run.sh dies with the wrapper call; detach it and poll a marker it writes itself

- Added: 2026-09-08
- Applies to: target only
- Evidence: `pmm-framework` was launched as a plain foreground command inside one `run.sh` call; the call was moved to the background and later reported "completed exit code 0", but the remote setup was left half-finished — its log ended mid-mongo-shell and the mongodb services were never registered, while a second attempt in the same shape was cut off at "exporting layers". A later `run.sh` that wrote its log via a shell redirect on the same line as a `&` background launch produced no log file at all.
- Proposed change: In step 3, state that a setup outliving one `run.sh` round trip must be written to a script file on the box and launched detached (`: > /root/go.log; setsid /root/go.sh >> /root/go.log 2>&1 </dev/null &`), with the script ending in a self-written completion marker (`echo "EXIT=$?"`), and that progress is then polled by a separate `run.sh` call grepping that marker — never by the wrapper's own exit code, which reports only the round trip.

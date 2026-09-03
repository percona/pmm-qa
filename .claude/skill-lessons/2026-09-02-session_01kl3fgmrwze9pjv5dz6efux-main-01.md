# .claude/skills/linode-docker-provisioning/SKILL.md — a remote command outliving run.sh's 620s cap leaves an orphan that corrupts the next run

- Added: 2026-09-02
- Applies to: target only
- Evidence: a ~23-minute test suite invoked directly through `run.sh` failed with "failed to reach exec-server" at the client's 620s curl timeout while the remote process kept running; a second run started against the same PMM Server then shared it with the orphan, and both suites' setup hooks destroyed each other's fixtures, producing a worthless baseline.
- Proposed change: tell readers to launch anything that may exceed ~10 minutes detached on the box (`nohup <script> >logfile 2>&1 &`) and poll the log, and to check for and kill an orphan from a previously timed-out attempt before starting a new run.

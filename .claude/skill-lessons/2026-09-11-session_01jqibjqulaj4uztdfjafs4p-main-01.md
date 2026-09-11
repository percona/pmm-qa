# .claude/skills/linode-docker-provisioning/SKILL.md — two concurrent run.sh calls to one VM kill each other

- Added: 2026-09-11
- Applies to: target only
- Evidence: three times in one session, a second `run.sh <run_id> -- …` issued while a long backgrounded poll loop was still in flight died with `curl: (52) Empty reply from server` or `curl: (56) Recv failure: Connection reset by peer` plus `run.sh: failed to reach exec-server`; the detached remote job was unaffected and its log showed it had kept running, so the symptom reads as a dead box when it is exec-server contention (same symptom as the existing nested-quoting entry, different cause).
- Proposed change: in "Calling run.sh", state that only one run.sh may be in flight per run_id — while a detached job is being polled, let that single poll loop reach its sentinel or kill it before issuing another exec call, and read "Empty reply from server" with another call in flight as contention rather than a lost VM.

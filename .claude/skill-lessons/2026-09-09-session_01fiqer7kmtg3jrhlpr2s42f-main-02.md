# .claude/skills/linode-docker-provisioning/SKILL.md — nested quoting in an inline run.sh string also produces "Empty reply from server"

- Added: 2026-09-09
- Applies to: target only
- Evidence: Two `run.sh` calls carrying an `until code=$(curl ...); do ... done` loop with escaped `$` inside nested single and double quotes both died with `curl: (52) Empty reply from server` / `run.sh: failed to reach exec-server` on an idle box with no in-command `sleep` — while `run.sh <id> -- "echo hello"` succeeded immediately afterwards. Writing the same script locally and shipping it as `echo <base64> | base64 -d > /root/x.sh; chmod +x /root/x.sh` then invoking `/root/x.sh` worked first time.
- Proposed change: In "Calling `run.sh`", say that anything containing a loop or more than one level of quoting goes over as a base64'd script file rather than an inline string, and list nested quoting alongside a long in-command `sleep` as a cause of "Empty reply from server" — the symptom does not mean the VM or the remote job died.

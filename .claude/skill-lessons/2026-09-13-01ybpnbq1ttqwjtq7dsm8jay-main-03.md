# .claude/skills/linode-docker-provisioning/SKILL.md — a multi-arm run on the box must assert each arm's identity

- Added: 2026-09-13
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: An A/B script on the VM used `git fetch origin <branch>` then `git checkout origin/<branch>`; the plain fetch created no remote-tracking ref, so the checkout failed with `pathspec ... did not match` mid-log and the "fixed" arm silently ran baseline code for a full run. It was caught only because the script also echoed the resolved short sha and a `grep -c` of the changed symbol, which read `f4f1cbc` and `0`.
- Proposed change: Where the skill covers pointing the box at a branch, prescribe `git fetch origin <branch> && git checkout FETCH_HEAD` rather than `origin/<branch>`, and require any comparison run to print the resolved commit sha plus a grep for the changed symbol per arm — a checkout error scrolls past in a long detached log and an arm running the wrong code yields a confidently wrong result.

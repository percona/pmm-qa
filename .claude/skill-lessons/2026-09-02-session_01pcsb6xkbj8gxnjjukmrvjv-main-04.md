# .claude/skills/linode-docker-provisioning/SKILL.md — call run.sh by absolute path

- Added: 2026-09-02
- Applies to: target only
- Evidence: Two `run.sh` invocations died with `/bin/bash: line 39: terraform/linode-runner/run.sh: No such file or directory` because the same compound command had first `cd`-ed into the scratchpad to write a reproduction script; the documented examples all use the repo-relative path.
- Proposed change: State in "Accessing the VM" that `run.sh`/`sync.sh`/`extend.sh` must be invoked by absolute path (`/workspace/pmm-qa/terraform/linode-runner/run.sh`), since any command that writes a script elsewhere first leaves the working directory outside the repo.

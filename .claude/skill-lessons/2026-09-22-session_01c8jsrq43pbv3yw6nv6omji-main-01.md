# .claude/skills/linode-docker-provisioning/SKILL.md — the VM ships no Node.js, so a JS suite's first detached run dies on `npm: command not found`

- Added: 2026-09-22
- Applies to: target only
- Evidence: A detached reproduction of a `codeceptjs-e2e` scenario aborted at its first line with `/root/repro.sh: line 7: npm: command not found`; the whole ship-detach-poll cycle had to be repeated after installing Node from NodeSource. The skill's section 4 says to "install Node and the suite on the box" but nothing states that Node is absent, so the gap only surfaces as a failed run.
- Proposed change: In section 4, say plainly that the image carries Docker and Ansible but no Node.js, and give the one-liner (`curl -fsSL https://deb.nodesource.com/setup_24.x -o /root/ns.sh && bash /root/ns.sh && apt-get install -y nodejs`) as a prerequisite step before any `npm ci` / `npx playwright` on the box.

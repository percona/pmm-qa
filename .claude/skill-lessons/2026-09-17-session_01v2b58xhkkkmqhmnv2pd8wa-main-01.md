# .claude/skills/linode-docker-provisioning/SKILL.md — --pmm-server-ip forces framework port 443, breaking a co-located PMM Server

- Added: 2026-09-17
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: A framework run passed --pmm-server-ip pmm-server for a pmm-server container on the same VM; every mongo replicaset registered but the run died at the end with "Failed to register pmm-agent on PMM Server: Post https://pmm-server:443/... connect: connection refused" — lib/docker.sh sets PMM_SERVER_PORT=443 for an explicit --pmm-server-ip, while the co-located container listens on 8443. Omitting the flag let Docker discovery use 8443 and the run passed.
- Proposed change: In step 3 (Databases), steer the single-VM Docker case to OMIT --pmm-server-ip so Docker discovery reaches the container by name on 8443; note that an explicit --pmm-server-ip is for an external/remote server and pins port 443.

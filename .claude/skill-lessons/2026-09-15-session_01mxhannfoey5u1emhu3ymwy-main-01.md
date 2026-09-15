# .claude/skills/linode-docker-provisioning/SKILL.md — pmm-framework client registration targets server port 443

- Added: 2026-09-15
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: PMM Server started with `-p 8443:8443`; qa-integration pmm-framework `--pmm-server-ip pmm-server` failed to register a client with `Post "https://pmm-server:443/...": connection refused` — the PMM3 server container listens only on 8443/8080 internally and embedded DNS resolves `pmm-server` to the container IP, so host publishing does not help container-to-container.
- Proposed change: In step 3, note that pmm-framework Docker discovery targets port 443; register clients either by publishing the server as `-p 443:8443 -p 80:8080` so `pmm-server:443` is reachable, or by configuring pmm-agent directly: `docker exec <client> pmm-admin config --server-url="https://admin:<enc-pw>@pmm-server:8443" --server-insecure-tls --force <container-ip> generic <node-name>`.

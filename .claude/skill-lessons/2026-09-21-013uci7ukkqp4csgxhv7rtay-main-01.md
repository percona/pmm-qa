# .claude/skills/linode-docker-provisioning/SKILL.md — `--pmm-server-ip` forces port 443, which step 2's server does not listen on

- Added: 2026-09-21
- Applies to: target only
- Evidence: Step 3's `--pmm-server-ip pmm-server` killed a `--database psmdb,SETUP_TYPE=pss` setup after ~15 min of container builds with `Failed to register pmm-agent on PMM Server: Post "https://pmm-server:443/v1/management/nodes": ... connection refused`; `lib/docker.sh resolve_pmm_server()` pins `PMM_SERVER_PORT=443` whenever that flag is given and only uses 8443 when it auto-discovers the container, while step 2 starts the server on 8443. Omitting the flag let the identical command succeed.
- Proposed change: In step 3, omit `--pmm-server-ip` when PMM Server is the container step 2 started on this box (the framework discovers it and uses 8443); reserve the flag for a genuinely remote server listening on 443, naming `resolve_pmm_server()` as the reason and psmdb's "connection refused on :443" registration failure as the symptom.

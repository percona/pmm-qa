# .claude/skills/linode-docker-provisioning/SKILL.md — URL-encode the generated admin password in pmm-admin server-url

- Added: 2026-09-15
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: The per-run password from `openssl rand -base64 18` (step 2) contained `/`, and `pmm-admin config --server-url="https://admin:<pw>@pmm-server:8443"` failed with `parse ...: invalid port ":<pw-tail>" after host` because `/` and `+` were parsed as URL delimiters.
- Proposed change: When embedding the admin password in any `--server-url`, URL-encode it first (e.g. `python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$PW"`); note this beside the change-admin-password guidance in step 2.

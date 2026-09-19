# .claude/skills/linode-docker-provisioning/SKILL.md — the proxied session-side Playwright recipe does not carry a Grafana dashboard page

- Added: 2026-09-19
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: With `use.proxy.server` set to `$HTTPS_PROXY`, login and inventory API calls succeeded, but `page.goto` of `/graph/d/<dashboard>` hit the 10 s navigation timeout and the iframe rendered the proxy's own "upstream request failed"; the same spec passed unchanged once run on the VM (Node 22, `npm ci`, `npx playwright install-deps && npx playwright install chromium`).
- Proposed change: In section 4, scope the scratch-config recipe to API-only and light-page specs, and send any dashboard UI spec to the VM with the Node/Playwright setup steps spelled out next to it.

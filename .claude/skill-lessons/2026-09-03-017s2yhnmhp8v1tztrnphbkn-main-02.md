# .claude/skills/linode-docker-provisioning/SKILL.md — TLS pinning guidance may not survive the session's re-signing proxy

- Added: 2026-09-03
- Applies to: target only
- Evidence: The skill tells the reader to pin PMM's cert via `PMM_CERT_PATH` and Chromium's `--ignore-certificate-errors-spki-list` "instead of a blanket trust anything". In this session the egress proxy terminates and re-signs TLS: a pin taken from a public host's genuine leaf via `openssl s_client -proxy` was rejected by `curl --pinnedpubkey` against that same host, so the certificate a client observes is the proxy's, not the origin's. Whether Chromium's SPKI flag behaves the same against a run's `.nip.io` PMM was not tested — no VM was provisioned.
- Proposed change: Verify the `PMM_CERT_PATH` pin actually holds from a session behind the proxy; if it does not, say so and state the real trust boundary (the proxy and the exec channel) rather than implying the leaf is pinned end-to-end.

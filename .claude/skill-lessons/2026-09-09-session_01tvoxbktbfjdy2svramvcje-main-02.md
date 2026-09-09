# .claude/skills/verification-depth/SKILL.md — measure a reproduction through the endpoint the failing test reads, not a convenient sibling

- Added: 2026-09-09
- Applies to: target only
- Evidence: reproducing PMM-T554 against `/v1/inventory/agents` reported 13 of 13 pmm-agents disconnected on a demonstrably healthy setup, because that listing returns `is_connected` and `version` as null; the test actually reads `/v1/management/services` (via `codeceptjs-e2e/tests/pages/api/inventoryAPI.js`), which populates `agents[].is_connected`, and there the same setup measured 0 disconnected.
- Proposed change: state that when a measurement stands in for a named test, the endpoint must be copied from that test's own API helper — a sibling listing can omit the very field the assertion reads and silently manufacture a false reproduction.

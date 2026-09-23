# .claude/skills/linode-ha-provisioning/SKILL.md — PMM-HA-GA is GA-only: fresh-install it, don't test upgrades from released charts or flag pmm-ha-client

- Added: 2026-09-23
- Applies to: .claude/skills/linode-ha-provisioning/SKILL.md, .claude/skills/test-scope/SKILL.md
- Evidence: User corrected a PMM-15445 report: upgrade from released pmm-ha 1.6.x charts to PMM-HA-GA will not be supported (the new chart is GA), and pmm-ha-client pods exist only for testing and will not be released, so the reported 1.6.x→GA swap steps and pmm-ha-client restart failure were not relevant findings.
- Proposed change: Install PMM-HA-GA fresh rather than swapping it over the relay's released chart, scope upgrade checks to upgrades within the GA chart line only, and treat pmm-ha-client as test scaffolding whose failures are not product bugs; this supersedes entry 2026-09-23-session_01du41nmnpthctcjvfcmv1ld-test-runner-03 (decline it).

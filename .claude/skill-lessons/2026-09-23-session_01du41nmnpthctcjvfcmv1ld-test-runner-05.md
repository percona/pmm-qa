# .claude/skills/linode-ha-provisioning/SKILL.md — redact PMM_VM_URL when dumping pmm pod environment

- Added: 2026-09-23
- Applies to: .claude/skills/linode-ha-provisioning/SKILL.md, .claude/skills/verification-depth/SKILL.md
- Evidence: Dumping the pmm-server pod environment to check versions printed the VictoriaMetrics password embedded in PMM_VM_URL into tool output.
- Proposed change: Read specific variables or pipe env through a redaction (e.g. sed 's#//[^@]*@#//***@#') instead of printing the whole environment.

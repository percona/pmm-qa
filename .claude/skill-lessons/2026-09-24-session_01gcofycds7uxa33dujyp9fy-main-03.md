# .claude/skills/add-ha-test/SKILL.md — scratch-config executablePath must be set per project (recurrence)

- Added: 2026-09-24
- Applies to: target only
- Evidence: A scratch config setting `use.launchOptions.executablePath` at top level failed all five @pmm-ha tests in 40ms with `Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1234/...`, because the tracked config's `projects[0].use.launchOptions` overrides it; spreading it into each `projects[].use` fixed it.
- Proposed change: Same as the open entries on this target and linode-docker-provisioning: show the per-project snippet in the cloud-session paragraph.

# .claude/skills/verification-depth/SKILL.md — reading $? after a pipe reports the last stage, not the command being verified

- Added: 2026-09-09
- Applies to: .claude/skills/verification-depth/SKILL.md
- Evidence: a probe of two CLI forms ran `docker exec <c> pmm-admin unregister 2>&1 | head -4; echo "rc=$?"`, which printed rc=0 for a command that actually exits 1. That reading was used to conclude the flagless form worked and to push a commit removing the flag; the next run showed the command had in fact failed and the flag was required.
- Proposed change: when a check's verdict is an exit status, capture it without a pipe — run the command bare, or assign the output first and echo `$?` on the next line — and say so where the skill describes probing a CLI or helper, since truncating output with `head` is the natural thing to do and silently replaces the status being measured.

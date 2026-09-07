# .claude/skills/fb-tests/SKILL.md — an FB image can predate the fix commits, not just a later merge

- Added: 2026-09-07
- Applies to: target only
- Evidence: the FB server image for a ticket's submodules PR was pushed at 08:46Z while the branch's earliest fix commit was 09:17Z the same day, so the image under test contained none of the change; the skill only warns about a product fix merged *after* the build.
- Proposed change: in "JNKPercona build comment", require comparing the FB image's Docker Hub `last_updated` against the linked pmm PR's earliest fix-commit date before using it as the build under test, and treat an image older than that as needing a rebuild.

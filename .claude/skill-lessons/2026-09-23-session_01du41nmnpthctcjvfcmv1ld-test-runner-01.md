# .claude/skills/jira/SKILL.md — relay attach 413s above ~100KB body; compress image and build body with jq --rawfile

- Added: 2026-09-23
- Applies to: .claude/skills/jira/SKILL.md
- Evidence: Attaching a 150KB PNG screenshot through the relay returned 413, and building the JSON body with `jq --arg` failed with "Argument list too long"; cropping and re-encoding to a ~40KB JPEG with ffmpeg (the only image tool in the sandbox) and using `jq --rawfile` succeeded.
- Proposed change: In the attachment steps, say to keep the base64 body under ~100KB (crop/convert with ffmpeg to JPEG) and to load the payload with `jq --rawfile`, never `--arg`.

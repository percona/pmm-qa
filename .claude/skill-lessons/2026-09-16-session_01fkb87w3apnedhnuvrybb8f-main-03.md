# .claude/skills/jira/SKILL.md — the relay's attach action has a payload ceiling well under a full screenshot

- Added: 2026-09-16
- Applies to: target only
- Evidence: `J attach` with a 1600x950 PNG (and with a 100 KB JPEG) returned HTTP 413 "payload too large"; a 40 KB JPEG (53 KB JSON payload) succeeded. Building the same call with `--arg c "$(base64 -w0 ...)"` failed first with "/usr/bin/jq: Argument list too long".
- Proposed change: In the `attach` example, build the JSON with `jq --rawfile` from a base64 file (never `--arg`), and note that a payload much above ~60 KB is rejected — downscale/crop a screenshot to JPEG (e.g. ffmpeg) before attaching.

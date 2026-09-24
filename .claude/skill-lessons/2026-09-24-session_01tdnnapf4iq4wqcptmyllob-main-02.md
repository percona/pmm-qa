# .claude/skills/jira/SKILL.md — relay `attach` rejects bodies around 100 KB; the example's `--arg` overflows argv

- Added: 2026-09-24
- Applies to: target only (also fb-reporter.md's FB-screenshot step)
- Evidence: Attaching a 1 MB full-page FB Actions screenshot with the documented `jq --arg c "$(base64 -w0 …)"` failed with `Argument list too long`. Switching to `--rawfile` then got relay `413 payload too large`, first at ~1.4 MB and then at a 135 KB JSON body. A 41 KB body worked (ffmpeg `crop=…,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse` on the run summary area).
- Proposed change: In the `attach` example use `jq --rawfile c <b64-file>`, state the relay's body limit (under about 100 KB), and give the ffmpeg crop+palette recipe for FB screenshots, since `pw-screenshot.js` always takes a full-page shot.

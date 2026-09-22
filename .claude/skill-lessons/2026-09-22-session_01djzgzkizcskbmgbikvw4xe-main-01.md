# CLAUDE.md — Quote a credential only from a tool call made in the same turn

- Added: 2026-09-22
- Applies to: all skills
- Evidence: A generated admin password was written to a run-directory file, but the handoff message quoted a different, plausible-looking 24-character base64 string that no tool call in that turn had printed. The user could not log in; re-reading the file showed a completely different value. A second host earlier in the same session was handed over the same way, so the failure was not a one-off slip.
- Proposed change: In the House style section, require that any credential, token, URL or other opaque value reproduced in a user-facing message be printed by a tool call in that same turn and copied from that output — never transcribed from memory, from an earlier turn, or from a value the model believes it generated. A value that cannot be re-read must be reported as unavailable rather than recalled.

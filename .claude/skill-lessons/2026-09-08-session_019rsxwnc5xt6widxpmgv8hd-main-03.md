# .claude/agents/investigator.md — check a collected server log's first timestamp before inferring anything from missing lines

- Added: 2026-09-08
- Applies to: .claude/agents/investigator.md
- Evidence: `logs/pmm-managed.log` in a nightly artifact bundle was 30 MB of debug logging covering only 14:14:00-14:20:16 of a 45-minute run; counting its 4 `RegisterNode` calls produced a confident but wrong conclusion about a 19-minute setup attempt that the log never covered, corrected only after `head -1` was run on it.
- Proposed change: In the nightly-artifact step, add that each collected log is rotated and may cover only its last minutes — read its first and last timestamps first, and treat an absence of entries as evidence only inside that window.

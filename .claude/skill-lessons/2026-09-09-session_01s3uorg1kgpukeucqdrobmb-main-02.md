# CLAUDE.md — replace a multi-line block by anchoring on unique start and end strings, never on a `sed -n 'A,Bp'` snapshot

- Added: 2026-09-09
- Applies to: all skills and agents
- Evidence: A rewrite of `preflight_database_setups` in qa-integration/pmm_qa/pmm-framework/lib/execution.sh took the old block with `sed -n '32,120p'` and swapped it via a Python `str.replace`; the range ended mid-block, so the six trailing lines survived as a duplicate and the file failed `bash -n` with "syntax error near unexpected token `}`". A second scripted repair by line index also mis-fired before an index-by-unique-string fix worked.
- Proposed change: Add to the House style section that a scripted multi-line replacement must locate the region by unique start and end strings (asserting each is present and unambiguous) rather than by line numbers, and must be followed immediately by the file's own syntax check.

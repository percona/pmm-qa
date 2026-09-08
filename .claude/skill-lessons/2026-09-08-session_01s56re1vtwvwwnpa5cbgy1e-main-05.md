# .claude/agents/investigator.md — make a retried download resumable, and only when the URL is immutable

- Added: 2026-09-08
- Applies to: .claude/agents/investigator.md
- Evidence: A bare `wget -O` inside a retry wrapper gave both attempts the same clock from byte 0 (54%, then 65%); `wget --continue -O` was verified to resume and produce a byte-identical file (md5 matched a full download), but the sibling tarball URL (`pmm-client-latest.tar.gz`) is mutable under a fixed name, so resuming there would splice two builds.
- Proposed change: Alongside the existing "time-bound every wait, retry or poll a setup fix introduces" rule, add that a retried large download must resume rather than restart, that resume is only safe for an immutable URL, and that the partial file must be named after the exact artifact so a stale one cannot be resumed into.

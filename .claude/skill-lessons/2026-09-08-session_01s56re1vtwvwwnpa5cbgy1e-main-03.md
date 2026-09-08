# .claude/agents/investigator.md — a timeout-around-a-download failure is reproduced against the real URL, not on a VM

- Added: 2026-09-08
- Applies to: .claude/agents/investigator.md
- Evidence: The failing step's log carried the whole mechanism (`Length: 178025706`, per-line KB/s, 54% then 65%, `Code: 124` on both attempts); a `HEAD` showed the artifact unchanged and the origin healthy at 16 MB/s, and re-running the wrapper shape locally (`timeout` + `--limit-rate`, twice) reproduced the old command's dead end and showed the fix carrying bytes forward — none of which a VM on a fast link could have shown, since it cannot reproduce a runner-to-CDN path.
- Proposed change: Extend the "When the failing step is an external fetch" paragraph so that a *timeout* (as opposed to a 404/403) is reproduced by replaying the wrapper's own shape against the real URL with a rate limit, with the "no VM was provisioned and why" gap stated in the PR, instead of the blanket "reproduce anyway".

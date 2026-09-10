# .claude/skills/qa-code-review/SKILL.md — re-verify a finding against the re-resolved head, not only its line numbers

- Added: 2026-09-10
- Applies to: target only
- Evidence: On percona/pmm-qa#1392 two of the four posted findings were already fixed by commit `fec5a031` before they landed — the author replied "Fixed in fec5a031, before this comment landed" (https://github.com/percona/pmm-qa/pull/1392#discussion_r3972583997) and, on a `suggestion` block, "Not to your suggested text, though: the block it annotates changed in fec5a031" (https://github.com/percona/pmm-qa/pull/1392#discussion_r3972585284).
- Proposed change: In section 6's anchoring bullet, add that when the re-resolved head differs from the SHA the findings were derived from, re-read the changed files at the head and drop or rewrite the findings it already resolved — re-anchoring line numbers alone leaves a stale finding sitting on correct coordinates, and a stale `suggestion` block proposes text for a region that no longer exists.

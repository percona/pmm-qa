# .claude/skills/qa-code-review/references/provisioning.md — a "make these two call sites consistent" finding must prove the artifact exists on both paths

- Added: 2026-09-16
- Applies to: .claude/skills/qa-code-review/references/provisioning.md
- Evidence: Of two client-tarball call sites a review called inconsistent, only one could take the fix: the other's feature-build branch needs a PR-specific tarball the arm bucket does not publish (168 keys, all `pmm-client-latest*`), so the same change would have traded a wrong-arch binary for a 404 (https://github.com/percona/pmm-qa/pull/1441#discussion_r4027160658).
- Proposed change: Before raising an inconsistency between two artifact-fetching call sites, list the bucket or registry contents for the second site's inputs and cite them in the thread; where the artifact is absent, the finding is against the publishing pipeline, not the caller.

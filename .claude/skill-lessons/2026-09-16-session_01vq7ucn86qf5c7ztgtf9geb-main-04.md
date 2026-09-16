# .claude/skills/qa-code-review/SKILL.md — check 4 must confirm a ported test's tags actually select it, not only that it is not unreachable

- Added: 2026-09-16
- Applies to: .claude/skills/qa-code-review/SKILL.md
- Evidence: A maintainer raised that a migrated test's `@gssapi-nightly` tag had no Playwright runner — "we will effectively skip the test there" (https://github.com/percona/pmm-qa/pull/1437#discussion_r4024915157) — on a tag the review had passed; a Jenkins Playwright runner had to be added for it (https://github.com/percona/pmm-qa/pull/1437#discussion_r4025762932).
- Proposed change: In check 4, require every tag a ported test carries to be traced to a runner that actually greps it, because CodeceptJS and Playwright have separate runners and a tag copied verbatim from the source can select nothing.

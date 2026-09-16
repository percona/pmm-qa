# .claude/agents/skill-gardener-publisher.md — a lesson that contradicts existing text must replace it, not sit beside it

- Added: 2026-09-16
- Applies to: .claude/agents/skill-gardener-publisher.md
- Evidence: A maintainer's review suggestion on the publisher's apply step (https://github.com/percona/pmm-qa/pull/1442#discussion_r4027416086) asks that contradicted behavior be edited in place and incremental additions avoided wherever editing the existing text is possible.
- Proposed change: In the apply step, instruct Publish to locate and rewrite the instruction a lesson contradicts, adding a new line only where no existing text owns that behavior.

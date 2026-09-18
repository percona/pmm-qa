# .claude/skills/jenkins-builds/SKILL.md — A build stuck in `node` allocation: read the queue before calling it slow provisioning

- Added: 2026-09-18
- Applies to: jenkins-builds skill only
- Evidence: A build sat at `[Pipeline] node` with "There are no nodes with the label 'agent-amd64-ol9'". I reported it as an on-demand EC2 agent spinning up and told the user to wait. `get_all_queue_items` then showed a second item stuck on the same label for 53 hours, and the job's config pinned a label no cloud template serves, while its sibling jobs used `agent-amd64`.
- Proposed change: Add a section — when a build waits on `node`, call `get_all_queue_items` and read each item's `why` plus `inQueueSince`; another item aged on the same label, or a label none of the job's siblings use, means the label has no provider, not that an agent is booting.

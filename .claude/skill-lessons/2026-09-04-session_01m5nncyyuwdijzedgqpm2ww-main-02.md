# .claude/skills/jira/SKILL.md — the Atlassian MCP connector does work in an interactive session the user explicitly enables it for

- Added: 2026-09-04
- Applies to: .claude/skills/jira/SKILL.md
- Evidence: After the user said the Atlassian MCP could be used in the session, `atlassianUserInfo` and a `searchJiraIssuesUsingJql` count both succeeded against perconadev.atlassian.net with no approval prompt, while the skill's blanket "do not call the Atlassian MCP" rests on Routine/headless auth failing closed.
- Proposed change: Scope the prohibition to headless/Routine runs and let an interactive session use the connector for read-only calls once the user explicitly enables it, keeping writes on the relay for forced Developers visibility; the human owns flipping the policy, so Publish should only propose this, not silently apply it.

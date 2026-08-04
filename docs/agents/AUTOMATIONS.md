# PMM — Claude Code agents (automations)

Agent behavior lives in `.claude/agents/*.md` and `.claude/skills/*` in this repo — committed, so anyone who opens `percona/pmm-qa` in Claude Code gets Test Runner, Test Doctor, and Test Reporter automatically. No separate environment snapshot or dashboard config to keep in sync (unlike the earlier Cursor prototype this replaces).

## The three agents

| Agent | Trigger | Does | Never |
|-------|---------|------|-------|
| [test-runner](../../.claude/agents/test-runner.md) | Ad hoc: "please test PMM-15196" | Reads a Jira ticket, provisions a throwaway Linode VM, runs the manual QA, posts a Developers-only Jira comment | Open PRs outside pmm-qa, post public Jira comments |
| [test-doctor](../../.claude/agents/test-doctor.md) | pmm-submodules FB Tests / CI failure | Triages product vs. test bug, reproduces on a Linode VM, fixes `pmm-qa`, opens a PR | Fix `percona/pmm`/`percona/grafana`, clone `pmm-submodules` |
| [test-reporter](../../.claude/agents/test-reporter.md) | pmm-submodules FB Tests all green | Screenshots the Actions run, attaches it to Jira `customfield_10492` | Post Jira comments, attach a screenshot when checks failed |

## Running one manually

In any Claude Code session on this repo, just ask in natural language — "please test PMM-15196", "the FB tests are red on PR 4376, can you take a look", "attach the green FB screenshot to PMM-14915". The agent description matching picks the right role; no slash-command prefix required.

## Running one from Slack / Jira

**Gap vs. Cursor, confirmed:** Cursor's dashboard could passively watch a channel for any matching message with no @mention. Claude Tag (the official Slack app) does not support that — it only responds to an explicit `@Claude` mention or a DM, by design, with no configuration to make it watch a channel silently. Every trigger from Slack has to actually @-mention it:

```
@Claude please act as test-runner on PMM-15196.
```

For Jira: a Jira Automation rule can POST to a Claude Code Remote Routine's **API trigger** URL (`create_trigger` supports firing via a plain HTTPS POST, not just cron) — set the rule to fire on whatever event you want (ticket transitions to a QA status, a comment mentions "please test", etc.) and have it call that endpoint with the ticket key in the payload.

## Scheduled triage (Test Doctor / Test Reporter without a human asking)

Cursor's dashboard used inbound GitHub webhooks to fire on every `pmm-submodules` workflow completion. Confirmed: Claude Code Remote Routines support **schedule**, **API**, and **GitHub** trigger types, but the GitHub trigger type only covers repos this integration owns/connects — not an arbitrary third-party repo like `Percona-Lab/pmm-submodules`. There is no way to fire a Routine off that repo's workflow completing. The only mechanism today is a **scheduled Routine** (cron, fresh session per fire) that polls recent activity and acts like the corresponding agent would on a real event:

```
Read .claude/agents/test-doctor.md and act as that role. Check
Percona-Lab/pmm-submodules for FB Tests runs that finished since your last
check with new failures. If none, do nothing and exit.
```

```
Read .claude/agents/test-reporter.md and act as that role. Check
Percona-Lab/pmm-submodules for FB Tests runs that finished all-green since
your last check and have a linked Jira ticket without FB evidence attached
yet. If none, do nothing and exit.
```

**Not created yet.** Wiring these as live cron Routines means a recurring job running unattended with `gh`/Jira privileges — pick a cadence (suggested: every 15-30 min) and confirm before turning it on.

## Linode cost-safety net

Test Runner and Test Doctor provision a throwaway Linode VM per run (`terraform/linode-runner/`, see [pmm-linode-provisioning](../../.claude/skills/pmm-linode-provisioning/SKILL.md)). Primary cleanup is the agent calling `down.sh` as its last step, on every exit path. The backstop is **not** a scheduled Routine — every instance carries its own on-box self-destruct timer (default 24h, see `terraform/linode-runner/README.md`) that deletes it via the Linode API with no external process involved. Nothing scans the account, nothing needs a cadence/TTL sign-off, and nothing can mistakenly delete a still-active run: an instance only ever removes itself, on a schedule it was given at creation. `extend.sh` pushes that timer back if a run needs more time.

## Go-live checklist

- [ ] `LINODE_TOKEN` available to sessions that need it (environment secret, not committed anywhere)
- [ ] Atlassian MCP / GitHub connector authenticated for each user
- [ ] `gh --version`, `terraform version`, `json-diff --version` succeed after a fresh SessionStart hook run
- [ ] Confirm cadence, then create the Test Doctor / Test Reporter polling Routines (optional — ad hoc triggering works without them)

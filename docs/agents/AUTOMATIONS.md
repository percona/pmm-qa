# PMM — Claude Code agents (automations)

Agent behavior lives in `.claude/agents/*.md` and `.claude/skills/*` in this repo — committed, so anyone who opens `percona/pmm-qa` in Claude Code gets all three agents automatically. No separate environment snapshot or dashboard config to keep in sync (unlike the earlier Cursor prototype this replaces).

## The three agents

| Agent | Watches | Trigger | Does | Never |
|-------|---------|---------|------|-------|
| [test-runner](../../.claude/agents/test-runner.md) | A named Jira ticket | Ad hoc — Slack/Claude Code mention, or a Jira Automation rule | Reads the ticket, provisions a throwaway Linode VM, runs the manual QA, posts a Developers-only Jira comment | Open PRs outside pmm-qa, post public Jira comments |
| [test-doctor](../../.claude/agents/test-doctor.md) | **pmm-qa's own** scheduled CI on `main` (`e2e-tests-matrix.yml`, `gssapi-psmdb-tests-matrix.yml`, `helm-tests.yml`, `integration-cli-tests.yml`) | CI-triggered — a step in those workflows fires it on failure | Triages whether a nightly break is a real regression upstream (`percona/pmm`/`percona/grafana`) or a pmm-qa test bug; reproduces + fixes the latter | Fix `percona/pmm`/`percona/grafana`, clone `pmm-submodules`, act on a pmm-qa problem it hasn't confirmed reproduces |
| [fb-validator](../../.claude/agents/fb-validator.md) | `Percona-Lab/pmm-submodules` FB Tests (a repo we don't own) | Polling Routine (hourly — no event hook available for a third-party repo) | Green → screenshots + attaches evidence to Jira. Red → triages product vs test bug, reproduces, fixes pmm-qa | Fix `percona/pmm`/`percona/grafana`, clone `pmm-submodules` |

`test-doctor` and `fb-validator` are deliberately different mechanisms, not a style choice: `pmm-qa`'s own CI is a repo we control, so a workflow step can push an event directly (no polling delay, no wasted checks when nothing happened). `pmm-submodules` isn't ours, so the only option is a Routine that wakes up and asks "anything new?"

## Running Test Runner manually

In any Claude Code session on this repo, just ask in natural language — "please test PMM-15196". The agent description matching picks the role; no slash-command prefix required.

## Running Test Runner from Slack

**Confirmed gap vs. Cursor**: Cursor's dashboard could passively watch a channel for any matching message, no @mention needed. Claude Tag (the official Slack app) does not support that — it only responds to an explicit `@Claude` mention or a DM, with no configuration to make it watch silently. Every Slack trigger has to actually name it:

```
@Claude please act as test-runner on PMM-15196.
```

**Also confirmed**: Claude Tag pairs one Slack workspace to one Claude org — you cannot run a second Claude account's Tag bot in a workspace already paired to another account. If this project's automation needs to live under a different Claude account than the company's main enterprise one, Slack triggering for it needs its own workspace, or a small custom Slack app that relays into the Routine API trigger below (see the open question in chat — worth scoping separately from this repo if you want to go that route).

## Running Test Runner from Jira

A Jira Automation rule can fire a Claude Code Remote **Routine's API trigger** directly — a plain HTTPS POST, no polling. The `text` field in that POST isn't limited to a bare ticket key: it's appended as an extra turn on top of the routine's own prompt, so it can carry as much context as you want (summary, priority, whatever Jira smart-values you include).

```bash
curl -X POST https://api.anthropic.com/v1/claude_code/routines/<routine_id>/fire \
  -H "Authorization: Bearer <token>" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: experimental-cc-routine-2026-04-01" \
  -H "Content-Type: application/json" \
  -d '{"text": "{{issue.key}}"}'
```

`<routine_id>` and `<token>` come from opening the Test Runner routine in the claude.ai Routines UI and clicking **"Add an API trigger"** — the token is shown once and can't be retrieved again. Configure a Jira Automation "Send web request" action with the above.

## Test Doctor — CI-triggered, not polled

Since `e2e-tests-matrix.yml`, `gssapi-psmdb-tests-matrix.yml`, `helm-tests.yml`, and `integration-cli-tests.yml` all live in this repo, each gets a final job that fires Test Doctor's Routine on failure — see the `notify-test-doctor` job added to each. It needs two repo secrets:

- `TEST_DOCTOR_ROUTINE_ID` — from the routine's "Add an API trigger" screen
- `TEST_DOCTOR_ROUTINE_TOKEN` — the one-time bearer token from that same screen

**Not wired up yet** — the workflow steps are in place (see the diff on this branch) but the two secrets need to actually be added to the repo before they'll fire anything.

## FB Validator — polling Routine

`Percona-Lab/pmm-submodules` isn't a repo we own, so there's no event to hook — a Routine polls hourly:

```
Read .claude/agents/fb-validator.md and act as that role. Check
Percona-Lab/pmm-submodules for the latest FB Tests result since your last
check. If nothing new finished, do nothing and exit.
```

## Routine ownership — read before relying on this

Confirmed from the docs: a Routine's fired session runs under **its creator's personal identity** — commits, PRs, and connector actions (Slack, Jira, GitHub) all appear as that person, using their connectors. There is no service-account or shared-identity option today. If the creator's connector auth lapses or they leave the team, the Routine breaks silently — there's no documented mitigation beyond recreating it under someone else's account. Sharing a session link is also one-way: a teammate can view the latest state, but it does not update live and isn't collaboratively editable — there's no "shared chat everyone works in together" mechanism.

## Linode cost-safety net

Test Runner, Test Doctor, and FB Validator all provision a throwaway Linode VM per run (`terraform/linode-runner/`, see [pmm-linode-provisioning](../../.claude/skills/pmm-linode-provisioning/SKILL.md)). Primary cleanup is the agent calling `down.sh` as its last step, on every exit path. The backstop is **not** a scheduled Routine — every instance carries its own on-box self-destruct timer (default 24h, see `terraform/linode-runner/README.md`) that deletes it via the Linode API with no external process involved. `extend.sh` pushes that timer back if a run needs more time.

## Go-live checklist

- [ ] `LINODE_TOKEN` available to sessions that need it — **no real secrets store exists yet** in the environment config; anything set there is plaintext-visible to every teammate with access to that environment. Set expectations accordingly, there's no better option today.
- [ ] Atlassian MCP / GitHub connector attached to each Routine (an org-level restriction blocks attaching them via the API — do it from the claude.ai Routines UI)
- [ ] GitHub connector specifically still pending org activation
- [ ] `gh --version`, `terraform version`, `json-diff --version`, `ffmpeg -version` succeed after a fresh SessionStart hook run
- [ ] `TEST_DOCTOR_ROUTINE_ID` / `TEST_DOCTOR_ROUTINE_TOKEN` added as repo secrets so the CI-trigger steps can actually fire
- [ ] Jira Automation rule configured with Test Runner's API trigger URL/token

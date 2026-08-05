# PMM — Claude Code agents (automations)

Agent behavior lives in `.claude/agents/*.md` and `.claude/skills/*` in this repo — committed, so anyone who opens `percona/pmm-qa` in Claude Code gets all agents automatically. No separate environment snapshot or dashboard config to keep in sync (unlike the earlier Cursor prototype this replaces).

## The four agents

| Agent | Watches / invoked by | Trigger | Does | Never |
|-------|----------------------|---------|------|-------|
| [test-runner](../../.claude/agents/test-runner.md) | A named Jira ticket | Ad hoc — chat, a Slack `@mention` via Claude Tag, or a Jira Automation rule | Reads the ticket, provisions a throwaway Linode VM, runs the manual QA, hands off to `fb-reporter` for any linked submodules PR's evidence, posts a Developers-only Jira comment | Open PRs outside pmm-qa, post public Jira comments |
| [test-doctor](../../.claude/agents/test-doctor.md) | **pmm-qa's own** scheduled CI on `main`, and `Percona-Lab/pmm-submodules` FB Tests going red | CI-triggered from both sources (see below) | Detects the failure, extracts what happened, hands off to `investigator` | Investigate, classify, or fix anything itself |
| [investigator](../../.claude/agents/investigator.md) | Referenced by `test-doctor`, or asked directly | N/A — read-and-followed in the caller's own session, or invoked directly | Reproduces the failure hands-on on a throwaway VM, classifies **from what actually reproduced** (test bug vs. product regression), fixes + opens a PR if it's ours | Fix `percona/pmm`/`percona/grafana`, clone `pmm-submodules`, classify without reproducing first |
| [fb-reporter](../../.claude/agents/fb-reporter.md) | Referenced by `test-runner`, or asked directly | N/A — read-and-followed in the caller's own session, or invoked directly | Gets a clean FB Tests screenshot for a ticket's linked submodules PR, retrying past flakiness (`gh run rerun --failed`, up to twice), attaches to Jira | Diagnose or fix a genuine (non-flaky) failure — that's `test-doctor`/`investigator`'s job |

Why `investigator` and `fb-reporter` aren't spawned as nested subagents: whether a Claude Code Remote **Routine**-fired session can itself spawn a custom subagent via the Agent/Task tool isn't confirmed by Claude Code's own docs — `test-doctor` and `test-runner` both run as Routines, so neither risks depending on that. Instead, their own instructions say to read the other agent's `.md` file directly and follow it in the same session — the same mechanical pattern already used for skills. Both are still real agents (their own `name`/`description`), so a person in an ordinary interactive session (where subagent-spawning is confirmed to work) can invoke either directly, or just ask in natural language.

## Running Test Runner manually

In any Claude Code session on this repo, just ask in natural language — "please test PMM-15196". The agent description matching picks the role; no slash-command prefix required.

## Running Test Runner from Slack

**Confirmed gap vs. Cursor**: Cursor's dashboard could passively watch a channel for any matching message, no @mention needed. Claude Tag (the official Slack app) does not support that — it only responds to an explicit `@Claude` mention or a DM, with no configuration to make it watch silently. Every Slack trigger has to actually name it:

```
@Claude please act as test-runner on PMM-15196.
```

**Also confirmed**: Claude Tag pairs one Slack workspace to one Claude org — you cannot run a second Claude account's Tag bot in a workspace already paired to another account. If this project's automation needs to live under a different Claude account than the company's main enterprise one, Slack triggering for it needs its own workspace, or a small custom Slack app that relays into the Routine API trigger below (see [`.claude/integrations/slack/README.md`](../../.claude/integrations/slack/README.md) — design only, not built).

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

## Test Doctor — event-triggered from both sources, no polling

`Percona-Lab/pmm-submodules` is also a Percona-owned repo, not a third party's — so unlike the earlier design, there's no need for an hourly polling Routine to catch FB Tests going red. Both of Test Doctor's sources push an event directly:

- **pmm-qa's own scheduled CI**: [`.github/workflows/notify-test-doctor.yml`](../../.github/workflows/notify-test-doctor.yml), already in this repo, fires on `workflow_run` for `e2e-tests-matrix.yml`, `gssapi-psmdb-tests-matrix.yml`, `helm-tests.yml`, `integration-cli-tests.yml` (native GitHub Actions cron), plus `nightly-e2e-tests-matrix.yml` (dispatched daily by the Jenkins pipeline in `jenkins-pipelines`, matched by name since it's not a GitHub cron). It fires on the run's own computed `conclusion`, not any single job's pass/fail — some of these pipelines pass their e2e-test step but fail overall once a later Launchable step errors collecting results, and a hand-maintained per-job list would miss that.
- **`Percona-Lab/pmm-submodules` FB Tests**: **needs a mirroring notify workflow added in that repo**, firing the same Test Doctor Routine with the submodules PR number + run URL. Not built yet — this is a go-live item, not something this repo alone can finish.

Only one secret is needed:

- `TEST_DOCTOR_ROUTINE_TOKEN` — the bearer token from the routine's "Add an API trigger" screen. The routine ID itself (`trig_01FhHBdz2yBibyVEfnG5gbQz`) is hardcoded in the watcher file — it isn't sensitive, only the token is.

**Not fully wired up yet** — the pmm-qa side (`notify-test-doctor.yml`) is in place but needs `TEST_DOCTOR_ROUTINE_TOKEN` added as a repo secret; the pmm-submodules side doesn't exist yet at all.

## Investigator and FB Reporter — no Routine of their own

Neither has its own trigger or Routine — they're read-and-followed by `test-doctor`/`test-runner` respectively (see "why not spawned as nested subagents" above), or invoked directly by a person. Nothing to wire up here beyond the two files themselves existing.

## PMM AI — custom Slack app (design only, not built yet)

Claude Tag can't have a second identity in a workspace already paired to
another Claude org, so mention-based Slack triggering for this project
needs its own small app. Full design — manifest, Socket Mode relay, the
channel-to-routine routing table, and how replies post as the bot instead
of a person — is in
[`.claude/integrations/slack/README.md`](../../.claude/integrations/slack/README.md).
Nothing here is deployed: the app isn't created in Slack yet, no relay
process exists, and the `PMM AI` Routine itself hasn't been created either
(routines only get created/changed here when explicitly asked for).

## Routine ownership — read before relying on this

Confirmed from the docs: a Routine's fired session runs under **its creator's personal identity** — commits, PRs, and connector actions (Slack, Jira, GitHub) all appear as that person, using their connectors. There is no service-account or shared-identity option today. If the creator's connector auth lapses or they leave the team, the Routine breaks silently — there's no documented mitigation beyond recreating it under someone else's account. Sharing a session link is also one-way: a teammate can view the latest state, but it does not update live and isn't collaboratively editable — there's no "shared chat everyone works in together" mechanism.

## Linode cost-safety net

Test Runner, Test Doctor (via Investigator) all provision a throwaway Linode VM per run (`terraform/linode-runner/`, see [linode-provisioning](../../.claude/skills/linode-provisioning/SKILL.md)) — FB Reporter never does, it only calls `gh`/Jira. Primary cleanup is the agent calling `down.sh` as its last step, on every exit path. The backstop is **not** a scheduled Routine — every instance carries its own on-box self-destruct timer (default 24h, see `terraform/linode-runner/README.md`) that deletes it via the Linode API with no external process involved. `extend.sh` pushes that timer back if a run needs more time.

## Go-live checklist

- [x] `LINODE_TOKEN` available to sessions that need it — **no real secrets store exists yet** in the environment config; anything set there is plaintext-visible to every teammate with access to that environment. Use a least-privilege, access-controlled Linode API token (scoped to Linode/Firewall create-delete only, not full account access) rather than a personal full-access token — and note it still flows into `TF_VAR_linode_token`, gets templated into each instance's cloud-init `user_data`, and is persisted in that run's local `terraform.tfstate`; this is an accepted tradeoff of the current design (throwaway VMs, short TTL, no shared state backend), not an oversight, but it's why the token's scope matters more than usual here.
- [x] Atlassian Rovo / Slack connectors and API triggers attached to each Routine
- [ ] GitHub connector specifically still pending org activation
- [ ] `gh --version`, `terraform version`, `json-diff --version`, `ffmpeg -version` succeed after a fresh SessionStart hook run
- [ ] `TEST_DOCTOR_ROUTINE_TOKEN` added as a repo secret so `notify-test-doctor.yml` can actually fire
- [ ] Notify workflow added in `Percona-Lab/pmm-submodules` firing the same Test Doctor Routine on FB Tests red — the whole reason the old hourly-polling design is gone
- [ ] Jira Automation rule configured with Test Runner's API trigger URL/token

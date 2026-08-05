# PMM — Claude Code agents (automations)

Agent behavior lives in `.claude/agents/*.md` and `.claude/skills/*` in this repo — committed, so anyone who opens `percona/pmm-qa` in Claude Code gets all agents automatically. No separate environment snapshot or dashboard config to keep in sync (unlike the earlier Cursor prototype this replaces).

## The three agents

| Agent | Watches / invoked by | Trigger | Does | Never |
|-------|----------------------|---------|------|-------|
| [test-runner](../../.claude/agents/test-runner.md) | A named Jira ticket | Ad hoc — chat, a Slack `@mention` via Claude Tag, or a Jira Automation rule | Reads the ticket, provisions a throwaway Linode VM, runs the manual QA, hands off to `fb-reporter` for any linked submodules PR's evidence, posts a Developers-only Jira comment | Open PRs outside pmm-qa, post public Jira comments |
| [investigator](../../.claude/agents/investigator.md) | **pmm-qa's own** scheduled CI on `main`, and `Percona-Lab/pmm-submodules` FB Tests going red | CI-triggered from both sources (see below), or asked directly | Extracts the failure, reproduces it hands-on on a throwaway VM, classifies **from what actually reproduced** (test bug vs. product regression), fixes + opens a PR if it's ours | Fix `percona/pmm`/`percona/grafana`, clone `pmm-submodules`, classify without reproducing first |
| [fb-reporter](../../.claude/agents/fb-reporter.md) | Referenced by `test-runner`, or asked directly | N/A — read-and-followed in the caller's own session, or invoked directly | Gets a clean FB Tests screenshot for a ticket's linked submodules PR, retrying past flakiness (`gh run rerun --failed`, up to twice), attaches to Jira | Diagnose or fix a genuine (non-flaky) failure — that's `investigator`'s job |

There's no separate "watcher" agent in front of Investigator. An earlier draft had one (detect the failure, hand off to a shared fixer) — dropped once it became clear the "detect" step was too thin to be its own agent: parsing a trigger payload and extracting a failure list is just Investigator's own first step, not a separable concern the way `fb-reporter`'s screenshot-and-retry job genuinely is.

Why `fb-reporter` isn't spawned as a nested subagent from `test-runner`: whether a Claude Code Remote **Routine**-fired session can itself spawn a custom subagent via the Agent/Task tool isn't confirmed by Claude Code's own docs — `investigator` and `test-runner` both run as Routines, so neither risks depending on that. Instead, `test-runner`'s own instructions say to read `fb-reporter.md` directly and follow it in the same session — the same mechanical pattern already used for skills. `fb-reporter` is still a real agent (its own `name`/`description`), so a person in an ordinary interactive session (where subagent-spawning is confirmed to work) can invoke it directly, or just ask in natural language.

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

## Investigator — event-triggered from both sources, no polling

`Percona-Lab/pmm-submodules` is also a Percona-owned repo, not a third party's — so unlike an earlier design, there's no need for an hourly polling Routine to catch FB Tests going red. Both of Investigator's sources push an event directly:

- **pmm-qa's own scheduled CI**: [`.github/workflows/notify-investigator.yml`](../../.github/workflows/notify-investigator.yml), already in this repo, fires on `workflow_run` for `e2e-tests-matrix.yml`, `gssapi-psmdb-tests-matrix.yml`, `helm-tests.yml`, `integration-cli-tests.yml` (native GitHub Actions cron), plus `nightly-e2e-tests-matrix.yml` (dispatched daily by the Jenkins pipeline in `jenkins-pipelines`, matched by name since it's not a GitHub cron). It fires on the run's own computed `conclusion`, not any single job's pass/fail — some of these pipelines pass their e2e-test step but fail overall once a later Launchable step errors collecting results, and a hand-maintained per-job list would miss that.
- **`Percona-Lab/pmm-submodules` FB Tests**: **needs a mirroring notify workflow added in that repo**, firing the same Investigator Routine with the submodules PR number + run URL. Not built yet — this is a go-live item, not something this repo alone can finish (needs push access to that other repo).

Only one secret is needed:

- `INVESTIGATOR_ROUTINE_TOKEN` — the bearer token from the routine's "Add an API trigger" screen. The routine ID itself (`trig_01FhHBdz2yBibyVEfnG5gbQz`) is hardcoded in the watcher file — it isn't sensitive, only the token is.

**Not fully wired up yet** — the pmm-qa side (`notify-investigator.yml`) is in place but needs `INVESTIGATOR_ROUTINE_TOKEN` added as a repo secret; the pmm-submodules side doesn't exist yet at all.

## FB Reporter — no Routine of its own

No trigger or Routine of its own — it's read-and-followed by `test-runner` (see "why not spawned as a nested subagent" above), or invoked directly by a person. Nothing to wire up here beyond the file itself existing.

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

Test Runner and Investigator both provision a throwaway Linode VM per run (`terraform/linode-runner/`, see [linode-provisioning](../../.claude/skills/linode-provisioning/SKILL.md)) — FB Reporter never does, it only calls `gh`/Jira. Primary cleanup is the agent calling `down.sh` as its last step, on every exit path. The backstop is **not** a scheduled Routine — every instance carries its own on-box self-destruct timer (default 24h, see `terraform/linode-runner/README.md`) that deletes it via the Linode API with no external process involved. `extend.sh` pushes that timer back if a run needs more time.

## Go-live checklist

- [x] `LINODE_TOKEN` available to sessions that need it — **no real secrets store exists yet** in the environment config; anything set there is plaintext-visible to every teammate with access to that environment. Use a least-privilege, access-controlled Linode API token (scoped to Linode/Firewall create-delete only, not full account access) rather than a personal full-access token — and note it still flows into `TF_VAR_linode_token`, gets templated into each instance's cloud-init `user_data`, and is persisted in that run's local `terraform.tfstate`; this is an accepted tradeoff of the current design (throwaway VMs, short TTL, no shared state backend), not an oversight, but it's why the token's scope matters more than usual here.
- [x] Atlassian Rovo / Slack connectors and API triggers attached to each Routine
- [ ] GitHub connector specifically still pending org activation
- [ ] `gh --version`, `terraform version`, `json-diff --version`, `ffmpeg -version` succeed after a fresh SessionStart hook run
- [ ] `INVESTIGATOR_ROUTINE_TOKEN` added as a repo secret so `notify-investigator.yml` can actually fire
- [ ] Notify workflow added in `Percona-Lab/pmm-submodules` firing the same Investigator Routine on FB Tests red — the whole reason the old hourly-polling design is gone
- [ ] Jira Automation rule configured with Test Runner's API trigger URL/token
- [ ] Live Claude Code Remote Routines updated to match this architecture — see "Updating the live Routines" below; this repo's files describe the intended behavior, they don't change what's already scheduled

## Updating the live Routines

Three Routines already exist from an earlier iteration of this design and need to be brought in line with what's actually in this repo now:

| Routine (current name) | Trigger ID | What needs to change |
|---|---|---|
| Test Runner | `trig_01HmhmybBxMn21FRzfqosE2t` | Nothing — its prompt already just says "read `.claude/agents/test-runner.md` and act as that role," so it picks up `test-runner.md`'s changes (the new `fb-reporter` hand-off) automatically. |
| Test Doctor | `trig_01FhHBdz2yBibyVEfnG5gbQz` | **Rename to "Investigator"** and update its prompt to read `.claude/agents/investigator.md` instead of the now-deleted `test-doctor.md`. Keep the same trigger ID — `notify-investigator.yml` already points at it, so this is an in-place edit, not a new Routine. |
| FB Validator | `trig_01E3y6NS23kjsUt4eaS722FA` | **Broken as-is** — its prompt reads `.claude/agents/fb-validator.md`, which no longer exists, so it will error the next time its cron fires. Update its prompt to read `investigator.md` too (same content as the Test Doctor rename above), or disable/delete it once the pmm-submodules-side notify workflow exists and this polling fallback is no longer needed. Its cron is currently `0 23 * * 0-4` (once daily, not hourly as earlier drafts of this doc said) — worth confirming that's actually the cadence wanted before reusing it as an interim FB-Tests check. |

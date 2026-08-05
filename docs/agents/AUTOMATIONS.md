# PMM — Claude Code agents (automations)

Agent behavior lives in `.claude/agents/*.md` and `.claude/skills/*` in this repo — committed, so anyone who opens `percona/pmm-qa` in Claude Code gets all agents automatically. No separate environment snapshot or dashboard config to keep in sync (unlike the earlier Cursor prototype this replaces).

## The four agents

| Agent | Watches / invoked by | Trigger | Does | Never |
|-------|----------------------|---------|------|-------|
| [test-runner](../../.claude/agents/test-runner.md) | A named Jira ticket | Ad hoc — chat, a Jira Automation rule, or a Slack `@pmm-ai` mention routed here by `router` | Reads the ticket, provisions a throwaway Linode VM, runs the manual QA, hands off to `fb-reporter` for the linked submodules PR's evidence, posts a Developers-only Jira comment | Open PRs outside pmm-qa, post public Jira comments |
| [investigator](../../.claude/agents/investigator.md) | **pmm-qa's own** scheduled CI on `main`, `Percona-Lab/pmm-submodules` FB Tests going red, or asked directly (including via `router`) | CI-triggered from both sources (see below), or asked directly | One pipeline (dedup → reproduce → classify) regardless of trigger — classifies **from what actually reproduced**: didn't reproduce, not-a-bug, or a genuine bug that routes to a product-bug report, an ordinary pmm-qa fix+PR, or a blocked draft PR | Fix `percona/pmm`/`percona/grafana`, clone `pmm-submodules`, classify or answer a question without reproducing first |
| [fb-reporter](../../.claude/agents/fb-reporter.md) | Referenced by `test-runner`, or asked directly | N/A — read-and-followed in the caller's own session, or invoked directly | Gets a clean FB Tests screenshot for a ticket's linked submodules PR, retrying past flakiness (`gh run rerun --failed`, up to twice), attaches to Jira | Diagnose or fix a genuine (non-flaky) failure — that's `investigator`'s job |
| [router](../../.claude/agents/router.md) | The `PMM AI` Routine, fired by a Slack `@pmm-ai` mention | Slack-only — see "PMM AI" below | Matches the mention to test-runner / investigator / fb-reporter by description and hands off, or answers directly if it's just a question | Guess a ticket key/PR number that wasn't in the message, do the matched agent's work itself |

There's no separate "watcher" agent in front of Investigator. An earlier draft had one (detect the failure, hand off to a shared fixer) — dropped once it became clear the "detect" step was too thin to be its own agent: parsing a trigger payload and extracting a failure list is just Investigator's own first step, not a separable concern the way `fb-reporter`'s screenshot-and-retry job genuinely is.

Why `fb-reporter` (and `router`) isn't spawned as a nested subagent from whatever calls it: whether a Claude Code Remote **Routine**-fired session can itself spawn a custom subagent via the Agent/Task tool isn't confirmed by Claude Code's own docs — `investigator`, `test-runner`, and `PMM AI` all run as Routines, so none of them risk depending on that. Instead, the calling agent's own instructions say to read the target `.md` file directly and follow it in the same session — the same mechanical pattern already used for skills. Each is still a real agent (its own `name`/`description`), so a person in an ordinary interactive session (where subagent-spawning is confirmed to work) can invoke any of them directly, or just ask in natural language.

## Running Test Runner manually

In any Claude Code session on this repo, just ask in natural language — "please test PMM-15196". The agent description matching picks the role; no slash-command prefix required.

## Running Test Runner from Slack

Not Claude Tag (the official Slack app) — it pairs one Slack workspace to one Claude org, and this project's Claude identity isn't the one already paired to the team's workspace. Slack triggering here goes through the custom **`@pmm-ai`** app instead (design in [`.claude/integrations/slack/README.md`](../../.claude/integrations/slack/README.md), not built yet): someone mentions `@pmm-ai`, the relay fires the single `PMM AI` Routine, and that session reads [`router.md`](../../.claude/agents/router.md) and follows it — Router is the one that decides this particular mention means Test Runner, then reads `test-runner.md` and follows it in the same session. A mention never goes straight to Test Runner on its own; it always goes through Router first. See "PMM AI" below.

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

Investigator also answers a question or a suspected customer-reported bug directly (in chat, or routed from a Slack `@pmm-ai` mention via `router`) — this isn't a separate flow, just a different way into the **same** dedup → reproduce → classify pipeline as a CI/FB event: dedup checks for an existing Jira ticket instead of an open PR (there's no failing test to match against an open-PR marker), and reproduction walks the described scenario instead of re-running a failing command. Classification after that is the same tree either way — didn't reproduce (say so, ask for more detail), described scenario isn't an actual bug (explain the right way, grounded in the reproduction and the code, never a guess — this outcome only applies here, a CI/FB failure that reproduces is never "not a bug"), or a confirmed bug, which then routes to product (report, no fix) or pmm-qa's own test code (fix). See `investigator.md` workflow step 3. This is also why a separate "support-triage" agent, floated earlier for a prod/support Slack channel, was dropped — it would have just duplicated this.

A second Investigator nuance worth calling out: when the FB source is the one that triggered it, a "test bug" fix isn't always a normal, ready-to-merge PR. Submodules tests occasionally get updated *ahead of* the upstream `percona/pmm`/`percona/grafana` PR that will actually introduce the behavior they now expect. Investigator checks for that (an open, not-yet-merged upstream PR touching the same area) before opening a PR — if one exists, it opens the fix as a **draft PR** noting what it's blocked on, instead of a normal one, since merging it before the upstream change lands would just break `main`.

## FB Reporter — no Routine of its own

No trigger or Routine of its own — it's read-and-followed by `test-runner` (see "why not spawned as a nested subagent" above), or invoked directly by a person. Nothing to wire up here beyond the file itself existing.

## PMM AI — custom Slack app (design only, not built yet)

Claude Tag can't have a second identity in a workspace already paired to
another Claude org, so mention-based Slack triggering for this project
needs its own small app, `@pmm-ai`. Full design — manifest, Socket Mode
relay, the channel-to-routine routing table, and how replies post as the
bot instead of a person — is in
[`.claude/integrations/slack/README.md`](../../.claude/integrations/slack/README.md).
The `PMM AI` Routine's own prompt is deliberately thin — "read
[`router.md`](../../.claude/agents/router.md) and follow it" — all the
actual mention-to-agent matching lives in that file, not duplicated into
the Routine's prompt or into a mega-prompt trying to guess intent itself.
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

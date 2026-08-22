# PMM AI — custom Slack app + relay (built; app awaiting admin approval)

Claude Tag (the official Slack app) pairs one Slack workspace to one Claude
org — it can't run a second identity in a workspace already paired to
another account, and it only reacts to an explicit `@mention` or DM by
design (no passive channel watching). This is a small custom Slack app that
works around the first limit; it doesn't try to work around the second
(mention-only is what we actually want here).

**Status: relay built and deployed (Slack app tokens pending).**

- [x] Create the app from [`manifest.yaml`](manifest.yaml) in Slack (done
      2026-08-08) — still needs admin approval to install.
- [x] Relay written and deployed — [`relay/relay.js`](relay/relay.js) on the
      `pmm-ai-relay` Linode (g6-nanode-1, eu-central, 139.162.176.43, $5/mo).
      Entry points: registered mention → central owner's `router` routine →
      `/route` hand-off to the caller's own routine; `WATCHED_CHANNELS`
      (channel → agent name) → owner's routine; `POST /jira` → initiator's
      own test-runner (404 `not_registered` when not onboarded).
- [x] Config model: the `.env` holds names and secrets only — every routine
      id/token lives in `people/<name>.json` (hot-reloaded);
      `CENTRAL_OWNER=<name>` says whose file provides the central routines.
      `ALLOW_FALLBACK` gates unregistered people identically on Slack and
      Jira (true = they run on the owner's routines).
- [x] `PMM AI` router Routine created (`trig_01MJNKVHiPqrZ3Ajv1fzUdQK`) —
      prompt is just "read `.claude/agents/router.md` and follow it"; it only
      evaluates and routes, never executes.
- [ ] Fill the two Slack tokens in `/opt/pmm-ai-relay/.env` once the app is
      installed, then `touch /opt/pmm-ai-relay/.env.ready && systemctl
      restart pmm-ai-relay` (or hand the tokens to a Claude session).

## Runbook

| Operation | How |
| --- | --- |
| Onboard a person | Slack + Jira IDs are already resolved for the whole team and pre-filled in `people/<name>.json`, so they send **only their routine id(s)+token(s)**. Then either ask a Claude session on this repo to bake `people/<name>.json` into the server, or Lish → `nano /opt/pmm-ai-relay/people/<name>.json` → paste → save. Hot-reloaded, no restart. Mirror the file as a LastPass **PMM** note. |
| First activation | When the Slack app tokens exist: hand them to a Claude session (final rebuild, service auto-starts) or Lish → edit `.env` → `touch /opt/pmm-ai-relay/.env.ready && systemctl restart pmm-ai-relay`. |
| Code/config change | Rebuild via the Linode API (same instance/IP/root password): a Claude session on this repo can do it, or run `./relay/deploy.sh .env people_dir/` with the files from LastPass. |
| Unregistered person clicks the Jira button | Relay answers **404 `not_registered`** (403 = bad secret, 502 = fire failure); the Jira Automation rule uses "Wait for response" + condition `{{webResponse.status}} == 404` → Add comment telling the initiator to get onboarded. |
| PR Maintainer digest → Slack | The daily `pr-maintainer` Routine `curl`s its digest to `POST /slack/announce` (`X-Relay-Secret: $RELAY_KEY`, body `{channel,text}`); the relay posts it as the bot to `#qa-automation`. Invite the bot to that channel first, and set `RELAY_KEY` in `.env`. `RELAY_KEY` is the shared-env → relay bearer, reused by every broker endpoint. |

## Operations

- **`.env` storage**: keep the complete `/opt/pmm-ai-relay/.env` as a Secure
  Note in the team's **LastPass shared folder "PMM"** (Business). The `lpass`
  CLI is entirely optional (and awkward on Windows) — the web vault plus
  copy/paste works for both saving and restoring, and the easiest init/restore
  of all is pasting the tokens into a Claude session on this repo and asking
  it to rebuild the relay with the `.env` baked in (no SSH needed). For manual
  access the easiest path is the **Lish console** in the browser —
  cloud.linode.com → pmm-ai-relay → Launch LISH Console → `root` + the
  password from the PMM note — no SSH key or client required. (SSH also
  works: the private key should live in the same PMM note.) It is the only
  state the relay has. Auto-fetching it on boot via the LastPass API is
  deliberately NOT done — that would require a LastPass credential on the
  server (the circular-secret problem). Restore is semi-automatic instead:

  ```bash
  lpass show --notes 'Shared-PMM/pmm-ai-relay.env' > .env   # shared folder: "PMM"
  export RELAY_ROOT_PASS='<root password, also in the PMM folder>'
  LINODE_TOKEN=... ./relay/deploy.sh .env   # rebuilds same ID/IP, or recreates
  ```

  `RELAY_ROOT_PASS` keeps the server's known root password across rebuilds
  (the Linode rebuild API requires setting one; without the variable a fresh
  random one is generated and must be re-saved).

- **The IP `139.162.176.43` is a Reserved IP** (Frankfurt, tagged `pmm-ai`),
  so it stays under the account and reattaches on rebuild — and, crucially,
  it is NOT recycled to the pool if the Linode is deleted. That removes the
  old "a stranger could inherit our endpoint" risk, and keeps the hostname
  and Let's Encrypt cert valid across rebuilds. Prefer rebuild over delete
  regardless (`deploy.sh` rebuilds in place); if the Linode is ever deleted,
  recreate in the same region and reattach the reserved IP — no secret
  rotation needed, since the address never left the account. (A reserved IP
  bills a small flat hourly rate whether attached or not.)
- **Follow-ups in Slack work**: a mention inside a thread fires a fresh
  session, but the relay injects the thread history into the payload, so the
  new session continues the conversation. The session URL in the relay log
  also opens in claude.ai for direct continuation.
- **Onboarding a person = one small file, no restart**: people live as one
  JSON file each in `/opt/pmm-ai-relay/people/<name>.json`
  ([template](relay/person.example.json)) and the relay hot-reloads the
  directory on any change. To add someone: paste their file via Lish/`nano`
  (or hand the fields to a Claude session on this repo, which rebuilds the
  server with the file baked in). Backup: mirror each file as its own Secure
  Note in the LastPass **PMM** folder (`pmm-ai-person-<name>`); the `.env`
  note stays small and rarely changes. Restore everything with
  `./relay/deploy.sh .env people_dir/` after dumping the notes back to files.

## Endpoints (source of truth)

The relay runs on the `pmm-ai-relay` Linode, reachable at the instance's free
default rDNS hostname **`139-162-176-43.ip.linodeusercontent.com`** (resolves
to `139.162.176.43`).

| Port | Scheme | Endpoints | Who calls it |
|---|---|---|---|
| **443** | HTTPS, **Let's Encrypt** cert (publicly trusted) | `/health`, `/reply`, `/route`, `/jira` | Fired Claude Code sessions AND the Jira Automation rule. The session egress proxy re-terminates TLS and validates the origin cert against public CAs, so the cert MUST be real (self-signed is rejected, curl exit 35). HTTPS-only — no plain-HTTP port. |

`REPLY_BASE_URL` in the `.env` is `https://139-162-176-43.ip.linodeusercontent.com`
and `relay.js` defaults `HTTPS_PORT` to 443. History: an earlier iteration
used raw-IP:8443 with a self-signed cert, which fired sessions could not
reach: their egress proxy re-terminates TLS and rejects a self-signed origin
(curl exit 35). Fix = a real Let's Encrypt cert (HTTP-01 on port 80, which
LE validates from the public internet, bypassing the proxy) on the free rDNS
hostname, served on 443. **Verified end-to-end 2026-08-07**: /health returns
200 through the session egress proxy with no `-k`, /reply and /jira reject
bad credentials with 403. No environment allowlist change needed (qa-linode
is Full network). The cert auto-renews via a certbot deploy-hook that
restarts the relay.

## Architecture

```text
Slack @mention
  -> Socket Mode (outbound websocket from our side -- no public endpoint,
     no Cloudflare Worker, no request-signature verification)
  -> small always-on relay process (Slack Bolt SDK)
     -> static channel -> routine lookup table (below)
  -> POST https://api.anthropic.com/v1/claude_code/routines/<id>/fire
     with `text` = channel ID + thread_ts + the mention's stripped message
  -> fired Claude Code Routine session does the actual work
     -> replies in-thread via Slack's Web API directly (chat.postMessage
        with the relay's SLACK_BOT_TOKEN), NOT the Slack MCP connector --
        the MCP connector posts as whoever authorized it (a person); this
        bot token makes replies show up as "PMM AI" instead.
```

Socket Mode means the relay only needs an app-level token
(`connections:write` scope, generated under **Basic Information > App-Level
Tokens** after installing from the manifest) — no inbound URL to expose.

Every Slack event arrives with an `envelope_id` that the relay must ack
within 3 seconds, or Slack redelivers the same event — and Slack can also
just retry on its own (e.g. a slow ack). The relay must dedup on Slack's
event `event_id`/`client_msg_id` before firing the Routine, or a single
retried delivery fires it twice for the same mention.

### Reply-as-bot

`SLACK_BOT_TOKEN` (the bot OAuth token, `xoxb-...`, from installing the app)
lives ONLY in the relay's own `.env` on the server — it is never put into any
Claude environment or fired session. Instead,
the relay exposes a small local endpoint the fired session calls to post
its reply, and the relay itself makes the `chat.postMessage` call with the
token it already holds:

```text
fired Routine session
  -> POST http://<relay-internal-endpoint>/reply {channel, thread_ts, text}
  -> relay calls chat.postMessage with SLACK_BOT_TOKEN (never leaves the relay)
```

`/reply` must not be an open endpoint: anything able to reach it could post
arbitrary messages as the bot to any channel. Authenticate the caller (a
short-lived, per-run signed capability minted when the Routine fires, checked
by the relay) and bind it to the `channel`/`thread_ts` it was minted for, so
a fired session can only reply into the thread that triggered it. Not
implemented yet — call this out explicitly when the relay is actually built.

## Channel -> routine routing table

Deterministic, zero-LLM-cost routing (which channel fired) lives in the
relay itself; the actual message-to-agent matching happens one layer in, in
[`.claude/agents/router.md`](../../agents/router.md) — the `PMM AI` Routine's
own prompt is just "read `router.md` and follow it," not a mega-prompt
trying to guess intent itself:

| Channel (placeholder) | Routine | Notes |
| --- | --- | --- |
| PMM QA channel(s) | `PMM AI` | Fires `router.md`, which matches the mention to test-runner / investigator / fb-reporter by description, or just answers directly if it's a general question. |
| Prod/support channel(s) | `PMM AI` (same Routine) | No separate agent needed here — a suspected customer-reported bug, or a "is this expected?" question, is one of `investigator`'s own direct-ask outcomes (`.claude/agents/investigator.md` workflow step 3b), not a distinct triage step in front of it. `router.md` sends it there like anything else that looks like a bug report. |

Fill in real channel IDs once the app is installed and invited to them. An
earlier draft of this doc proposed a separate future "support-triage" agent
for the prod/support case, sitting in front of Investigator to decide
question-vs-bug first — dropped once Investigator grew that classification
into its own direct-ask path; a second agent for "maybe it's not even a bug"
would have just duplicated it.

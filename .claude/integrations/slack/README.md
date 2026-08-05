# PMM AI — custom Slack app (design, not yet built)

Claude Tag (the official Slack app) pairs one Slack workspace to one Claude
org — it can't run a second identity in a workspace already paired to
another account, and it only reacts to an explicit `@mention` or DM by
design (no passive channel watching). This is a small custom Slack app that
works around the first limit; it doesn't try to work around the second
(mention-only is what we actually want here).

**Status: designed, nothing deployed yet.**

- [ ] Create the app from [`manifest.yaml`](manifest.yaml) in Slack — needs
      admin approval to install (org policy), not yet requested.
- [ ] Write the relay process (see below) — not started.
- [ ] Create the `PMM AI` Routine itself in Claude Code — **do not create
      this without asking first**, per standing instruction in this repo's
      chat history. Its prompt should just be "read `.claude/agents/router.md`
      and follow it" — all the actual matching logic lives there, not in the
      Routine's own prompt.
- [ ] Provision `PMM_AI_SLACK_BOT_TOKEN` (and the app-level token for Socket
      Mode) once the app exists.

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
        with PMM_AI_SLACK_BOT_TOKEN), NOT the Slack MCP connector --
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

`PMM_AI_SLACK_BOT_TOKEN` (the bot OAuth token, `xoxb-...`, from installing
the app) stays in the relay process's own managed secret store — it is
never provisioned into the fired Routine session's environment. Instead,
the relay exposes a small local endpoint the fired session calls to post
its reply, and the relay itself makes the `chat.postMessage` call with the
token it already holds:

```text
fired Routine session
  -> POST http://<relay-internal-endpoint>/reply {channel, thread_ts, text}
  -> relay calls chat.postMessage with PMM_AI_SLACK_BOT_TOKEN (never leaves the relay)
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
|---|---|---|
| PMM QA channel(s) | `PMM AI` | Fires `router.md`, which matches the mention to test-runner / investigator / fb-reporter by description, or just answers directly if it's a general question. |
| Prod/support channel(s) | `PMM AI` (same Routine) | No separate agent needed here — a suspected customer-reported bug, or a "is this expected?" question, is one of `investigator`'s own direct-ask outcomes (`.claude/agents/investigator.md` workflow step 3b), not a distinct triage step in front of it. `router.md` sends it there like anything else that looks like a bug report. |

Fill in real channel IDs once the app is installed and invited to them. An
earlier draft of this doc proposed a separate future "support-triage" agent
for the prod/support case, sitting in front of Investigator to decide
question-vs-bug first — dropped once Investigator grew that classification
into its own direct-ask path; a second agent for "maybe it's not even a bug"
would have just duplicated it.

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
      chat history.
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

Deterministic, zero-LLM-cost routing lives in the relay itself, not inside
one mega-prompt trying to guess intent across unrelated domains:

| Channel (placeholder) | Routine | Notes |
|---|---|---|
| PMM QA channel(s) | `PMM AI` | General router — reads `AGENTS.md` + `.claude/agents/*.md`, matches the message to test-runner / test-doctor / fb-validator by description, or just answers directly if it's a general question. |
| Prod/support channel(s) | *(future — see below)* | Not yet built. |

Fill in real channel IDs once the app is installed and invited to them.

## Future agent idea — not built yet

For a prod/support channel specifically: something that reads a person's
message in a thread and figures out which of two things is actually going
on — they're unsure how to do something in PMM (a how-to question, no bug
involved), or they're reporting what they believe is a bug and it needs to
be reproduced and confirmed (or ruled out) before anyone treats it as real.
Working name **"support-triage"** (rejected: "investigator" — open to a
better name). Would reuse `pmm-linode-provisioning` the same way
test-runner/test-doctor do, to actually attempt reproduction rather than
guessing from the description alone.

Not implemented. When it is, the channel-based routing table above is the
mechanism to point that specific channel at it instead of the general
`PMM AI` router.

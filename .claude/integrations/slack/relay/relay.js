// PMM AI relay — Slack/Jira -> Claude Code Routines (Socket Mode; no public inbound needed for Slack)
// Deps: npm i @slack/bolt   (Node >= 20)
// Deployed on the pmm-ai-relay Linode by deploy.sh (same directory); config via /opt/pmm-ai-relay/.env
import pkg from "@slack/bolt";
import http from "node:http";
import crypto from "node:crypto";

const { App } = pkg;

// ROUTER_ROUTINE: {"id","token"} — the ONE central "PMM AI" Routine that ALL
//   mentions fire (it reads router.md: evaluates the ask, routes to the right
//   agent, or declines off-topic requests cheaply). Replies post as the bot,
//   so mentions need no per-person identity. Unset => mention flow disabled.
// PEOPLE: {"<name>":{"slack":"U0123","jira":"<atlassian accountId>","id":"trig_...","token":"sk-ant-oat01-..."}}
//   used by /jira ONLY (Jira comments must post as the person who clicked);
//   one entry per onboarded person, all four fields mandatory
// CHANNEL_ROUTINES: {"C0123":{"id","token"}} — every top-level human message in
//   that channel fires the mapped Routine (e.g. an alerts channel -> Investigator)
// DEFAULT_ROUTINE: {"id","token"} — /jira fallback when ALLOW_FALLBACK=true
const ROUTER_ROUTINE = JSON.parse(process.env.ROUTER_ROUTINE || "null");
const PEOPLE = JSON.parse(process.env.PEOPLE || "{}");
const CHANNEL_ROUTINES = JSON.parse(process.env.CHANNEL_ROUTINES || "{}");
const DEFAULT_ROUTINE = JSON.parse(process.env.DEFAULT_ROUTINE || "null");
const byJira = Object.fromEntries(Object.values(PEOPLE).map((p) => [p.jira, p]));
const ALLOW_FALLBACK = process.env.ALLOW_FALLBACK === "true"; // /jira: unmapped initiator -> DEFAULT_ROUTINE
const CHANNELS = (process.env.CHANNEL_ALLOWLIST || "").split(",").filter(Boolean); // mention flow; empty => all channels
const JIRA_RELAY_SECRET = process.env.JIRA_RELAY_SECRET;
const REPLY_SECRET = process.env.REPLY_SECRET;
const REPLY_BASE_URL = process.env.REPLY_BASE_URL || "http://localhost:8787";
const PORT = Number(process.env.REPLY_PORT || 8787);
const CAP_TTL_MS = 2 * 60 * 60 * 1000;

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const seen = new Map(); // event_id -> ts (fast in-memory dedup)
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of seen) if (v < cutoff) seen.delete(k);
}, 60_000).unref();

const sign = (channel, threadTs, exp) =>
  crypto.createHmac("sha256", REPLY_SECRET).update(`${channel}|${threadTs}|${exp}`).digest("hex");

async function fire(routine, text) {
  const res = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${routine.id}/fire`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${routine.token}`,
      "anthropic-beta": "experimental-cc-routine-2026-04-01",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`fire ${res.status}: ${await res.text()}`);
  return (await res.json()).claude_code_session_url;
}

// Durable dedup + "seen" UX: 👀 reaction survives relay restarts; Slack
// redeliveries hit already_reacted and stop. 👀 is never removed (removing it
// would let a late redelivery re-fire); ✅ is ADDED on completion instead.
// Returns false when this event is a duplicate.
async function markSeen(client, channel, ts, eventId) {
  if (seen.has(eventId)) return false;
  seen.set(eventId, Date.now());
  try {
    await client.reactions.add({ channel, timestamp: ts, name: "eyes" });
  } catch (e) {
    if (e?.data?.error === "already_reacted") return false;
    console.error(`reactions.add: ${e?.data?.error || e.message}`);
  }
  return true;
}

function replyInstructions(channel, threadTs) {
  const exp = Date.now() + CAP_TTL_MS;
  const cap = sign(channel, threadTs, exp);
  return (
    `To reply in the Slack thread, POST ${REPLY_BASE_URL}/reply with JSON ` +
    `{"channel":"${channel}","thread_ts":"${threadTs}","cap":"${cap}","exp":${exp},"text":"<your reply>"}`
  );
}

// Channel watch: every top-level human message in a mapped channel fires that
// channel's Routine (e.g. alerts channel -> Investigator). Replies come back
// as the bot via /reply.
app.event("message", async ({ event, body, client }) => {
  const routine = CHANNEL_ROUTINES[event.channel];
  if (!routine) return;
  if (event.subtype || event.bot_id || event.thread_ts) return; // top-level human posts only
  if (!(await markSeen(client, event.channel, event.ts, body.event_id))) return;

  const payload =
    `Slack message in watched channel ${event.channel} (thread ${event.ts}, author ${event.user}):\n` +
    `${event.text}\n\n${replyInstructions(event.channel, event.ts)}`;
  try {
    console.log(`channel-fire ${routine.id}: ${await fire(routine, payload)}`);
  } catch (e) {
    console.error(e.message);
  }
});

// Mention flow: everything goes to the ONE central router Routine, which
// evaluates the ask (router.md) and declines off-topic cheaply. Replies post
// as the bot, so no per-person identity is involved here.
app.event("app_mention", async ({ event, body, client }) => {
  if (!ROUTER_ROUTINE) return; // mention flow disabled
  if (CHANNEL_ROUTINES[event.channel]) return; // watched channels are handled above
  if (CHANNELS.length && !CHANNELS.includes(event.channel)) return;
  if (!(await markSeen(client, event.channel, event.ts, body.event_id))) return;

  const threadTs = event.thread_ts || event.ts;
  const routine = ROUTER_ROUTINE;
  const text = event.text.replace(/<@[^>]+>/g, "").trim();

  // Follow-ups: a mention inside a thread fires a FRESH session (routine runs
  // have no memory), so inject the thread history as context — the new session
  // picks up where the previous one left off. Needs channels:history.
  let history = "";
  if (event.thread_ts) {
    try {
      const r = await client.conversations.replies({
        channel: event.channel,
        ts: event.thread_ts,
        limit: 30,
      });
      history =
        "Earlier messages in this thread (oldest first):\n" +
        r.messages
          .slice(0, -1)
          .map((m) => `- ${m.bot_id ? "PMM AI" : m.user}: ${m.text}`)
          .join("\n") +
        "\n\n";
    } catch (e) {
      console.error(`history fetch failed: ${e?.data?.error || e.message}`);
    }
  }

  const payload =
    `Slack mention from user ${event.user} in channel ${event.channel} (thread ${threadTs}):\n` +
    `${history}Current request:\n${text}\n\n${replyInstructions(event.channel, threadTs)}`;
  try {
    console.log(`mention-fire ${routine.id} for ${event.user}: ${await fire(routine, payload)}`);
  } catch (e) {
    console.error(e.message);
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: threadTs,
      text: `:warning: PMM AI could not start. Check the relay logs.`,
    });
  }
});

http
  .createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;

    // Fired sessions reply in-thread through here; the bot token never leaves the relay.
    if (req.method === "POST" && req.url === "/reply") {
      try {
        const { channel, thread_ts, cap, exp, text } = JSON.parse(raw);
        const expected = sign(channel, thread_ts, exp);
        if (Date.now() > exp || !crypto.timingSafeEqual(Buffer.from(cap), Buffer.from(expected)))
          throw new Error("bad capability");
        await app.client.chat.postMessage({ channel, thread_ts, text });
        await app.client.reactions
          .add({ channel, timestamp: thread_ts, name: "white_check_mark" })
          .catch(() => {});
        res.writeHead(200).end("ok");
      } catch (e) {
        console.error(`reply rejected: ${e.message}`);
        res.writeHead(403).end("forbidden");
      }
      return;
    }

    // Jira Automation entry point: the single admin-configured rule POSTs here
    // with {"accountId":"{{initiator.accountId}}","text":"ticket + instruction"}.
    if (req.method === "POST" && req.url === "/jira") {
      try {
        if (!JIRA_RELAY_SECRET || req.headers["x-relay-secret"] !== JIRA_RELAY_SECRET)
          throw new Error("bad secret");
        const { accountId, text } = JSON.parse(raw);
        const routine = byJira[accountId] || (ALLOW_FALLBACK ? DEFAULT_ROUTINE : null);
        if (!routine) throw new Error(`no routine mapped for ${accountId}`);
        console.log(`jira-fire ${routine.id} for ${accountId}: ${await fire(routine, `Jira trigger (initiator ${accountId}):\n${text}`)}`);
        res.writeHead(200).end("ok");
      } catch (e) {
        console.error(`/jira rejected: ${e.message}`);
        res.writeHead(403).end("forbidden");
      }
      return;
    }

    res.writeHead(404).end();
  })
  .listen(PORT, () => console.log(`HTTP endpoints (/reply, /jira) on :${PORT}`));

await app.start();
console.log("PMM AI relay connected (Socket Mode)");

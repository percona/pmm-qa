// PMM AI relay — Slack/Jira -> Claude Code Routines (Socket Mode; no public inbound needed for Slack)
// Deps: npm i @slack/bolt   (Node >= 20)
// Deployed on the pmm-ai-relay Linode by deploy.sh (same directory); config via /opt/pmm-ai-relay/.env
import pkg from "@slack/bolt";
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const { App } = pkg;

// ROUTER_ROUTINE: {"id","token"} — the ONE central "PMM AI" Routine. Mentions
//   from REGISTERED people fire it; it only decides which of the caller's own
//   routines fits (or declines), then hands off via POST /route. The actual
//   work runs on the CALLER's routine, billed to the caller.
// People live as ONE SMALL JSON FILE EACH in PEOPLE_DIR (default
// /opt/pmm-ai-relay/people/<name>.json), hot-reloaded on any change — adding
// a teammate is dropping a file there, no restart, no .env editing:
//   { "slack": "U0123", "jira": "<atlassian accountId>",
//     "routines": { "test-runner": {"id":"trig_...","token":"sk-ant-..."},
//                   "investigator": {"id":"trig_...","token":"sk-ant-..."} } }
// Tokens never leave this server.
// CHANNEL_ROUTINES: {"C0123":{"id","token"}} — every top-level human message in
//   that channel fires the mapped Routine automatically (e.g. alerts channel ->
//   Investigator running on the QA owner's account).
// DEFAULT_ROUTINE: {"id","token"} — /jira fallback when ALLOW_FALLBACK=true.
const ROUTER_ROUTINE = JSON.parse(process.env.ROUTER_ROUTINE || "null");
const PEOPLE_DIR = process.env.PEOPLE_DIR || "/opt/pmm-ai-relay/people";
const CHANNEL_ROUTINES = JSON.parse(process.env.CHANNEL_ROUTINES || "{}");
const DEFAULT_ROUTINE = JSON.parse(process.env.DEFAULT_ROUTINE || "null");

let bySlack = {};
let byJira = {};
function loadPeople() {
  const s = {};
  const j = {};
  let files = [];
  try {
    files = fs.readdirSync(PEOPLE_DIR).filter((f) => f.endsWith(".json"));
  } catch (e) {
    console.error(`people dir unreadable (${PEOPLE_DIR}): ${e.message}`);
  }
  for (const f of files) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(PEOPLE_DIR, f), "utf8"));
      p.name = f.replace(/\.json$/, "");
      if (p.slack) s[p.slack] = p;
      if (p.jira) j[p.jira] = p;
    } catch (e) {
      console.error(`people: skipping bad file ${f}: ${e.message}`); // one broken file never takes the relay down
    }
  }
  bySlack = s;
  byJira = j;
  console.log(`people loaded: ${files.length} file(s), ${Object.keys(s).length} with slack, ${Object.keys(j).length} with jira`);
}
loadPeople();
let reloadTimer;
try {
  fs.watch(PEOPLE_DIR, { persistent: false }, () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(loadPeople, 500); // editors fire several events per save
  });
} catch (e) {
  console.error(`people watch failed (edits need a restart): ${e.message}`);
}
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

// Capabilities are HMAC-bound to their purpose + thread, so a fired session
// can only act on the thread that triggered it, and a /reply cap can't be
// replayed against /route (and vice versa).
const sign = (purpose, parts, exp) =>
  crypto.createHmac("sha256", REPLY_SECRET).update(`${purpose}|${parts.join("|")}|${exp}`).digest("hex");
const verify = (cap, purpose, parts, exp) => {
  if (Date.now() > exp) return false;
  const expected = sign(purpose, parts, exp);
  return cap.length === expected.length && crypto.timingSafeEqual(Buffer.from(cap), Buffer.from(expected));
};

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
  const cap = sign("reply", [channel, threadTs], exp);
  return (
    `To reply in the Slack thread, POST ${REPLY_BASE_URL}/reply with JSON ` +
    `{"channel":"${channel}","thread_ts":"${threadTs}","cap":"${cap}","exp":${exp},"text":"<your reply>"}`
  );
}

async function fetchThreadHistory(client, channel, threadTs) {
  try {
    const r = await client.conversations.replies({ channel, ts: threadTs, limit: 30 });
    return (
      "Earlier messages in this thread (oldest first):\n" +
      r.messages
        .slice(0, -1)
        .map((m) => `- ${m.bot_id ? "PMM AI" : m.user}: ${m.text}`)
        .join("\n") +
      "\n\n"
    );
  } catch (e) {
    console.error(`history fetch failed: ${e?.data?.error || e.message}`);
    return "";
  }
}

// Channel watch: every top-level human message in a mapped channel fires that
// channel's Routine automatically (e.g. alerts channel -> Investigator).
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

// Mention flow: only REGISTERED people reach the central router (unregistered
// get a zero-cost reply). The router evaluates the ask and hands off to one of
// the CALLER's own routines via POST /route — so the work is billed to, and
// acts as, the person who asked. Tokens stay on this server.
app.event("app_mention", async ({ event, body, client }) => {
  if (!ROUTER_ROUTINE) return; // mention flow disabled
  if (CHANNEL_ROUTINES[event.channel]) return; // watched channels are handled above
  if (CHANNELS.length && !CHANNELS.includes(event.channel)) return;
  if (!(await markSeen(client, event.channel, event.ts, body.event_id))) return;

  const threadTs = event.thread_ts || event.ts;
  const person = bySlack[event.user];
  if (!person) {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: threadTs,
      text: `:lock: <@${event.user}> you're not registered with PMM AI yet — ask the QA team to add you to the relay map.`,
    });
    return;
  }

  const text = event.text.replace(/<@[^>]+>/g, "").trim();
  const history = event.thread_ts ? await fetchThreadHistory(client, event.channel, event.thread_ts) : "";
  const exp = Date.now() + CAP_TTL_MS;
  const routeCap = sign("route", [event.user, event.channel, threadTs], exp);
  const agents = Object.keys(person.routines || {});

  const payload =
    `Slack mention from ${person.name} (${event.user}) in channel ${event.channel} (thread ${threadTs}):\n` +
    `${history}Current request:\n${text}\n\n` +
    `This caller has these personal routines available: ${agents.join(", ") || "(none)"}.\n` +
    `If the request fits one of them, hand off by POSTing ${REPLY_BASE_URL}/route with JSON ` +
    `{"user":"${event.user}","channel":"${event.channel}","thread_ts":"${threadTs}",` +
    `"agent":"<one of the available routines>","instruction":"<self-contained task for that agent>",` +
    `"cap":"${routeCap}","exp":${exp}} — the work then runs on the caller's own account.\n` +
    `If the request is off-topic, or no suitable routine is available, do NOT hand off; ` +
    `reply briefly instead. ${replyInstructions(event.channel, threadTs)}`;

  try {
    console.log(`router-fire for ${person.name}: ${await fire(ROUTER_ROUTINE, payload)}`);
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
        if (!verify(cap, "reply", [channel, thread_ts], exp)) throw new Error("bad capability");
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

    // The central router hands off here: fires one of the CALLER's own
    // routines with a fresh reply capability for the same thread.
    if (req.method === "POST" && req.url === "/route") {
      try {
        const { user, channel, thread_ts, agent, instruction, cap, exp } = JSON.parse(raw);
        if (!verify(cap, "route", [user, channel, thread_ts], exp)) throw new Error("bad capability");
        const person = bySlack[user];
        const routine = person?.routines?.[agent];
        if (!routine) throw new Error(`no "${agent}" routine mapped for ${user}`);
        const payload =
          `Handed off by PMM AI router on behalf of ${person.name} (Slack ${user}).\n` +
          `Task:\n${instruction}\n\n${replyInstructions(channel, thread_ts)}`;
        console.log(`route-fire ${agent} for ${person.name}: ${await fire(routine, payload)}`);
        res.writeHead(200).end("ok");
      } catch (e) {
        console.error(`/route rejected: ${e.message}`);
        res.writeHead(403).end("forbidden");
      }
      return;
    }

    // Jira Automation entry point: the single admin-configured rule POSTs here
    // with {"accountId":"{{initiator.accountId}}","text":"ticket + instruction"}.
    // Routes to the initiator's own test-runner routine.
    if (req.method === "POST" && req.url === "/jira") {
      try {
        if (!JIRA_RELAY_SECRET || req.headers["x-relay-secret"] !== JIRA_RELAY_SECRET)
          throw new Error("bad secret");
        const { accountId, text } = JSON.parse(raw);
        const person = byJira[accountId];
        const routine = person?.routines?.["test-runner"] || (ALLOW_FALLBACK ? DEFAULT_ROUTINE : null);
        if (!routine) throw new Error(`no test-runner routine mapped for ${accountId}`);
        console.log(
          `jira-fire for ${person?.name || "fallback"}: ${await fire(routine, `Jira trigger (initiator ${accountId}):\n${text}`)}`,
        );
        res.writeHead(200).end("ok");
      } catch (e) {
        console.error(`/jira rejected: ${e.message}`);
        res.writeHead(403).end("forbidden");
      }
      return;
    }

    res.writeHead(404).end();
  })
  .listen(PORT, () => console.log(`HTTP endpoints (/reply, /route, /jira) on :${PORT}`));

await app.start();
console.log("PMM AI relay connected (Socket Mode)");
